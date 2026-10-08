import type { SupabaseClient } from "@supabase/supabase-js";

// Builds BIZBOT's store facts with the signed-in user's client only, so RLS applies. Never use supabaseAdmin here.
export async function buildStoreContext(client: SupabaseClient): Promise<string> {
  try {
    const { data: shops, error: shopError } = await client.rpc("get_my_shop_context");
    if (shopError) return "";
    const shop = (shops as Array<{ shop_id: string; member_role: string }> | null)?.[0];
    const shopId = shop?.shop_id;
    const role = shop?.member_role;
    if (!shopId) return "";
    const isOwner = role === "owner";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const empty = Promise.resolve({ data: null, error: null });

    const [productsRes, salesRes, goalsRes, forecastsRes, tipRes, customersRes] = await Promise.all([
      client.rpc("get_shop_products_v2"),
      isOwner
        ? client.from("sales").select("total,cost_total,payment_method,created_at").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(200)
        : empty,
      isOwner ? client.from("sales_goals").select("period,target_amount").eq("shop_id", shopId) : empty,
      isOwner
        ? client.from("sales_forecasts").select("forecast_date,expected_sales").eq("shop_id", shopId).gte("forecast_date", today).order("forecast_date").limit(30)
        : empty,
      client.from("daily_tips").select("tip_text").eq("shop_id", shopId).eq("tip_date", today).maybeSingle(),
      client.rpc("get_masked_customers"),
    ]);

    type ProductRow = { shop_id: string | null; name: string; category: string; price: number; cost: number | null; stock: number; reorder_level: number; archived_at: string | null };
    const productRows = productsRes.error ? [] : ((productsRes.data as ProductRow[] | null) ?? []);
    let products = productRows
      .filter((p) => !p.archived_at && (p.shop_id == null || p.shop_id === shopId))
      .slice(0, 80)
      .map((p) => ({ name: p.name, category: p.category, price: p.price, stock: p.stock, reorderLevel: p.reorder_level, ...(isOwner ? { cost: p.cost } : {}) }));
    let recentSales = salesRes.error ? [] : ((salesRes.data as unknown[] | null) ?? []);
    const goals = goalsRes.error ? [] : ((goalsRes.data as unknown[] | null) ?? []);
    const forecasts = forecastsRes.error ? [] : ((forecastsRes.data as unknown[] | null) ?? []);
    const dailyTip = tipRes.error ? null : ((tipRes.data as { tip_text: string } | null)?.tip_text ?? null);
    const customerCount = customersRes.error ? 0 : ((customersRes.data as unknown[] | null)?.length ?? 0);
    const generatedAt = new Date().toISOString();

    const build = () => JSON.stringify({ generatedAt, role, products, recentSales, goals, forecasts, dailyTip, customerCount });
    let out = build();
    if (out.length > 40_000) {
      recentSales = recentSales.slice(0, 50);
      products = products.slice(0, 40);
      out = build();
    }
    return out;
  } catch {
    return "";
  }
}
