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

export async function loadSampleData() {
  const { error } = await supabase.rpc("seed_sample_store");
  if (error) throw error;
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
