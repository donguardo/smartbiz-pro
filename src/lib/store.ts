import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Sale = Database["public"]["Tables"]["sales"]["Row"];
export type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"];
export type ShopContext = Database["public"]["Functions"]["get_my_shop_context"]["Returns"][number];
export type CustomerChoice = Database["public"]["Functions"]["get_masked_customers"]["Returns"][number];

export const qk = { products: ["products"], sales: ["sales"], items: ["sale_items"], profile: ["profile"], shop: ["shop-context"], customers: ["customers-masked"], goals: ["sales-goals"], forecasts: ["sales-forecasts"], tip: ["daily-tip"], cashierToday: ["cashier-today"] };

export async function fetchProducts() {
  const { data, error } = await supabase.rpc("get_shop_products");
  if (error) throw error;
  return data.map((p) => ({ ...p, cost: Number(p.cost ?? 0), user_id: "" })) as Product[];
}
export async function fetchSales() {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data, error } = await supabase.from("sales").select("*").gte("created_at", since).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function fetchItems() {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data, error } = await supabase.from("sale_items").select("*").gte("created_at", since);
  if (error) throw error;
  return data;
}
export async function fetchProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
  if (data) { await supabase.rpc("ensure_my_shop", { _business_name: data.business_name }); return data; }
  const business_name = (u.user.user_metadata?.['business_name'] as string) || "My Store";
  const { data: created } = await supabase.from("profiles").insert({ id: u.user.id, business_name }).select().single();
  if (created) await supabase.rpc("ensure_my_shop", { _business_name: created.business_name });
  return created;
}

export async function fetchShopContext() { const { data, error } = await supabase.rpc("get_my_shop_context"); if (error) throw error; return data[0] ?? null; }
export async function fetchCustomers() { const { data, error } = await supabase.rpc("get_masked_customers"); if (error) throw error; return data; }
export async function fetchGoals() { const { data, error } = await supabase.from("sales_goals").select("*").order("period"); if (error) throw error; return data; }
export async function fetchForecasts() { const { data, error } = await supabase.from("sales_forecasts").select("*").gte("forecast_date", new Date().toISOString().slice(0, 10)).order("forecast_date"); if (error) throw error; return data; }
export async function fetchDailyTip() { const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()); const { data, error } = await supabase.from("daily_tips").select("*").eq("tip_date", today).maybeSingle(); if (error) throw error; return data; }
export async function fetchCashierToday() { const { data, error } = await supabase.rpc("get_cashier_today_summary"); if (error) throw error; return data[0] ?? { today_total: 0, sale_count: 0 }; }

export const SAMPLE_PRODUCTS = [
  { name: "Coca-Cola 1.5L", sku: "4801981116072", category: "Beverages", price: 75, cost: 58, stock: 6, reorder_level: 12 },
  { name: "Nescafé 3-in-1 (10s)", sku: "4800361386553", category: "Beverages", price: 85, cost: 66, stock: 30, reorder_level: 10 },
  { name: "Bottled Water 500ml", sku: "4800016644201", category: "Beverages", price: 20, cost: 11, stock: 80, reorder_level: 24 },
  { name: "Piattos Cheese 85g", sku: "4800016555101", category: "Snacks", price: 35, cost: 24, stock: 40, reorder_level: 15 },
  { name: "SkyFlakes Crackers", sku: "4800092110010", category: "Snacks", price: 48, cost: 34, stock: 3, reorder_level: 10 },
  { name: "Lucky Me Pancit Canton", sku: "4807770270017", category: "Snacks", price: 18, cost: 12, stock: 120, reorder_level: 30 },
  { name: "Safeguard Bar 135g", sku: "4800888141125", category: "Personal care", price: 48, cost: 36, stock: 22, reorder_level: 8 },
  { name: "Colgate 150ml", sku: "8850006330418", category: "Personal care", price: 115, cost: 88, stock: 14, reorder_level: 6 },
  { name: "Joy Dishwashing 250ml", sku: "4800888170019", category: "Household", price: 62, cost: 45, stock: 18, reorder_level: 6 },
  { name: "Tide Powder 1kg", sku: "4800888200011", category: "Household", price: 165, cost: 128, stock: 25, reorder_level: 5 },
  { name: "Scented Candles Set", sku: "SKU-CANDLE-01", category: "Household", price: 250, cost: 140, stock: 15, reorder_level: 3 },
];

