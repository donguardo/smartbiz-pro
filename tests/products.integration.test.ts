/**
 * End-to-end database tests for products, fractional sales, cashier permissions,
 * stock adjustments and cross-shop isolation. Creates throwaway confirmed users,
 * runs every call through real signed-in clients (RLS applies), then deletes
 * the users and their shops.
 *
 * Run: bun test --timeout 30000 tests/products.integration.test.ts
 * Needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY.
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

const run = Date.now().toString(36);
const PASSWORD = `T3st-${run}-pw!`;
const users: Record<"owner" | "cashier" | "other", { id: string; email: string; db: DB }> = {} as never;
let admin: DB;
const ids: Record<string, string> = {};

async function makeUser(role: keyof typeof users) {
  const email = `qa-${role}-${run}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { owner_name: `QA ${role} owner`, mobile: "09171234567", business_type: "Sari-sari" } });
  if (error) throw error;
  const db = createClient<Database>(URL!, ANON!, opts(ANON!));
  const { error: e2 } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  await db.from("profiles").insert({ id: data.user.id, business_name: `QA ${role}` });
  users[role] = { id: data.user.id, email, db };
}
async function productsOf(db: DB) {
  const { data, error } = await db.rpc("get_shop_products_v2");
  if (error) throw error;
  return data;
}
const sell = (db: DB, items: { product_id: string; qty: number }[], tendered = 10000) =>
  db.rpc("record_sale", { _payment_method: "cash", _amount_tendered: tendered, _customer_id: null as unknown as string, _items: items });

describe.skipIf(!enabled)("products A to Z", () => {
  beforeAll(async () => {
    admin = createClient<Database>(URL!, SERVICE!, opts(SERVICE!));
    await makeUser("owner"); await makeUser("cashier"); await makeUser("other");
    for (const r of ["owner", "other"] as const) {
      const { error } = await users[r].db.rpc("ensure_my_shop", { _business_name: `QA ${r} shop` });
      if (error) throw error;
    }
  }, 60000);

  afterAll(async () => {
    if (!admin) return;
    for (const u of Object.values(users)) {
      await admin.rpc("delete_account_data", { _user_id: u.id, _user_hash: `qa-${run}` });
      await admin.auth.admin.deleteUser(u.id);
    }
  }, 60000);

  test("owner adds Sticker, Haircut and Rice; a forged shop_id is ignored", async () => {
    const { owner, other } = users;
    const rows = [
      { name: "Sticker", price: 25, cost: 10, unit: "pc", track_stock: true, stock_qty: 100, shop_id: other.id },
      { name: "Haircut", price: 120, unit: "service", track_stock: false, category: "Services" },
      { name: "Rice", price: 52, cost: 45, unit: "kg", track_stock: true, stock_qty: 50 },
    ];
    const { error } = await owner.db.from("products").insert(rows);
    expect(error).toBeNull();
    const list = await productsOf(owner.db);
    expect(list.map((p) => p.name)).toEqual(["Haircut", "Rice", "Sticker"]); // A to Z
    for (const p of list) { ids[p.name] = p.id; expect(p.shop_id).toBe(owner.id); }
    expect(Number(list.find((p) => p.name === "Haircut")!.stock)).toBe(0);
    expect(list.find((p) => p.name === "Haircut")!.cost).toBeNull(); // blank cost stays unknown
    const { data: shop } = await owner.db.from("shops").select("owner_name,mobile,business_type").eq("id", owner.id).single();
    expect(shop).toEqual({ owner_name: "QA owner owner", mobile: "09171234567", business_type: "Sari-sari" });
  });

  test("a brand-new member-less user gets their own new shop as Owner", async () => {
    const { data } = await users.other.db.rpc("get_my_shop_context");
    expect(data![0]!.member_role).toBe("owner");
    expect(data![0]!.shop_id).toBe(users.other.id);
  });

  test("selling 1.5 kg Rice charges ₱78 on the server and leaves 48.5 kg", async () => {
    const { owner } = users;
    const { data, error } = await sell(owner.db, [{ product_id: ids["Rice"]!, qty: 1.5 }], 78);
    expect(error).toBeNull();
    const { data: sale } = await owner.db.from("sales").select("total").eq("id", data![0]!.sale_id).single();
    expect(Number(sale!.total)).toBe(78);
    const rice = (await productsOf(owner.db)).find((p) => p.name === "Rice")!;
    expect(Number(rice.stock)).toBe(48.5);
  });

  test("Haircut sells without stock; Sticker rejects fractional quantity; low cash is refused", async () => {
    const { owner } = users;
    const { error: e1 } = await sell(owner.db, [{ product_id: ids["Haircut"]!, qty: 1 }], 120);
    expect(e1).toBeNull();
    expect(Number((await productsOf(owner.db)).find((p) => p.name === "Haircut")!.stock)).toBe(0);
    const { error: e2 } = await sell(owner.db, [{ product_id: ids["Sticker"]!, qty: 1.5 }]);
    expect(e2?.message).toContain("Whole quantities");
    const { error: e3 } = await sell(owner.db, [{ product_id: ids["Sticker"]!, qty: 2 }], 10);
    expect(e3?.message).toContain("too low");
    const { error: e4 } = await sell(owner.db, [{ product_id: ids["Sticker"]!, qty: 1000 }]);
    expect(e4?.message).toBe("Not enough stock: Sticker (100 left)");
  });

  test("owner stock adjustments are recorded with reason and history", async () => {
    const { owner } = users;
    expect((await owner.db.rpc("adjust_stock", { _product_id: ids["Rice"]!, _kind: "restock", _qty: 1.5, _reason: "Supplier delivery" })).data).toBe(50);
    expect((await owner.db.rpc("adjust_stock", { _product_id: ids["Sticker"]!, _kind: "loss", _qty: 3, _reason: "Damaged" })).data).toBe(97);
    expect((await owner.db.rpc("adjust_stock", { _product_id: ids["Sticker"]!, _kind: "correction", _qty: 95, _reason: "Physical count" })).data).toBe(95);
    expect((await owner.db.rpc("adjust_stock", { _product_id: ids["Sticker"]!, _kind: "loss", _qty: 500, _reason: "Too much" })).error?.message).toContain("below 0");
    expect((await owner.db.rpc("adjust_stock", { _product_id: ids["Haircut"]!, _kind: "restock", _qty: 1, _reason: "Nope" })).error).not.toBeNull();
    const { data: history } = await owner.db.from("stock_movements").select("kind,qty_change,stock_after,reason").order("created_at");
    expect(history!.map((h) => [h.kind, Number(h.qty_change), Number(h.stock_after)])).toEqual([["restock", 1.5, 50], ["loss", -3, 97], ["correction", -2, 95]]);
  });

  test("cashier cannot add products until the owner allows it, and never deletes or adjusts", async () => {
    const { owner, cashier } = users;
    const { data: inv } = await owner.db.rpc("create_shop_invite", { _email: cashier.email });
    expect((await cashier.db.rpc("accept_shop_invite", { _code: inv![0]!.code })).error).toBeNull();

    expect((await cashier.db.from("products").insert({ name: "Cashier Pen", price: 10 })).error).not.toBeNull();
    expect((await cashier.db.rpc("update_product", { _id: ids["Sticker"]!, _data: { price: 1 } })).error).not.toBeNull();

    expect((await owner.db.from("shops").update({ allow_cashier_products: true }).eq("id", owner.id)).error).toBeNull();
    expect((await cashier.db.from("products").insert({ name: "Cashier Pen", price: 10, stock_qty: 5 })).error).toBeNull();
    expect((await cashier.db.rpc("update_product", { _id: ids["Sticker"]!, _data: { price: 26, cost: 0 } })).error).toBeNull();
    const sticker = (await productsOf(owner.db)).find((p) => p.name === "Sticker")!;
    expect(Number(sticker.price)).toBe(26);
    expect(Number(sticker.cost)).toBe(10); // cashier cannot change cost
    expect((await productsOf(cashier.db)).every((p) => p.cost === null)).toBe(true);

    expect((await cashier.db.rpc("remove_product", { _id: ids["Sticker"]! })).error).not.toBeNull();
    expect((await cashier.db.from("products").delete().eq("id", ids["Sticker"]!).select()).data ?? []).toHaveLength(0);
    expect((await cashier.db.rpc("adjust_stock", { _product_id: ids["Rice"]!, _kind: "restock", _qty: 1, _reason: "Sneaky" })).error).not.toBeNull();
    expect((await cashier.db.from("stock_movements").select("id")).data).toHaveLength(0);

    // sales permissions unchanged: cashier can sell but not void
    const { data: sale, error } = await sell(cashier.db, [{ product_id: ids["Rice"]!, qty: 0.25 }]);
    expect(error).toBeNull();
    expect((await cashier.db.rpc("void_sale", { _sale_id: sale![0]!.sale_id })).error).not.toBeNull();
    expect((await owner.db.rpc("void_sale", { _sale_id: sale![0]!.sale_id })).error).toBeNull();

    await owner.db.from("shops").update({ allow_cashier_products: false }).eq("id", owner.id);
    expect((await cashier.db.from("products").insert({ name: "Blocked again", price: 1 })).error).not.toBeNull();
  }, 30000);

  test("another shop cannot see or touch these products", async () => {
    const { other } = users;
    expect(await productsOf(other.db)).toHaveLength(0);
    expect((await other.db.from("products").select("id")).data).toHaveLength(0);
    expect((await other.db.rpc("update_product", { _id: ids["Rice"]!, _data: { price: 1 } })).error).not.toBeNull();
    expect((await other.db.rpc("remove_product", { _id: ids["Rice"]! })).error).not.toBeNull();
    expect((await other.db.rpc("adjust_stock", { _product_id: ids["Rice"]!, _kind: "loss", _qty: 1, _reason: "Hack" })).error).not.toBeNull();
    expect((await sell(other.db, [{ product_id: ids["Rice"]!, qty: 1 }])).error).not.toBeNull();
    expect((await other.db.from("stock_movements").select("id")).data).toHaveLength(0);
  });
  test("low-stock alerts reach owners only, respect the toggle, and history filters by product and date", async () => {
    const { owner, cashier, other } = users;
    expect((await owner.db.rpc("adjust_stock", { _product_id: ids["Sticker"]!, _kind: "loss", _qty: 91, _reason: "Water damage" })).data).toBe(4);
    const { data: alerts } = await owner.db.from("stock_alerts").select("id,product_name,stock_at,threshold").is("read_at", null).eq("product_id", ids["Sticker"]!);
    expect(alerts!.map((a) => [a.product_name, Number(a.stock_at), Number(a.threshold)])).toEqual([["Sticker", 4, 5]]);
    expect((await cashier.db.from("stock_alerts").select("id")).data).toHaveLength(0);
    expect((await other.db.from("stock_alerts").select("id")).data).toHaveLength(0);
    // no duplicate while unread
    await owner.db.rpc("adjust_stock", { _product_id: ids["Sticker"]!, _kind: "loss", _qty: 1, _reason: "Damaged" });
    expect((await owner.db.from("stock_alerts").select("id").is("read_at", null).eq("product_id", ids["Sticker"]!)).data).toHaveLength(1);
    expect((await owner.db.from("stock_alerts").update({ read_at: new Date().toISOString() }).eq("id", alerts![0]!.id)).error).toBeNull();
    // toggle off: crossing again raises nothing
    await owner.db.from("shops").update({ low_stock_alerts: false }).eq("id", owner.id);
    await owner.db.rpc("adjust_stock", { _product_id: ids["Sticker"]!, _kind: "correction", _qty: 50, _reason: "Physical count" });
    await owner.db.rpc("adjust_stock", { _product_id: ids["Sticker"]!, _kind: "correction", _qty: 2, _reason: "Physical count" });
    expect((await owner.db.from("stock_alerts").select("id").is("read_at", null).eq("product_id", ids["Sticker"]!)).data).toHaveLength(0);
    // export filters
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const { data: rice } = await owner.db.from("stock_movements").select("product_name").eq("product_id", ids["Rice"]!).gte("created_at", `${today}T00:00:00+08:00`).lte("created_at", `${today}T23:59:59.999+08:00`);
    expect(rice!.every((r) => r.product_name === "Rice") && rice!.length).toBe(1);
    expect((await owner.db.from("stock_movements").select("id").lt("created_at", "2000-01-01T00:00:00+08:00")).data).toHaveLength(0);
  }, 30000);
});
