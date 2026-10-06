/**
 * Database-level subscription enforcement: an expired-trial shop (owner and cashier)
 * cannot read or change protected data, and regains access once subscribed.
 * Uses throwaway confirmed users through real signed-in clients (RLS applies);
 * only the trial date and subscription rows are set with the service role,
 * exactly as the payments webhook would.
 *
 * Run: bun test --timeout 30000 tests/billing.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";

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

const run = `b${Date.now().toString(36)}`;
const PASSWORD = `T3st-${run}-pw!`;
const users: Record<"owner" | "cashier", { id: string; email: string; db: DB }> = {} as never;
let admin: DB;
let productId = "";
const day = 86400000;

async function makeUser(role: keyof typeof users) {
  const email = `qa-${role}-${run}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const db = createClient<Database>(URL!, ANON!, opts(ANON!));
  const { error: e2 } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  await db.from("profiles").insert({ id: data.user.id, business_name: `QA ${role}` });
  users[role] = { id: data.user.id, email, db };
}

const shopId = () => users.owner.id; // ensure_my_shop uses the owner's id as the shop id
const setTrialStart = async (msAgo: number) => {
  const { error } = await admin.from("shops").update({ created_at: new Date(Date.now() - msAgo).toISOString() }).eq("id", shopId());
  if (error) throw error;
};
const setSubscription = async (status: string, periodEndMs: number) => {
  const { error } = await admin.from("subscriptions").upsert({
    user_id: users.owner.id, shop_id: shopId(), paddle_subscription_id: `sub_${run}`, paddle_customer_id: `ctm_${run}`,
    product_id: "bizmanager_plan", price_id: "bizmanager_monthly", status, environment: "sandbox",
    current_period_start: new Date(Date.now() - day).toISOString(), current_period_end: new Date(Date.now() + periodEndMs).toISOString(),
  }, { onConflict: "paddle_subscription_id" });
  if (error) throw error;
};
const sell = (db: DB) =>
  db.rpc("record_sale", { _payment_method: "cash", _amount_tendered: 1000, _customer_id: null as unknown as string, _items: [{ product_id: productId, qty: 1 }] });

// Cashiers of a locked shop can read and change nothing.
async function expectBlocked(db: DB) {
  const rpcList = await db.rpc("get_shop_products_v2");
  expect(rpcList.data ?? []).toHaveLength(0);
  const direct = await db.from("products").select("id");
  expect(direct.data ?? []).toHaveLength(0);
  const sales = await db.from("sales").select("id");
  expect(sales.data ?? []).toHaveLength(0);
  expect((await sell(db)).error).not.toBeNull();
  expect((await db.from("products").insert({ name: `Blocked ${run}`, price: 1, unit: "pc" })).error).not.toBeNull();
  expect((await db.rpc("update_product", { _id: productId, _data: { price: 999 } })).error).not.toBeNull();
  expect((await db.from("customers").select("id")).data ?? []).toHaveLength(0);
  expect((await db.rpc("adjust_stock", { _product_id: productId, _kind: "restock", _qty: 5, _reason: "blocked test" })).error).not.toBeNull();
  expect((await db.rpc("remove_product", { _id: productId })).error).not.toBeNull();
}
// The owner of a locked shop keeps read-only access (for data export) but every write fails.
async function expectOwnerReadOnly(db: DB) {
  const direct = await db.from("products").select("id");
  expect(direct.error).toBeNull();
  expect((direct.data ?? []).length).toBeGreaterThan(0);
  const sales = await db.from("sales").select("id");
  expect(sales.error).toBeNull();
  expect((await db.from("customers").select("id")).error).toBeNull();
  expect((await sell(db)).error).not.toBeNull();
  expect((await db.from("products").insert({ name: `Blocked ${run}`, price: 1, unit: "pc" })).error).not.toBeNull();
  expect((await db.rpc("update_product", { _id: productId, _data: { price: 999 } })).error).not.toBeNull();
  expect((await db.rpc("adjust_stock", { _product_id: productId, _kind: "restock", _qty: 5, _reason: "blocked test" })).error).not.toBeNull();
  expect((await db.rpc("remove_product", { _id: productId })).error).not.toBeNull();
}
async function expectAllowed(db: DB) {
  const { data, error } = await db.rpc("get_shop_products_v2");
  expect(error).toBeNull();
  expect(data?.some((p) => p.id === productId)).toBe(true);
  const { error: saleErr } = await sell(db);
  expect(saleErr).toBeNull();
  const { data: sales } = await db.from("sales").select("id");
  expect((sales ?? []).length).toBeGreaterThan(0);
}

describe.skipIf(!enabled)("subscription enforcement", () => {
  beforeAll(async () => {
    admin = createClient<Database>(URL!, SERVICE!, opts(SERVICE!));
    await makeUser("owner"); await makeUser("cashier");
    const { error } = await users.owner.db.rpc("ensure_my_shop", { _business_name: `QA billing shop` });
    if (error) throw error;
    const { data: invite, error: ie } = await users.owner.db.rpc("create_shop_invite", { _email: users.cashier.email });
    if (ie) throw ie;
    const { error: ae } = await users.cashier.db.rpc("accept_shop_invite", { _code: invite[0]!.code });
    if (ae) throw ae;
    const { error: pe } = await users.owner.db.from("products").insert({ name: `Soap ${run}`, price: 20, unit: "pc", track_stock: true, stock_qty: 100 });
    if (pe) throw pe;
    const { data } = await users.owner.db.rpc("get_shop_products_v2");
    productId = data!.find((p) => p.name === `Soap ${run}`)!.id;
  }, 60000);

  afterAll(async () => {
    if (!admin) return;
    await setTrialStart(0).catch(() => undefined); // restore access so cleanup can run normally
    for (const u of Object.values(users)) {
      await admin.rpc("delete_account_data", { _user_id: u.id, _user_hash: `qa-${run}` });
      await admin.auth.admin.deleteUser(u.id);
    }
  }, 60000);

  test("a shop inside its 14-day trial has full access", async () => {
    const { data } = await users.owner.db.rpc("get_shop_billing", { _env: "sandbox" });
    expect(data?.[0]?.state).toBe("trial");
    expect(data?.[0]?.has_access).toBe(true);
    await expectAllowed(users.owner.db);
  });

  test("after the trial expires, the owner is read-only and the cashier is fully blocked", async () => {
    await setTrialStart(15 * day);
    const { data } = await users.owner.db.rpc("get_shop_billing", { _env: "sandbox" });
    expect(data?.[0]?.has_access).toBe(false);
    expect(data?.[0]?.state).toBe("trial_ended");
    await expectOwnerReadOnly(users.owner.db);
    await expectBlocked(users.cashier.db);
    // Shop context still resolves so the app can show the subscribe screen.
    const ctx = await users.cashier.db.rpc("get_my_shop_context");
    expect(ctx.data?.[0]?.member_role).toBe("cashier");
  });

  test("an active subscription restores access for the whole shop", async () => {
    await setSubscription("active", 30 * day);
    const { data } = await users.owner.db.rpc("get_shop_billing", { _env: "sandbox" });
    expect(data?.[0]?.has_access).toBe(true);
    await expectAllowed(users.owner.db);
    await expectAllowed(users.cashier.db);
  });

  test("a canceled subscription keeps access until the paid month ends, then blocks", async () => {
    await setSubscription("canceled", 5 * day);
    await expectAllowed(users.owner.db);
    await setSubscription("canceled", -day);
    await expectBlocked(users.owner.db);
    await expectBlocked(users.cashier.db);
  });

  test("browser users cannot write subscription rows themselves", async () => {
    const { error } = await users.owner.db.from("subscriptions").insert({
      user_id: users.owner.id, shop_id: shopId(), paddle_subscription_id: `forged_${run}`, paddle_customer_id: "x", product_id: "x", price_id: "x", status: "active",
    });
    expect(error).not.toBeNull();
    await expectBlocked(users.owner.db);
  });
});
