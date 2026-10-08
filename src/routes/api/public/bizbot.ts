import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { safeValidateUIMessages, type UIMessage } from "ai";
import { z } from "zod";
import { streamBizBotReply } from "@/lib/bizbot.server";
import { buildStoreContext } from "@/lib/bizbot-context.server";

const MAX_BYTES = 65_536;
const TOO_LONG = "This conversation is too long. Tap Clear to start a new one.";
const SIGN_IN = "Sign in to chat with BIZBOT.";
const GENERIC = "BIZBOT could not answer right now.";

const bodySchema = z.object({
  messages: z.array(z.unknown()).min(1).max(20),
  language: z.enum(["en", "tl"]).default("en"),
});

const text = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

async function readCappedBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out;
}

function validShape(messages: UIMessage[]) {
  return messages.every((m) => {
    if (m.role !== "user" && m.role !== "assistant") return false;
    return m.parts.every((p) => p.type === "text" || (m.role === "assistant" && (p.type === "reasoning" || p.type === "step-start")));
  });
}

function mapLimitError(message: string): Response {
  if (message.startsWith("Sign in")) return text(SIGN_IN, 401);
  if (message.includes("wait a minute")) return text("Please wait a minute before asking BIZBOT again.", 429);
  if (message.includes("today's BIZBOT limit")) return text("You have reached today's BIZBOT limit. Please try again tomorrow.", 429);
  if (message.includes("busy today")) return text("BIZBOT is busy today. Please try again tomorrow.", 429);
  if (message.includes("not available")) return text("BIZBOT is not available right now. Please try again later.", 503);
  console.error("bizbot_begin_run failed", message);
  return text(GENERIC, 503);
}

export const Route = createFileRoute("/api/public/bizbot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Size cap, counted in bytes (header first, then the real stream).
          if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) return text(TOO_LONG, 413);
          const bytes = await readCappedBody(request);
          if (!bytes) return text(TOO_LONG, 413);
          let raw: unknown;
          try { raw = JSON.parse(new TextDecoder().decode(bytes)); } catch { return text("Invalid conversation request.", 400); }

          // 2. Sign-in.
          const url = process.env["SUPABASE_URL"];
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
          const auth = request.headers.get("Authorization");
          if (!url || !key || !auth?.startsWith("Bearer ")) return text(SIGN_IN, 401);
          const client = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: auth } } });
          const { data: user, error: userError } = await client.auth.getUser(auth.slice(7));
          if (userError || !user.user) return text(SIGN_IN, 401);

          // 3. Body. Unknown fields (including any browser storeContext) are dropped.
          const parsed = bodySchema.safeParse(raw);
          if (!parsed.success) return text("Invalid conversation request.", 400);
          const validated = await safeValidateUIMessages({ messages: parsed.data.messages });
          if (!validated.success) return text("Invalid conversation history.", 400);
          const messages = validated.data;
          if (!validShape(messages)) return text("Invalid conversation history.", 400);
          if (messages[messages.length - 1]?.role !== "user") return text("Invalid conversation history.", 400);

          // 4. Limits (before the AI call so failed replies still count).
          const { error: limitError } = await client.rpc("bizbot_begin_run");
          if (limitError) return mapLimitError(limitError.message ?? "");

          // 5. Store data read on the server as the signed-in user.
          const storeContext = await buildStoreContext(client);

          return await streamBizBotReply({ request, messages, language: parsed.data.language, storeContext, userId: user.user.id });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return new Response(null, { status: 499 });
          console.error("bizbot route failed", error);
          return text(GENERIC, 500);
        }
      },
    },
  },
});
