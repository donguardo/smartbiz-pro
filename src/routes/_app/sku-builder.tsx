import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Boxes, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { UNITS, fetchAllProducts, fetchShopContext, qk, type Unit } from "@/lib/store";
import { useShopProfile } from "@/lib/shop-profile";

export const Route = createFileRoute("/_app/sku-builder")({
  head: () => ({
    meta: [
      { title: "SKU Builder — MVP BizManager.ai" },
      { name: "description", content: "Pick ready-made products for your store and fill your storefront with SKUs in minutes." },
      { property: "og:title", content: "SKU Builder — MVP BizManager.ai" },
      { property: "og:description", content: "Pick ready-made products for your store and fill your storefront with SKUs in minutes." },
    ],
  }),
  component: SkuBuilder,
});

type Suggest = { name: string; price: number; unit: Unit };
const CATALOG: Record<string, Suggest[]> = {
  "Sari-sari store": [["Coke 1.5L", 75], ["Lucky Me Pancit Canton", 18], ["Bear Brand 33g", 15], ["Nescafé 3-in-1", 10], ["Skyflakes", 9], ["Safeguard bar", 38], ["Rice 1kg", 55, "kg"], ["Eggs", 9], ["Sardines 155g", 26], ["Load ₱50", 50, "service"]].map(s),
  "Coffee shop": [["Americano", 90], ["Café Latte", 120], ["Cappuccino", 120], ["Spanish Latte", 140], ["Iced Mocha", 145], ["Matcha Latte", 150], ["Croissant", 85], ["Cookie", 55]].map(s),
  "Café": [["Brewed Coffee", 80], ["Iced Tea", 70], ["Clubhouse Sandwich", 180], ["Pasta Carbonara", 220], ["Cheesecake slice", 150], ["Fries", 95]].map(s),
  "Restaurant": [["Chicken Adobo", 160], ["Pork Sinigang", 220], ["Sisig", 190], ["Plain Rice", 25], ["Garlic Rice", 35], ["Pancit Bihon", 180], ["Halo-halo", 120], ["Softdrinks", 45]].map(s),
  "Laundry": [["Wash-Dry-Fold 8kg", 180, "service"], ["Wash only", 70, "service"], ["Dry only", 70, "service"], ["Ironing per piece", 20, "service"], ["Comforter", 250, "service"], ["Detergent sachet", 15]].map(s),
  "Beauty parlor": [["Haircut", 120, "service"], ["Hair color", 650, "service"], ["Rebond", 1500, "service"], ["Manicure", 100, "service"], ["Pedicure", 120, "service"], ["Hair spa", 350, "service"]].map(s),
  "Bakery": [["Pandesal", 3], ["Ensaymada", 25], ["Spanish bread", 8], ["Monay", 6], ["Ube cake slice", 60], ["Loaf bread", 75]].map(s),
  "Pharmacy": [["Paracetamol 500mg", 5], ["Ibuprofen 200mg", 8], ["Cetirizine 10mg", 10], ["Vitamin C 500mg", 7], ["Face mask", 5], ["Alcohol 500ml", 85]].map(s),
  "Hardware": [["Common nails", 90, "kg"], ["PVC pipe ½in", 95], ["Paint 1L", 320], ["Electrical tape", 35], ["Hammer", 280], ["Cement 40kg", 260, "pack"]].map(s),
  "Grocery": [["Rice 5kg", 275, "pack"], ["Cooking oil 1L", 110], ["Sugar 1kg", 85, "kg"], ["Soy sauce 1L", 55], ["Canned corned beef", 48], ["Instant noodles", 15]].map(s),
};
function s(a: (string | number)[]): Suggest { return { name: String(a[0]), price: Number(a[1]), unit: (a[2] as Unit) ?? "pc" }; }

type Row = { key: string; name: string; price: string; stock: string; unit: Unit; category: string };
const input = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

