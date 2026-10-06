import { supabase } from "@/integrations/supabase/client";
import { buildZip, toCsv } from "@/lib/csv-zip";

const TABLES = ["products", "sales", "sale_items", "customers", "expenses", "suppliers"] as const;
const PAGE = 1000;

// Owner-only export for locked shops: reads tables directly (RLS lets the owner read
// their own shop even without an active subscription). Never uses current_shop_id() RPCs.
export async function downloadShopData(): Promise<void> {
  const { data: ctx, error: ctxErr } = await supabase.rpc("get_my_shop_context");
  if (ctxErr) throw ctxErr;
  const shopId = ctx?.[0]?.shop_id;
  if (!shopId) throw new Error("No shop found");

  const files: { name: string; content: string }[] = [];
  for (const table of TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(table).select("*").eq("shop_id", shopId).range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data as Record<string, unknown>[]));
      if (!data || data.length < PAGE) break;
    }
    files.push({ name: `${table}.csv`, content: toCsv(rows) });
  }
  const blob = buildZip(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mvp-bizmanager-data-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
