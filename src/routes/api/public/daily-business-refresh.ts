import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/daily-business-refresh")({
  server: { handlers: { POST: async ({ request }) => {
    const rejected = await authenticateCronRequest(request);
    if (rejected) return rejected;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run } = await supabaseAdmin.from("refresh_runs").insert({ job: "daily-business-refresh" }).select("id").single();
    const finish = async (status: "success" | "error", error: string | null, shopsProcessed = 0) => {
      if (run) await supabaseAdmin.from("refresh_runs").update({ status, error, shops_processed: shopsProcessed, finished_at: new Date().toISOString() }).eq("id", run.id);
    };
    try {
    const { error: forecastError } = await supabaseAdmin.rpc("refresh_all_forecasts");
    if (forecastError) { await finish("error", "Forecast refresh failed"); return new Response("Forecast refresh failed", { status: 500 }); }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const { data: shops, error: shopsError } = await supabaseAdmin.from("shops").select("id,language");
    if (shopsError) { await finish("error", "Could not load shops"); return new Response("Shop refresh failed", { status: 500 }); }
    for (const shop of shops) {
      const [{ data: products }, { data: items }, { data: goals }, { data: forecasts }, { data: customers }, { data: expenses }] = await Promise.all([
        supabaseAdmin.from("products").select("id,name,stock,reorder_level,cost").eq("shop_id", shop.id),
        supabaseAdmin.from("sale_items").select("product_id,name,qty,created_at").eq("shop_id", shop.id).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabaseAdmin.from("sales_goals").select("period,target_amount").eq("shop_id", shop.id),
        supabaseAdmin.from("sales_forecasts").select("expected_sales").eq("shop_id", shop.id).limit(7),
        supabaseAdmin.from("customers").select("id").eq("shop_id", shop.id).not("anonymized_at", "is", null),
        supabaseAdmin.from("expenses").select("amount").eq("shop_id", shop.id).gte("date", `${today.slice(0, 7)}-01`),
      ]);
      const sold = new Map<string, number>(); for (const item of items ?? []) if (item.product_id) sold.set(item.product_id, (sold.get(item.product_id) ?? 0) + item.qty);
      const low = (products ?? []).filter((p) => p.stock <= p.reorder_level); const dead = (products ?? []).filter((p) => p.stock > 0 && !sold.has(p.id)); const over = (products ?? []).filter((p) => { const daily = (sold.get(p.id) ?? 0) / 30; return daily > 0 && p.stock / daily > 60; });
      const expected = (forecasts ?? []).reduce((sum, row) => sum + Number(row.expected_sales), 0); const expenseTotal = (expenses ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
      const fallback = shop.language === "tl" ? `Boss, ${low.length} item ang paubos at ${over.length} ang sobra ang stock. ${low.length ? "Mag-reorder ngayon." : over.length ? "Subukan ang promo o bundle." : "I-check ang target mo ngayong araw."}` : `${low.length} items are running low and ${over.length} are overstocked. ${low.length ? "Reorder today." : over.length ? "Try a promo or bundle." : "Check today's sales goal."}`;
      const safeSummary = { expected_next_7_days: expected, goals: goals ?? [], low_stock_products: low.map((p) => p.name), dead_stock_products: dead.map((p) => p.name), overstock_products: over.map((p) => p.name), inactive_customer_count: customers?.length ?? 0, expenses_this_month: expenseTotal };
      const productTotals = new Map<string, number>(); for (const item of items ?? []) productTotals.set(item.name, (productTotals.get(item.name) ?? 0) + item.qty); const bestProducts = [...productTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
      const weekStart = new Date(); weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
      await supabaseAdmin.from("weekly_opportunities").upsert({ shop_id: shop.id, week_start: weekStart.toISOString().slice(0, 10), best_products: bestProducts, best_days: [], fastest_growing_product: bestProducts[0] ?? null, summary_en: bestProducts.length ? `${bestProducts[0]?.name ?? "Your top item"} led sales. Keep it visible and stocked this week.` : "Keep recording sales to reveal this week's best opportunity.", summary_tl: bestProducts.length ? `${bestProducts[0]?.name ?? "Ang top item mo"} ang nanguna sa benta. Panatilihing kita at may stock ngayong linggo.` : "Patuloy na mag-record ng benta para makita ang pinakamagandang oportunidad ngayong linggo." }, { onConflict: "shop_id,week_start" });
      let tip = fallback;
      try {
        const key = process.env['LOVABLE_API_KEY']; if (key) { const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", "authorization": `Bearer ${key}`, "Lovable-API-Key": key }, body: JSON.stringify({ model: "openai/gpt-5-mini", messages: [{ role: "system", content: `Write one ${shop.language === "tl" ? "natural Taglish" : "English"} business tip, maximum 2 short sentences, with one action. Say forecast numbers are estimates. Never invent data.` }, { role: "user", content: JSON.stringify(safeSummary) }] }) }); const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> }; tip = json.choices?.[0]?.message?.content?.slice(0, 500) || fallback; }
      } catch { tip = fallback; }
      await supabaseAdmin.from("daily_tips").upsert({ shop_id: shop.id, tip_date: today, tip_text: tip, language: shop.language }, { onConflict: "shop_id,tip_date", ignoreDuplicates: true });
    }
    await finish("success", null, shops.length);
    return Response.json({ ok: true, shops: shops.length });
    } catch (e) {
      await finish("error", (e instanceof Error ? e.message : "Unknown error").slice(0, 300));
      return new Response("Refresh failed", { status: 500 });
    }
  } } },
});