function SkuBuilder() {
  const { t } = useT();
  const qc = useQueryClient();
  const { data: shop } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext });
  const { data: profile } = useShopProfile(shop?.shop_id);
  const { data: products = [] } = useQuery({ queryKey: qk.products, queryFn: fetchAllProducts });
  const storeCats = profile?.business_categories?.length ? profile.business_categories : [];
  const [cat, setCat] = useState<string>("");
  const activeCat = cat || storeCats.find((c) => CATALOG[c]) || Object.keys(CATALOG)[0]!;
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const existing = useMemo(() => new Set(products.filter((p) => !p.archived_at).map((p) => p.name.trim().toLowerCase())), [products]);

  if (shop && shop.member_role !== "owner") return <div className="p-6 text-muted-foreground">{t("stores.ownerOnly")}</div>;

  const has = (n: string) => rows.some((r) => r.name.trim().toLowerCase() === n.toLowerCase());
  const pick = (sg: Suggest) => {
    if (has(sg.name)) { setRows(rows.filter((r) => r.name.toLowerCase() !== sg.name.toLowerCase())); return; }
    setRows([...rows, { key: crypto.randomUUID(), name: sg.name, price: String(sg.price), stock: sg.unit === "service" ? "0" : "10", unit: sg.unit, category: activeCat }]);
  };
  const upd = (k: string, p: Partial<Row>) => setRows(rows.map((r) => (r.key === k ? { ...r, ...p } : r)));
  const errOf = (r: Row, i: number) => {
    if (!r.name.trim()) return t("wizard.err.pName");
    if (existing.has(r.name.trim().toLowerCase())) return t("sku.exists");
    if (rows.some((x, j) => j < i && x.name.trim().toLowerCase() === r.name.trim().toLowerCase())) return t("wizard.err.dup");
    if (!/^\d+(\.\d{1,2})?$/.test(r.price)) return t("wizard.err.priceInvalid");
    if (!/^\d+(\.\d{1,3})?$/.test(r.stock || "0")) return t("wizard.err.stock");
    return "";
  };
  const errs = rows.map(errOf);
  const ok = rows.length > 0 && errs.every((e) => !e);

  const save = async () => {
    if (!ok) { toast.error(t("wizard.err.fix")); return; }
    setBusy(true);
    const stamp = Date.now().toString(36).toUpperCase();
    const payload = rows.map((r, n) => ({
      name: r.name.trim().slice(0, 120), sku: `SKU-${stamp}-${n + 1}`, category: r.category.trim() || "General",
      price: Number(r.price), unit: r.unit, track_stock: r.unit !== "service",
      stock_qty: r.unit === "service" ? 0 : ["kg", "g", "L"].includes(r.unit) ? Number(r.stock || 0) : Math.round(Number(r.stock || 0)),
      reorder_level: 5, cost: null,
    }));
    const { error } = await supabase.from("products").insert(payload as never);
    setBusy(false);
    if (error) { toast.error(/limit|plan|upgrade/i.test(error.message) ? t("sku.limit") : error.message); return; }
    toast.success(t("sku.saved", { n: String(rows.length) }));
    setRows([]);
    await qc.invalidateQueries({ queryKey: qk.products });
    await qc.invalidateQueries({ queryKey: qk.usage });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-40 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Boxes className="h-6 w-6 text-primary" />{t("sku.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("sku.subtitle", { store: shop?.shop_name ?? "…", n: String(existing.size) })}</p>
        </div>
        <Link to="/stores" className="inline-flex items-center gap-1 text-sm text-muted-foreground underline"><ArrowLeft className="h-4 w-4" />{t("stores.title")}</Link>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-bold">{t("sku.step1")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(CATALOG).map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-full border px-3 py-1 text-sm ${c === activeCat ? "border-primary bg-primary/15 font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}>{c}{storeCats.includes(c) ? " ★" : ""}</button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {CATALOG[activeCat]!.map((sg) => {
            const inStore = existing.has(sg.name.toLowerCase());
            const sel = has(sg.name);
            return (
              <button key={sg.name} type="button" disabled={inStore} onClick={() => pick(sg)}
                className={`rounded-lg border p-3 text-left text-sm transition ${sel ? "border-primary bg-primary/15" : "border-border hover:bg-muted"} disabled:opacity-50`}>
                <span className="flex items-start justify-between gap-1 font-medium">{sg.name}{sel && <Check className="h-4 w-4 shrink-0 text-primary" />}</span>
                <span className="text-xs text-muted-foreground">{inStore ? t("sku.inStore") : `₱${sg.price} · ${sg.unit}`}</span>
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setRows([...rows, { key: crypto.randomUUID(), name: "", price: "", stock: "0", unit: "pc", category: activeCat }])}><Plus className="h-4 w-4" />{t("sku.custom")}</Button>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-bold">{t("sku.step2", { n: String(rows.length) })}</h2>
        {rows.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t("sku.empty")}</p> : (
          <div className="mt-3 space-y-3">
            {rows.map((r, i) => (
              <div key={r.key} className="rounded-lg border border-border p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                  <label className="col-span-2 text-xs sm:col-span-1">{t("wizard.pName")}<input value={r.name} maxLength={120} onChange={(e) => upd(r.key, { name: e.target.value })} className={input} /></label>
                  <label className="text-xs">{t("wizard.pPrice")}<input value={r.price} inputMode="decimal" onChange={(e) => upd(r.key, { price: e.target.value.replace(/[^\d.]/g, "") })} className={input} /></label>
                  <label className="text-xs">{t("wizard.pStock")}<input value={r.stock} disabled={r.unit === "service"} inputMode="decimal" onChange={(e) => upd(r.key, { stock: e.target.value.replace(/[^\d.]/g, "") })} className={input} /></label>
                  <label className="text-xs">{t("sku.unit")}<select value={r.unit} onChange={(e) => upd(r.key, { unit: e.target.value as Unit })} className={input}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
                  <button type="button" aria-label={t("showcase.remove")} onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className="mt-4 flex h-9 w-9 items-center justify-center rounded-md border border-border"><Trash2 className="h-4 w-4" /></button>
                </div>
                {errs[i] && <p role="alert" className="mt-1 text-xs text-destructive">{errs[i]}</p>}
              </div>
            ))}
          </div>
        )}
        <Button className="mt-4 w-full sm:w-auto" disabled={busy || rows.length === 0} onClick={save}><Check className="h-4 w-4" />{t("sku.save", { n: String(rows.length) })}</Button>
      </section>
    </div>
  );
}
