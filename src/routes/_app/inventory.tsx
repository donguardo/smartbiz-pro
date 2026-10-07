import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowUpDown, Download, ImagePlus, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UNITS, computeInsights, fetchAllProducts, fetchItems, fetchProductSettings, fetchShopContext, fetchMyPlan, fetchMyUsage, isDecimalUnit, qk, type Product, type Unit } from "@/lib/store";
import { LowStockSettings } from "@/components/StockAlerts";
import { StockAdjustDialog, StockHistoryPanel } from "@/components/StockAdjust";
import { SAMPLE_CSV, parseProductCsv, type CsvRow } from "@/lib/product-csv";
import { peso } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { BrandAdSlot, UpgradeSheet, isUpgradeError } from "@/components/UpgradeSheet";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({ meta: [
    { title: "Products — MVP BizManager" },
    { name: "description", content: "Add, edit, import and organize your products and services A to Z." },
    { property: "og:title", content: "Products — MVP BizManager" },
    { property: "og:description", content: "Add, edit, import and organize your products and services A to Z." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Inventory,
});

type Form = { id?: string; name: string; sku: string; category: string; newCategory: string; price: string; cost: string; unit: Unit; track: boolean; stock: string; reorder_level: string; photo_path: string | null; file?: File | null };
const empty: Form = { name: "", sku: "", category: "General", newCategory: "", price: "", cost: "", unit: "pc", track: true, stock: "0", reorder_level: "5", photo_path: null };
type SortKey = "name" | "price" | "stock";
const NEW_CAT = "__new__";

async function signPhotos(paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from("product-photos").createSignedUrls(paths, 3600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
}

function Inventory() {
  const qc = useQueryClient();
  const { data: all = [] } = useQuery({ queryKey: [...qk.products, "all"], queryFn: fetchAllProducts });
  const { data: items = [] } = useQuery({ queryKey: qk.items, queryFn: fetchItems });
  const { data: shop } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext });
  const { data: settings } = useQuery({ queryKey: qk.productSettings, queryFn: fetchProductSettings });
  const photoPaths = all.map((p) => p.photo_path).filter((p): p is string => !!p);
  const { data: photos = {} } = useQuery({ queryKey: ["product-photos", photoPaths], queryFn: () => signPhotos(photoPaths), enabled: photoPaths.length > 0, staleTime: 30 * 60000 });
  const { t } = useT();
  const { data: usage } = useQuery({ queryKey: qk.usage, queryFn: fetchMyUsage });
  const { data: plan } = useQuery({ queryKey: qk.plan, queryFn: fetchMyPlan });
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState<SortKey>("name");
  const [filter, setFilter] = useState<"all" | "low" | "overstock" | "archived">("all");
  const [csv, setCsv] = useState<CsvRow[] | null>(null);
  const owner = shop?.member_role === "owner";
  const canEdit = owner || !!settings?.can_edit;
  const products = all.filter((p) => !p.archived_at);
  const insights = useMemo(() => computeInsights(products, items), [products, items]);
  const flag = (id: string) => insights.filter((i) => i.product?.id === id).map((i) => i.kind);
  const value = products.reduce((s, p) => s + (p.track_stock && p.cost != null ? p.cost * p.stock : 0), 0);
  const noCost = products.filter((p) => p.cost == null).length;
  const [extraCats, setExtraCats] = useState<string[]>([]);
  const categories = [...new Set([...all.map((p) => p.category), ...extraCats])].sort((a, b) => a.localeCompare(b));
  const refresh = () => { qc.invalidateQueries({ queryKey: qk.usage }); qc.invalidateQueries({ queryKey: qk.plan }); return qc.refetchQueries({ queryKey: qk.products }); };

  const toggleCashiers = async () => {
    if (!shop) return;
    const { error } = await supabase.from("shops").update({ allow_cashier_products: !settings?.allow_cashier_products }).eq("id", shop.shop_id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: qk.productSettings });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !shop) return;
    const category = (form.category === NEW_CAT ? form.newCategory : form.category).trim() || "General";
    const stock = form.track ? Number(form.stock || 0) : 0;
    if (form.track && !isDecimalUnit(form.unit) && !Number.isInteger(stock)) { toast.error("Decimals are only allowed for kg, g or L"); return; }
    setBusy(true);
    try {
      let photo_path = form.photo_path;
      if (form.file) {
        const path = `${shop.shop_id}/${crypto.randomUUID()}.${form.file.type === "image/png" ? "png" : "jpg"}`;
        const { error } = await supabase.storage.from("product-photos").upload(path, form.file, { contentType: form.file.type });
        if (error) throw error;
        photo_path = path;
      }
      const row = { name: form.name.trim(), sku: form.sku.trim(), category, price: Number(form.price), unit: form.unit, track_stock: form.track, stock_qty: stock, reorder_level: Math.round(Number(form.reorder_level || 0)), photo_path, ...(owner ? { cost: form.cost.trim() === "" ? null : Number(form.cost) } : {}) };
      const { error } = form.id
        ? await supabase.rpc("update_product", { _id: form.id, _data: row })
        : await supabase.from("products").insert({ ...row, cost: owner ? (form.cost.trim() === "" ? null : Number(form.cost)) : null });
      if (error && isUpgradeError(error)) { setForm(null); setUpgradeMsg(error.message); return; }
      if (error) throw new Error(error.message.includes("products_shop_sku_unique") ? "That SKU/barcode is already used in your shop" : error.message);
      toast.success(form.id ? "Product updated" : "Product added");
      await refresh(); setExtraCats((c) => (c.includes(category) ? c : [...c, category])); setForm(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not save"); } finally { setBusy(false); }
  };
  const del = async (p: Product) => {
    if (!confirm(`Delete ${p.name}? If it already has sales it will be archived instead.`)) return;
    const { data, error } = await supabase.rpc("remove_product", { _id: p.id });
    if (error) { toast.error(error.message); return; }
    if (data === "archived") qc.invalidateQueries({ queryKey: qk.usage });
    toast.success(data === "archived" ? `${p.name} archived — hidden from Register, kept in reports` : `${p.name} deleted`);
    refresh();
  };
  const restore = async (p: Product) => {
    const { error } = await supabase.from("products").update({ archived_at: null }).eq("id", p.id);
    if (error && isUpgradeError(error)) { setUpgradeMsg(error.message); return; }
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const onCsv = async (file: File) => setCsv(parseProductCsv(await file.text(), new Set(all.filter((p) => p.sku).map((p) => p.sku.toLowerCase()))));
  const importCsv = async () => {
    const rows = csv?.flatMap((r) => (r.data ? [r.data] : [])) ?? [];
    if (!rows.length) return;
    setBusy(true);
    const { error } = await supabase.from("products").insert(rows.map((r) => ({ ...r, cost: owner ? r.cost : null })));
    setBusy(false);
    if (error && isUpgradeError(error)) { setCsv(null); setUpgradeMsg(error.message); return; }
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} products imported`); setCsv(null); refresh();
  };
  const downloadSample = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
    a.download = "products-sample.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  const shown = (filter === "archived" ? all.filter((p) => p.archived_at) : products)
    .filter((p) => (cat === "All" || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())))
    .filter((p) => filter === "low" ? flag(p.id).includes("reorder") : filter === "overstock" ? flag(p.id).includes("overstock") : true)
    .sort((a, b) => sort === "price" ? a.price - b.price : sort === "stock" ? (a.track_stock ? a.stock : Infinity) - (b.track_stock ? b.stock : Infinity) : a.name.localeCompare(b.name));

  const importRows = csv?.filter((r) => r.data).length ?? 0;
  const importTotal = (usage?.active_products ?? 0) + importRows;
  const overCap = usage?.max_skus != null && importTotal > usage.max_skus;

  const input = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";
  const set = (patch: Partial<Form>) => setForm((f) => f && { ...f, ...patch });

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{products.length} products{owner && ` · ${peso(value)} at cost`}{owner && noCost > 0 && ` · ${noCost} product${noCost === 1 ? " has" : "s have"} no cost`}</p>
          <h1 className="text-3xl font-bold">Products</h1>
        </div>
        {canEdit && <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"><Upload className="h-4 w-4" /> Import CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsv(f); e.target.value = ""; }} /></label>
          <button onClick={() => (usage?.at_limit ? setUpgradeMsg(t("upgrade.nearLimit")) : setForm(empty))} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add product</button>
        </div>}
      </div>

      {usage?.near_limit && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-warning/50 bg-warning/15 px-4 py-2 text-sm"><span>{t("upgrade.nearLimit")}</span><Link to="/billing" className="font-semibold text-primary underline">{t("upgrade.link")}</Link></div>}
      <BrandAdSlot />
      {owner && <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <span><span className="font-medium">Let cashiers add products</span><span className="block text-xs text-muted-foreground">Cashiers can add and edit, but never delete.</span></span>
        <input type="checkbox" role="switch" className="h-5 w-5 accent-primary" checked={!!settings?.allow_cashier_products} onChange={toggleCashiers} />
      </label>}
      {owner && shop && <LowStockSettings shopId={shop.shop_id} products={all} />}

      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or barcode" className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2.5 text-sm md:max-w-sm" />
        <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-input bg-card px-3 text-sm"><option value="All">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-input bg-card px-3 text-sm"><option value="name">Name A–Z</option><option value="price">Price</option><option value="stock">Stock</option></select>
        <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded-lg border border-input bg-card px-3 text-sm">
          <option value="all">All products</option><option value="low">Low stock ({insights.filter((i) => i.kind === "reorder").length})</option><option value="overstock">Too much stock ({insights.filter((i) => i.kind === "overstock").length})</option><option value="archived">Archived</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3 text-right">Price</th>{owner && <th className="p-3 text-right">Margin</th>}<th className="p-3 text-right">Stock</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((p) => {
              const f = flag(p.id);
              const m = p.price && p.cost != null ? ((p.price - p.cost) / p.price) * 100 : null;
              return (
                <tr key={p.id} className={p.archived_at ? "opacity-60" : ""}>
                  <td className="p-3"><div className="flex items-center gap-3">
                    {p.photo_path && photos[p.photo_path] ? <img src={photos[p.photo_path] ?? ""} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-muted" />}
                    <div><p className="font-medium">{p.name}</p><p className="font-mono text-xs text-muted-foreground">{p.sku || "—"} · per {p.unit}</p></div>
                  </div></td>
                  <td className="p-3 text-muted-foreground">{p.category}</td>
                  <td className="p-3 text-right font-mono">{peso(p.price)}</td>
                  {owner && <td className="p-3 text-right font-mono">{m == null ? "—" : `${m.toFixed(0)}%`}</td>}
                  <td className="p-3 text-right font-mono">{p.track_stock ? `${p.stock} ${p.unit}` : "—"}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-1">
                    {p.archived_at && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">Archived</span>}
                    {!p.track_stock && !p.archived_at && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">No stock tracking</span>}
                    {f.includes("reorder") && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">▼ Low stock</span>}
                    {f.includes("dead") && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Dead stock</span>}
                    {f.includes("overstock") && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium">⚠ Too much stock</span>}
                    {p.track_stock && !p.archived_at && f.length === 0 && <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Healthy</span>}
                  </div></td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {p.archived_at ? owner && <button onClick={() => restore(p)} className="text-xs text-primary underline">Restore</button> : <>
                      {canEdit && <button aria-label={`Edit ${p.name}`} onClick={() => setForm({ id: p.id, name: p.name, sku: p.sku, category: p.category, newCategory: "", price: String(p.price), cost: owner && p.cost != null ? String(p.cost) : "", unit: p.unit as Unit, track: p.track_stock, stock: String(p.stock), reorder_level: String(p.reorder_level), photo_path: p.photo_path })} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>}
                      {owner && p.track_stock && <button aria-label={`Adjust stock for ${p.name}`} title="Restock, loss or correction" onClick={() => setAdjusting(p)} className="p-1.5 text-muted-foreground hover:text-foreground"><ArrowUpDown className="h-4 w-4" /></button>}
                      {owner && <button aria-label={`Delete ${p.name}`} onClick={() => del(p)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                    </>}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No products found.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-4" onClick={() => setForm(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-3xl bg-card p-6 sm:rounded-3xl">
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{form.id ? "Edit product" : "Add product"}</h3><button type="button" aria-label="Close" onClick={() => setForm(null)}><X className="h-5 w-5" /></button></div>
            <label className="block text-xs text-muted-foreground">Name<input required maxLength={120} value={form.name} onChange={(e) => set({ name: e.target.value })} className={input} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">Category
                <select value={form.category} onChange={(e) => set({ category: e.target.value })} className={input}>
                  {[...new Set(["General", ...categories, form.category])].filter((c) => c !== NEW_CAT).map((c) => <option key={c}>{c}</option>)}
                  <option value={NEW_CAT}>+ New category</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">Unit
                <select value={form.unit} onChange={(e) => { const unit = e.target.value as Unit; set({ unit, ...(unit === "service" ? { track: false } : {}) }); }} className={input}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
              </label>
            </div>
            {form.category === NEW_CAT && <label className="block text-xs text-muted-foreground">New category name<input required autoFocus maxLength={40} value={form.newCategory} onChange={(e) => set({ newCategory: e.target.value })} className={input} /></label>}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">Selling price ₱ / {form.unit}<input type="number" step="0.01" min="0" required value={form.price} onChange={(e) => set({ price: e.target.value })} className={input} /></label>
              {owner && <label className="text-xs text-muted-foreground">Cost ₱ (optional)<input type="number" step="0.01" min="0" value={form.cost} onChange={(e) => set({ cost: e.target.value })} className={input} /></label>}
            </div>
            <label className="block text-xs text-muted-foreground">SKU / barcode (optional)<input maxLength={60} value={form.sku} onChange={(e) => set({ sku: e.target.value })} className={input} /></label>
            <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"><span>Track stock<span className="block text-xs text-muted-foreground">Turn off for services like haircuts or laundry.</span></span>
              <input type="checkbox" role="switch" className="h-5 w-5 accent-primary" checked={form.track} onChange={(e) => set({ track: e.target.checked })} /></label>
            {form.track && <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">In stock ({form.unit})<input type="number" min="0" step={isDecimalUnit(form.unit) ? "0.001" : "1"} value={form.stock} onChange={(e) => set({ stock: e.target.value })} className={input} /></label>
              <label className="text-xs text-muted-foreground">Reorder at<input type="number" min="0" step="1" value={form.reorder_level} onChange={(e) => set({ reorder_level: e.target.value })} className={input} /></label>
            </div>}
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-3 text-sm">
              {form.file ? <img src={URL.createObjectURL(form.file)} alt="" className="h-12 w-12 rounded object-cover" /> : form.photo_path && photos[form.photo_path] ? <img src={photos[form.photo_path] ?? ""} alt="" className="h-12 w-12 rounded object-cover" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
              <span className="flex-1">Photo (optional, max 2 MB)</span>
              {(form.file || form.photo_path) && <button type="button" onClick={(e) => { e.preventDefault(); set({ file: null, photo_path: null }); }} className="text-xs text-destructive">Remove</button>}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size > 2 * 1024 * 1024) { toast.error("Photo must be 2 MB or smaller"); return; } set({ file: f ?? null }); }} />
            </label>
            <button disabled={busy} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
          </form>
        </div>
      )}

      {owner && <StockHistoryPanel products={all} />}
      <UpgradeSheet message={upgradeMsg} onClose={() => setUpgradeMsg(null)} />
      {adjusting && <StockAdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />}
      {csv && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-4" onClick={() => setCsv(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-card p-6 sm:rounded-3xl">
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Import preview</h3><button aria-label="Close" onClick={() => setCsv(null)}><X className="h-5 w-5" /></button></div>
            <p className="text-sm text-muted-foreground">{csv.filter((r) => r.data).length} ready · {csv.filter((r) => r.errors.length).length} with errors (skipped)</p>
            <button onClick={downloadSample} className="inline-flex items-center gap-1 text-sm text-primary underline"><Download className="h-4 w-4" /> Download sample CSV</button>
            <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-xs">
              <thead className="text-left text-muted-foreground"><tr><th className="p-2">Row</th><th className="p-2">Name</th><th className="p-2">Price</th><th className="p-2">Unit</th><th className="p-2">Stock</th><th className="p-2">Result</th></tr></thead>
              <tbody className="divide-y divide-border">{csv.map((r) => <tr key={r.line}><td className="p-2">{r.line}</td><td className="p-2">{r.data?.name ?? "—"}</td><td className="p-2">{r.data ? peso(r.data.price) : ""}</td><td className="p-2">{r.data?.unit}</td><td className="p-2">{r.data ? (r.data.track_stock ? r.data.stock_qty : "no tracking") : ""}</td>
                <td className={`p-2 ${r.errors.length ? "text-destructive" : "text-success"}`}>{r.errors.length ? r.errors.join("; ") : "OK"}</td></tr>)}</tbody>
            </table></div>
            {overCap && <p role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{t("upgrade.importTooMany", { n: String(importTotal), plan: plan?.label ?? usage?.plan ?? "", max: String(usage?.max_skus ?? ""), x: String(importTotal - (usage?.max_skus ?? 0)) })} <Link to="/billing" className="font-semibold underline">{t("upgrade.link")}</Link></p>}
            <button disabled={busy || overCap || !csv.some((r) => r.data)} onClick={importCsv} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"><Archive className="h-4 w-4" /> Import {csv.filter((r) => r.data).length} products</button>
          </div>
        </div>
      )}
      {canEdit && !csv && <button onClick={downloadSample} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"><Download className="h-3.5 w-3.5" /> Sample CSV (name, category, price, cost, unit, track_stock, stock, reorder_at, sku)</button>}
    </div>
  );
}
