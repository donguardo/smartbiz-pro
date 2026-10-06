/**
 * Billing diagnostics: webhook delivery log and subscription link check are
 * scoped to the right shop and the server's payment mode.
 * Run: bun test tests/billing-diagnostics.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";
import { groupDeliveries } from "../src/lib/billing-deliveries";

const URL = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const ANON = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const enabled = !!(URL && ANON && SERVICE);
type DB = SupabaseClient<Database>;

const keyFetch = (key: string): typeof fetch => (input, init) => {
  const h = new Headers(init?.headers);
  if (/^sb_(publishable|secret)_/.test(key) && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
  h.set("apikey", key);
  return fetch(input, { ...init, headers: h });
};
const opts = (key: string) => ({ global: { fetch: keyFetch(key) }, auth: { persistSession: false, autoRefreshToken: false } });

const run = `d${Date.now().toString(36)}`;
const PASSWORD = `T3st-${run}-pw!`;
type U = { id: string; email: string; db: DB };
const users: Record<"ownerA" | "ownerB" | "cashierA", U> = {} as never;
let admin: DB;
let env = "sandbox";
const other = () => (env === "sandbox" ? "live" : "sandbox");

async function makeUser(role: keyof typeof users) {
  const email = `qa-${role.toLowerCase()}-${run}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const db = createClient<Database>(URL!, ANON!, opts(ANON!));
  const { error: e2 } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  users[role] = { id: data.user.id, email, db };
}
const sub = (owner: U, shop: string | null, environment: string, id: string) =>
  admin.from("subscriptions").upsert({
    user_id: owner.id, shop_id: shop, paddle_subscription_id: id, paddle_customer_id: `ctm_${run}`,
    product_id: "bizmanager_plan", price_id: "bizmanager_monthly", status: "active", environment,
    current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
  }, { onConflict: "paddle_subscription_id" });
const clearSubs = () => admin.from("subscriptions").delete().like("paddle_subscription_id", `%${run}%`);
const check = async (u: U) => (await u.db.rpc("get_billing_link_check")).data?.[0];

describe("delivery grouping", () => {
  test("retries of one event collapse with the newest as final", () => {
    const g = groupDeliveries([
      { id: "1", paddle_event_id: "evt_1", event_type: "subscription.updated", sync_status: "failed", detail: "x", environment: "sandbox", created_at: "2026-10-06T10:00:00Z" },
      { id: "2", paddle_event_id: "evt_1", event_type: "subscription.updated", sync_status: "synced", detail: "y", environment: "sandbox", created_at: "2026-10-06T10:05:00Z" },
      { id: "3", paddle_event_id: "evt_2", event_type: "subscription.created", sync_status: "synced", detail: "z", environment: "sandbox", created_at: "2026-10-06T09:00:00Z" },
    ]);
    expect(g).toHaveLength(2);
    expect(g[0]!.attempts).toHaveLength(2);
    expect(g[0]!.final.sync_status).toBe("synced");
    expect(g[1]!.attempts).toHaveLength(1);
  });
});

describe.skipIf(!enabled)("billing diagnostics", () => {
  beforeAll(async () => {
    admin = createClient<Database>(URL!, SERVICE!, opts(SERVICE!));
    await makeUser("ownerA"); await makeUser("ownerB"); await makeUser("cashierA");
    for (const o of [users.ownerA, users.ownerB]) {
      const { error } = await o.db.rpc("ensure_my_shop", { _business_name: `QA diag ${run}` });
      if (error) throw error;
    }
    const { data: inv, error: ie } = await users.ownerA.db.rpc("create_shop_invite", { _email: users.cashierA.email });
    if (ie) throw ie;
    const { error: ae } = await users.cashierA.db.rpc("accept_shop_invite", { _code: inv[0]!.code });
    if (ae) throw ae;
    env = (await users.ownerA.db.rpc("get_payments_env")).data ?? "sandbox";
  }, 60000);

  afterAll(async () => {
    if (!admin) return;
    await clearSubs();
    for (const u of Object.values(users)) {
      await admin.rpc("delete_account_data", { _user_id: u.id, _user_hash: `qa-${run}` });
      await admin.auth.admin.deleteUser(u.id);
    }
  }, 60000);

  test("each owner sees only their own shop's webhook events, with retries", async () => {
    const a = users.ownerA.id, b = users.ownerB.id;
    const { error } = await admin.from("billing_events").insert([
      { shop_id: a, paddle_event_id: `evt_a_${run}`, event_type: "subscription.updated", environment: env, sync_status: "failed", detail: "Could not update subscription" },
      { shop_id: a, paddle_event_id: `evt_a_${run}`, event_type: "subscription.updated", environment: env, sync_status: "synced", detail: "Status active" },
      { shop_id: b, paddle_event_id: `evt_b_${run}`, event_type: "subscription.created", environment: env, sync_status: "synced", detail: "Status active" },
    ]);
    expect(error).toBeNull();
    const seenA = (await users.ownerA.db.from("billing_events").select("paddle_event_id, sync_status, created_at, id, event_type, detail, environment")).data ?? [];
    expect(seenA.every((r) => r.paddle_event_id === `evt_a_${run}`)).toBe(true);
    const g = groupDeliveries(seenA);
    expect(g).toHaveLength(1);
    expect(g[0]!.attempts).toHaveLength(2);
    const seenB = (await users.ownerB.db.from("billing_events").select("paddle_event_id")).data ?? [];
    expect(seenB.map((r) => r.paddle_event_id)).toEqual([`evt_b_${run}`]);
  });

  test("cashiers cannot read the log or run the link check", async () => {
    expect((await users.cashierA.db.from("billing_events").select("id")).data ?? []).toHaveLength(0);
    expect((await users.cashierA.db.rpc("get_billing_link_check")).error).not.toBeNull();
  });

  test("browser users cannot write webhook events", async () => {
    const { error } = await users.ownerA.db.from("billing_events").insert({ shop_id: users.ownerA.id, event_type: "forged", environment: env, sync_status: "synced" });
    expect(error).not.toBeNull();
  });

  test("no subscription reports none in the current mode", async () => {
    const c = await check(users.ownerA);
    expect(c?.paddle_subscription_id).toBeNull();
    expect(c?.payments_env).toBe(env);
  });

  test("a subscription in the current mode linked to the shop passes both checks", async () => {
    await sub(users.ownerA, users.ownerA.id, env, `sub_ok_${run}`);
    const c = await check(users.ownerA);
    expect(c?.shop_ok).toBe(true);
    expect(c?.env_ok).toBe(true);
    // Owner B's check is unaffected by owner A's subscription.
    expect((await check(users.ownerB))?.paddle_subscription_id).toBeNull();
  });

  test("a subscription only in the other payment mode fails the mode check", async () => {
    await clearSubs();
    await sub(users.ownerA, users.ownerA.id, other(), `sub_other_${run}`);
    const c = await check(users.ownerA);
    expect(c?.env_ok).toBe(false);
    expect(Number(c?.other_env_count)).toBe(1);
  });

  test("a subscription not linked to any shop fails the shop check", async () => {
    await clearSubs();
    await sub(users.ownerA, null, env, `sub_noshop_${run}`);
    const c = await check(users.ownerA);
    expect(c?.shop_ok).not.toBe(true);
    expect(c?.env_ok).toBe(true);
  });
});