export async function loadSampleData() {
  const { data: products, error } = await supabase.from("products").insert(SAMPLE_PRODUCTS).select();
  if (error) throw error;
  // generate 21 days of sample sales (candles never sell → dead stock)
  const sellable = products.filter((p) => !p.sku.startsWith("SKU-CANDLE"));
  for (let d = 20; d >= 0; d--) {
    const n = 3 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const picks = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => sellable[Math.floor(Math.random() * sellable.length)]!);
      const items = picks.map((p) => ({ p, qty: 1 + Math.floor(Math.random() * 3) }));
      const total = items.reduce((s, i) => s + Number(i.p.price) * i.qty, 0);
      const cost_total = items.reduce((s, i) => s + Number(i.p.cost) * i.qty, 0);
      const at = new Date(Date.now() - d * 86400000 - Math.random() * 36000000).toISOString();
      const method = (["cash", "ewallet", "card"] as const)[Math.floor(Math.random() * 3)]!;
      const { data: sale, error: e1 } = await supabase.from("sales")
        .insert({ receipt_no: `S-${Date.now().toString(36).toUpperCase()}${k}`, total, cost_total, payment_method: method, created_at: at })
        .select().single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("sale_items").insert(
        items.map((i) => ({ sale_id: sale.id, product_id: i.p.id, name: i.p.name, category: i.p.category, qty: i.qty, price: i.p.price, cost: i.p.cost, created_at: at })),
      );
      if (e2) throw e2;
    }
  }
}

export type Insight = { kind: "reorder" | "dead" | "overstock" | "top"; title: string; detail: string; product?: Product };

export function computeInsights(products: Product[], items: SaleItem[]): Insight[] {
  const now = Date.now();
  const sold14 = new Map<string, number>();
  const sold30 = new Map<string, number>();
  const lastSold = new Map<string, number>();
  for (const it of items) {
    if (!it.product_id) continue;
    const t = new Date(it.created_at).getTime();
    if (now - t <= 14 * 86400000) sold14.set(it.product_id, (sold14.get(it.product_id) ?? 0) + it.qty);
    if (now - t <= 30 * 86400000) sold30.set(it.product_id, (sold30.get(it.product_id) ?? 0) + it.qty);
    lastSold.set(it.product_id, Math.max(lastSold.get(it.product_id) ?? 0, t));
  }
  const out: Insight[] = [];
  for (const p of products) {
    const daily = (sold14.get(p.id) ?? 0) / 14;
    const daysLeft = daily > 0 ? p.stock / daily : Infinity;
    if (p.stock <= p.reorder_level || daysLeft < 5) {
      const qty = Math.max(p.reorder_level * 2 - p.stock, Math.ceil(daily * 14) - p.stock, 1);
      out.push({
        kind: "reorder", product: p,
        title: `Reorder ${p.name}`,
        detail: `${p.stock} left${Number.isFinite(daysLeft) ? ` · ~${Math.max(0, Math.floor(daysLeft))} days of stock` : ""}. Suggest ordering ${qty} units.`,
      });
    }
    const last = lastSold.get(p.id);
    const ageDays = (now - new Date(p.created_at).getTime()) / 86400000;
    if (p.stock > 0 && (!last ? ageDays >= 0 && (sold14.get(p.id) ?? 0) === 0 : now - last > 21 * 86400000)) {
      out.push({
        kind: "dead", product: p,
        title: `${p.name} isn't selling`,
        detail: `No sales in the last ${last ? Math.floor((now - last) / 86400000) : 14}+ days · ₱${(Number(p.cost) * p.stock).toFixed(0)} tied up in stock. Consider a promo or bundle.`,
      });
    }
    const daily30 = (sold30.get(p.id) ?? 0) / 30;
    const supply = daily30 > 0 ? p.stock / daily30 : Infinity;
    if (daily30 > 0 && supply > 60) out.push({ kind: "overstock", product: p, title: `Too much ${p.name}`, detail: `${Math.round(supply)} days of supply · ₱${(Number(p.cost) * p.stock).toFixed(0)} tied up. Try a promo or order less next time.` });
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "reorder" ? -1 : 1));
}
