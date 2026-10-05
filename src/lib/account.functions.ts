import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REAUTH_WINDOW_SECONDS = 10 * 60;

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ confirm: z.literal("DELETE"), password: z.string().max(200).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const { data: userData, error: userError } = await context.supabase.auth.getUser();
    if (userError || !userData.user || userData.user.id !== userId) throw new Error("Unauthorized");
    const user = userData.user;
    const providers = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider as string];

    if (data.password) {
      if (!user.email) throw new Error("Password check failed");
      const { createClient } = await import("@supabase/supabase-js");
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
      const check = createClient(process.env["SUPABASE_URL"]!, key, {
        auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        global: { fetch: (i, init) => { const h = new Headers(init?.headers); if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization"); h.set("apikey", key); return fetch(i, { ...init, headers: h }); } },
      });
      const { error } = await check.auth.signInWithPassword({ email: user.email, password: data.password });
      if (error) throw new Error("WRONG_PASSWORD");
    } else {
      // Google-only accounts must have signed in again within the last 10 minutes.
      const amr = ((claims as Record<string, unknown>)["amr"] as Array<{ method: string; timestamp: number }> | undefined) ?? [];
      const now = Math.floor(Date.now() / 1000);
      const fresh = amr.some((a) => a.method === "oauth" && now - a.timestamp <= REAUTH_WINDOW_SECONDS);
      if (!providers.includes("google") || !fresh) throw new Error("REAUTH_REQUIRED");
    }

    const { createHash } = await import("crypto");
    const userHash = createHash("sha256").update(`mvp-bizmanager:${userId}`).digest("hex");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: owned } = await supabaseAdmin.from("shop_members").select("shop_id").eq("user_id", userId).eq("role", "owner");
    const { data: files, error: dataError } = await supabaseAdmin.rpc("delete_account_data", { _user_id: userId, _user_hash: userHash });
    if (dataError) { console.error("delete_account_data failed", dataError.message); throw new Error("Deletion failed"); }

    const paths = new Set((files ?? []).map((f: { file_path: string }) => f.file_path).filter(Boolean));
    for (const { shop_id } of owned ?? []) {
      const { data: still } = await supabaseAdmin.from("shops").select("id").eq("id", shop_id).maybeSingle();
      if (still) continue;
      const { data: listed } = await supabaseAdmin.storage.from("shop-documents").list(shop_id, { limit: 1000 });
      for (const f of listed ?? []) paths.add(`${shop_id}/${f.name}`);
    }
    const all = [...paths];
    for (let i = 0; i < all.length; i += 100) {
      const { error } = await supabaseAdmin.storage.from("shop-documents").remove(all.slice(i, i + 100));
      if (error) console.error("storage cleanup failed", error.message);
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) { console.error("auth delete failed", authError.message); throw new Error("Deletion failed"); }
    return { ok: true };
  });
