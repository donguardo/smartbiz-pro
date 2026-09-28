import { createFileRoute } from "@tanstack/react-router";
import { safeValidateUIMessages } from "ai";
import { z } from "zod";
import { streamBizBotReply } from "@/lib/bizbot.server";

const bodySchema = z.object({
  messages: z.array(z.unknown()).max(80),
  language: z.enum(["en", "tl"]).default("en"),
  storeContext: z.string().max(60_000).default(""),
});

export const Route = createFileRoute("/api/public/bizbot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentLength = Number(request.headers.get("content-length") ?? 0);
          if (contentLength > 250_000) return new Response("Conversation is too large.", { status: 413 });
          const parsed = bodySchema.safeParse(await request.json());
          if (!parsed.success) return new Response("Invalid conversation request.", { status: 400 });
          const validated = await safeValidateUIMessages({ messages: parsed.data.messages });
          if (!validated.success) return new Response("Invalid conversation history.", { status: 400 });
          return await streamBizBotReply({
            request,
            messages: validated.data,
            language: parsed.data.language,
            storeContext: parsed.data.storeContext,
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return new Response(null, { status: 499 });
          const message = error instanceof Error ? error.message : "BIZBOT could not answer right now.";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});