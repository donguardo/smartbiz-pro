import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Hammer, Plus, Trash2, Upload, Download } from "lucide-react";
import { parseProductCsv, SAMPLE_CSV, type CsvProduct, type CsvRow } from "@/lib/product-csv";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { fetchMyPlan, fetchShopContext, qk } from "@/lib/store";
import { storeErrorMessage, useMyStores } from "@/lib/stores";

export const Route = createFileRoute("/_app/setup-store")({
  head: () => ({
    meta: [
      { title: "Store Setup Wizard — MVP BizManager.ai" },
      { name: "description", content: "Set up a new store step by step: category, business details and first products." },
      { property: "og:title", content: "Store Setup Wizard — MVP BizManager.ai" },
      { property: "og:description", content: "Set up a new store step by step: category, business details and first products." },
    ],
  }),
  component: SetupWizard,
});

const CATEGORIES = ["Sari-sari store", "Coffee shop", "Café", "Restaurant", "Laundry", "Beauty parlor", "Bakery", "Pharmacy", "Hardware", "Grocery"];
type Draft = { ts?: unknown; step?: unknown; cats?: unknown; name?: unknown; owner?: unknown; mobile?: unknown; items?: unknown; csvRows?: unknown };
type Item = { name: string; price: string; stock: string };
const blank: Item = { name: "", price: "", stock: "0" };
const input = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function SetupWizard() {
  const { t } = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: shop } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext });
  const { data: plan } = useQuery({ queryKey: qk.plan, queryFn: fetchMyPlan });
  const { data: stores = [] } = useMyStores();
  const [step, setStep] = useState(0);
  const [cats, setCats] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [mobile, setMobile] = useState("");
  const [items, setItems] = useState<Item[]>([{ ...blank }]);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState<boolean[]>([false, false, false, false]);
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const { session } = useSession();
  const draftKey = session ? `store-wizard-draft-v1:${session.user.id}` : null;
  const loaded = useRef(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const [synced, setSynced] = useState<"idle" | "saving" | "synced" | "offline">("idle");
  const applyDraft = (d: Draft) => {
    if (Array.isArray(d.cats)) setCats(d.cats.filter((x: unknown): x is string => typeof x === "string").slice(0, 12));
    if (typeof d.name === "string") setName(d.name.slice(0, 80));
    if (typeof d.owner === "string") setOwner(d.owner.slice(0, 80));
    if (typeof d.mobile === "string") setMobile(d.mobile.replace(/\D/g, "").slice(0, 11));
    if (Array.isArray(d.items) && d.items.length) setItems((d.items as Item[]).slice(0, 10).map((i) => ({ name: String(i?.name ?? ""), price: String(i?.price ?? ""), stock: String(i?.stock ?? "0") })));
    if (Array.isArray(d.csvRows)) setCsvRows((d.csvRows as CsvRow[]).slice(0, 500));
    if (Number.isInteger(d.step) && (d.step as number) >= 0 && (d.step as number) <= 3) setStep(d.step as number);
  };
  useEffect(() => {
    if (!draftKey || !session || loaded.current) return;
    let cancelled = false;
    (async () => {
      let local: Draft | null = null;
      try { local = JSON.parse(localStorage.getItem(draftKey) ?? "null"); } catch { local = null; }
      let remote: Draft | null = null;
      try {
        const { data } = await supabase.from("wizard_drafts").select("data").eq("user_id", session.user.id).maybeSingle();
        remote = (data?.data as Draft | undefined) ?? null;
      } catch { remote = null; }
      if (cancelled) return;
      const ts = (d: Draft | null) => (d && typeof d.ts === "number" ? d.ts : 0);
      const pickD = ts(remote) > ts(local) ? remote : local;
      if (pickD && typeof pickD === "object") { applyDraft(pickD); setRestored(true); }
      loaded.current = true;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, session]);
  useEffect(() => {
    if (!draftKey || !session || !loaded.current) return;
    const payload = { v: 1, ts: Date.now(), step, cats, name, owner, mobile, items, csvRows };
    const localId = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(payload)); setSavedAt(Date.now()); } catch { /* storage blocked */ }
    }, 400);
    const remoteId = setTimeout(async () => {
      if (!navigator.onLine) { setSynced("offline"); return; }
      setSynced("saving");
      const { error } = await supabase.from("wizard_drafts").upsert({ user_id: session.user.id, data: payload as never }, { onConflict: "user_id" });
      setSynced(error ? "offline" : "synced");
    }, 1500);
    return () => { clearTimeout(localId); clearTimeout(remoteId); };
  }, [draftKey, session, step, cats, name, owner, mobile, items, csvRows]);
  const clearDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    if (session) void supabase.from("wizard_drafts").delete().eq("user_id", session.user.id);
  };
  const startOver = () => {
    clearDraft(); setStep(0); setCats([]); setName(""); setOwner(""); setMobile(""); setItems([{ ...blank }]); setCsvRows(null);
    setTried([false, false, false, false]); setRestored(false);
  };

  if (shop && shop.member_role !== "owner") return <div className="p-6 text-muted-foreground">{t("stores.ownerOnly")}</div>;
  const maxCats = plan?.plan === "basic" ? 1 : 12;
  const owned = stores.filter((s) => s.member_role === "owner").length;
  if (plan && owned >= (plan.max_stores ?? 1)) {
    return (
      <div className="mx-auto max-w-xl space-y-3 p-6">
        <p className="text-muted-foreground">{t("stores.limitReached")}</p>
        <Link to="/billing" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t("stores.upgrade")}</Link>
      </div>
    );
  }

  const toggle = (c: string) => {
    const v = c.trim().slice(0, 40);
    if (!v) return;
    if (cats.includes(v)) setCats(cats.filter((x) => x !== v));
    else setCats(maxCats === 1 ? [v] : cats.length < maxCats ? [...cats, v] : cats);
  };
  const filled = (i: Item) => i.name.trim() !== "" || i.price !== "" || (i.stock !== "" && i.stock !== "0");
  const itemErr = (i: Item, idx: number) => {
    const e: { name?: string; price?: string; stock?: string } = {};
    if (!filled(i)) return e;
    if (!i.name.trim()) e.name = t("wizard.err.pName");
    else if (items.some((x, j) => j < idx && x.name.trim().toLowerCase() === i.name.trim().toLowerCase())) e.name = t("wizard.err.dup");
    if (i.price === "") e.price = t("wizard.err.price");
    else if (!/^\d+(\.\d{1,2})?$/.test(i.price) || Number(i.price) > 10_000_000) e.price = t("wizard.err.priceInvalid");
    if (i.stock !== "" && (!/^\d+$/.test(i.stock) || Number(i.stock) > 1_000_000)) e.stock = t("wizard.err.stock");
    return e;
  };
  const errs = {
    cat: cats.length === 0 ? t("wizard.err.cat") : "",
    name: !name.trim() ? t("wizard.err.name") : name.trim().length > 80 ? t("wizard.err.long") : "",
    owner: owner.trim().length > 80 ? t("wizard.err.long") : "",
    mobile: mobile !== "" && !/^09\d{9}$/.test(mobile) ? t("wizard.mobileInvalid") : "",
  };
  const rowErrs = items.map(itemErr);
  const csvGoodRows = (csvRows ?? []).filter((r) => r.data && !r.errors.length);
  const csvGood: CsvProduct[] = csvGoodRows.map((r) => r.data!);
  const csvEditErr = (p: CsvProduct, idx: number) => {
    if (!p.name.trim()) return t("wizard.err.pName");
    if (p.name.length > 120) return t("wizard.err.long");
    if (csvGood.some((x, j) => j < idx && x.name.trim().toLowerCase() === p.name.trim().toLowerCase())) return t("wizard.err.dup");
    if (!Number.isFinite(p.price) || p.price < 0 || p.price > 10_000_000) return t("wizard.err.priceInvalid");
    if (!Number.isFinite(p.stock_qty) || p.stock_qty < 0 || p.stock_qty > 1_000_000) return t("wizard.err.stock");
    if (p.category.length > 40) return t("wizard.err.long");
    return "";
  };
  const csvEditErrs = csvGood.map(csvEditErr);
  const editCsv = (line: number, patch: Partial<CsvProduct>) =>
    setCsvRows((rows) => (rows ?? []).map((r) => (r.line === line && r.data ? { ...r, data: { ...r.data, ...patch } } : r)));
  const removeCsv = (line: number) => setCsvRows((rows) => { const next = (rows ?? []).filter((r) => r.line !== line); return next.length ? next : null; });
  const formulaSafe = (v: string) => v.replace(/^[=+\-@\t\r]+/, "");
  const csvBad = (csvRows ?? []).filter((r) => r.errors.length);
  const stepErrors = [
    errs.cat ? [errs.cat] : [],
    [errs.name, errs.owner, errs.mobile].filter(Boolean),
    [...rowErrs.flatMap((e) => Object.values(e)), ...(csvBad.length ? [t("wizard.err.csv")] : []), ...csvEditErrs.filter(Boolean)],
    [],
  ];
  const validItems = items.filter((i, idx) => filled(i) && !Object.keys(itemErr(i, idx)).length);
  const show = tried[step];
  const goNext = () => {
    setTried(tried.map((v, i) => (i === step ? true : v)));
    if (stepErrors[step]!.length) { toast.error(t("wizard.err.fix")); return; }
    setStep(step + 1);
  };
  const fieldErr = (m: string) => (show && m ? <p className="mt-1 text-xs text-destructive" role="alert">{m}</p> : null);
  const bad = (m: string | undefined) => (show && m ? " border-destructive" : "");
  const loadCsv = async (f: File) => {
    if (f.size > 1024 * 1024) { toast.error(t("wizard.err.csvSize")); return; }
    const rows = parseProductCsv(await f.text(), new Set());
    if (!rows.length) { toast.error(t("wizard.err.csvEmpty")); return; }
    setCsvRows(rows.slice(0, 500));
  };
  const steps = [t("wizard.s1"), t("wizard.s2"), t("wizard.s3"), t("wizard.s4")];

  const finish = async () => {
    const firstBad = stepErrors.findIndex((e) => e.length);
    if (firstBad >= 0) { setTried([true, true, true, true]); setStep(firstBad); toast.error(t("wizard.err.fix")); return; }
    setBusy(true);
    try {
      const { data: newId, error } = await supabase.rpc("create_my_store", { _name: name.trim(), _categories: cats });
      if (error) throw error;
      if (owner.trim() || mobile) {
        await supabase.from("shops").update({ owner_name: owner.trim().slice(0, 80) || null, mobile: mobile || null }).eq("id", newId as string);
      }
      const cat = cats[0] ?? "General";
      if (validItems.length || csvGood.length) {
        const rows: Record<string, unknown>[] = csvGood.map((p, n) => ({ ...p, sku: p.sku || `SKU-${Date.now().toString(36).toUpperCase()}-C${n + 1}`, category: p.category || cat }));
        rows.push(...validItems.map((i, n) => ({
          name: i.name.trim().slice(0, 120), sku: `SKU-${Date.now().toString(36).toUpperCase()}-${n + 1}`, category: cat,
          price: Number(i.price), unit: "pc", track_stock: true, stock_qty: Math.max(0, Math.round(Number(i.stock || 0))), reorder_level: 5, cost: null,
        })));
        const { error: pe } = await supabase.from("products").insert(rows as never);
        if (pe) toast.error(t("wizard.productsFailed"));
      }
      await qc.invalidateQueries();
      toast.success(t("stores.created"));
      clearDraft();
      navigate({ to: "/dashboard" });
    } catch (e) { toast.error(storeErrorMessage(e, t)); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Hammer className="h-6 w-6 text-primary" />{t("wizard.title")}</h1>
        <Link to="/stores" className="text-sm text-muted-foreground underline">{t("wizard.cancel")}</Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span>{restored ? t("wizard.restored") + " · " : ""}{savedAt ? t("wizard.autosaved") : t("wizard.autosaveOn")}{synced === "synced" ? " · " + t("wizard.synced") : synced === "saving" ? " · " + t("wizard.syncing") : synced === "offline" ? " · " + t("wizard.syncOffline") : ""}</span>
        <button type="button" onClick={() => { if (confirm(t("wizard.startOverConfirm"))) startOver(); }} className="underline">{t("wizard.startOver")}</button>
      </div>

      <ol className="grid grid-cols-4 gap-2">
        {steps.map((s, i) => (
          <li key={s} className="text-center">
            <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${i < step ? "border-primary bg-primary text-primary-foreground" : i === step ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</div>
            <p className={`mt-1 text-[11px] ${i === step ? "font-semibold" : "text-muted-foreground"}`}>{s}</p>
          </li>
        ))}
      </ol>

      <section className="rounded-lg border border-border bg-card p-5">
        {step === 0 && (
          <div>
            <h2 className="text-lg font-bold">{t("wizard.catTitle")}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{maxCats === 1 ? t("stores.chooseOne") : t("wizard.catMany")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[...CATEGORIES, ...cats.filter((c) => !CATEGORIES.includes(c))].map((c) => (
                <button key={c} type="button" onClick={() => toggle(c)} className={`rounded-lg border px-3 py-3 text-sm font-medium ${cats.includes(c) ? "border-primary bg-primary/15" : "border-border hover:bg-muted"}`}>{c}</button>
              ))}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); toggle(custom); setCustom(""); }}>
              <input value={custom} maxLength={40} onChange={(e) => setCustom(e.target.value)} placeholder={t("profile.addCategoryPlaceholder")} className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <Button type="submit" variant="outline" size="sm" className="self-center">{t("profile.add")}</Button>
            </form>
            {fieldErr(errs.cat)}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">{t("wizard.detailsTitle")}</h2>
            <label className="block text-sm font-medium">{t("profile.businessName")} *<input value={name} maxLength={80} aria-invalid={show && !!errs.name} onChange={(e) => setName(e.target.value)} className={input + bad(errs.name)} />{fieldErr(errs.name)}</label>
            <label className="block text-sm font-medium">{t("wizard.owner")}<input value={owner} maxLength={80} onChange={(e) => setOwner(e.target.value)} className={input + bad(errs.owner)} />{fieldErr(errs.owner)}</label>
            <label className="block text-sm font-medium">{t("wizard.mobile")}<input value={mobile} inputMode="numeric" maxLength={11} placeholder="09XXXXXXXXX" aria-invalid={show && !!errs.mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} className={input + bad(errs.mobile)} />{fieldErr(errs.mobile)}</label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">{t("wizard.productsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("wizard.productsHint")}</p>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_5.5rem_4.5rem_auto] items-start gap-2">
                <label className="text-xs">{t("wizard.pName")}<input value={it.name} maxLength={120} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={input + bad(rowErrs[i]?.name)} />{fieldErr(rowErrs[i]?.name ?? "")}</label>
                <label className="text-xs">{t("wizard.pPrice")}<input value={it.price} inputMode="decimal" onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, price: e.target.value.replace(/[^\d.]/g, "") } : x))} className={input + bad(rowErrs[i]?.price)} />{fieldErr(rowErrs[i]?.price ?? "")}</label>
                <label className="text-xs">{t("wizard.pStock")}<input value={it.stock} inputMode="numeric" onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, stock: e.target.value.replace(/\D/g, "") } : x))} className={input + bad(rowErrs[i]?.stock)} />{fieldErr(rowErrs[i]?.stock ?? "")}</label>
                <button type="button" aria-label={t("showcase.remove")} onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [{ ...blank }])} className="mt-5 flex h-9 w-9 items-center justify-center rounded-md border border-border"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {items.length < 10 && <Button variant="outline" size="sm" onClick={() => setItems([...items, { ...blank }])}><Plus className="h-4 w-4" />{t("wizard.addRow")}</Button>}
            <div className="mt-4 space-y-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-sm font-medium">{t("wizard.csvTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("wizard.csvHint")}</p>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted">
                  <Upload className="h-4 w-4" />{t("wizard.csvUpload")}
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadCsv(f); e.target.value = ""; }} />
                </label>
                <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`} download="products-sample.csv" className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"><Download className="h-4 w-4" />{t("wizard.csvSample")}</a>
                {csvRows && <button type="button" onClick={() => setCsvRows(null)} className="text-xs text-muted-foreground underline">{t("wizard.csvClear")}</button>}
              </div>
              {csvRows && (
                <div className="text-sm">
                  <p className="text-primary">{t("wizard.csvReady", { n: String(csvGood.length) })}</p>
                  {csvGood.length > 0 && (
                    <div className="mt-2 max-h-72 overflow-auto rounded-md border border-border">
                      <table className="w-full text-left text-xs">
                        <caption className="sr-only">{t("wizard.csvPreview")}</caption>
                        <thead className="sticky top-0 bg-muted">
                          <tr><th className="px-2 py-1.5">{t("wizard.pName")}</th><th className="px-2 py-1.5">{t("wizard.pPrice")}</th><th className="px-2 py-1.5">{t("wizard.pStock")}</th><th className="px-2 py-1.5">{t("wizard.s1")}</th><th className="px-1 py-1.5"><span className="sr-only">{t("showcase.remove")}</span></th></tr>
                        </thead>
                        <tbody>
                          {csvGoodRows.map((row, i) => {
                            const p = row.data!; const e = csvEditErrs[i];
                            const cell = "w-full min-w-0 rounded border bg-background px-1.5 py-1 text-xs " + (e ? "border-destructive" : "border-input");
                            return (
                              <tr key={row.line} className="border-t border-border align-top">
                                <td className="px-1 py-1 min-w-[8rem]">
                                  <input aria-label={`${t("wizard.pName")} ${t("wizard.csvLine", { n: String(row.line) })}`} value={p.name} maxLength={120} onChange={(ev) => editCsv(row.line, { name: formulaSafe(ev.target.value) })} className={cell} />
                                  {e && <p role="alert" className="mt-0.5 text-[11px] text-destructive">{e}</p>}
                                </td>
                                <td className="px-1 py-1 w-20"><input aria-label={t("wizard.pPrice")} inputMode="decimal" value={String(p.price)} onChange={(ev) => { const v = ev.target.value.replace(/[^\d.]/g, ""); editCsv(row.line, { price: v === "" ? NaN : Number(v) }); }} className={cell} /></td>
                                <td className="px-1 py-1 w-16"><input aria-label={t("wizard.pStock")} inputMode="decimal" disabled={!p.track_stock} value={p.track_stock ? String(p.stock_qty) : "—"} onChange={(ev) => { const v = ev.target.value.replace(/[^\d.]/g, ""); editCsv(row.line, { stock_qty: v === "" ? 0 : Number(v) }); }} className={cell} /></td>
                                <td className="px-1 py-1 min-w-[6rem]"><input aria-label={t("wizard.s1")} value={p.category} maxLength={40} placeholder={`${cats[0] ?? "General"} *`} onChange={(ev) => editCsv(row.line, { category: formulaSafe(ev.target.value) })} className={cell} /></td>
                                <td className="px-1 py-1"><button type="button" aria-label={`${t("showcase.remove")} ${p.name}`} onClick={() => removeCsv(row.line)} className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {csvGood.some((p) => !p.category) && <p className="mt-1 text-xs text-muted-foreground">{t("wizard.csvDefaultCat")}</p>}
                  {csvBad.length > 0 && (
                    <div role="alert" className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs">
                      <p className="font-semibold text-destructive">{t("wizard.csvBad", { n: String(csvBad.length) })}</p>
                      <ul className="mt-1 max-h-32 list-disc overflow-auto pl-4">
                        {csvBad.slice(0, 20).map((r) => <li key={r.line}>{t("wizard.csvLine", { n: String(r.line) })}: {r.errors.join("; ")}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            {show && stepErrors[2]!.length > 0 && <p className="text-xs text-destructive" role="alert">{t("wizard.err.fix")}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 text-sm">
            <h2 className="text-lg font-bold">{t("wizard.reviewTitle")}</h2>
            <p><span className="text-muted-foreground">{t("wizard.s1")}:</span> {cats.join(", ")}</p>
            <p><span className="text-muted-foreground">{t("profile.businessName")}:</span> {name}</p>
            {owner && <p><span className="text-muted-foreground">{t("wizard.owner")}:</span> {owner}</p>}
            {mobile && <p><span className="text-muted-foreground">{t("wizard.mobile")}:</span> {mobile}</p>}
            <p><span className="text-muted-foreground">{t("wizard.s3")}:</span> {validItems.length || csvGood.length ? [...validItems.map((i) => `${i.name} (₱${i.price})`), ...(csvGood.length ? [t("wizard.csvReady", { n: String(csvGood.length) })] : [])].join(", ") : t("wizard.noProducts")}</p>
          </div>
        )}
      </section>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" />{t("wizard.back")}</Button>
        {step < 3
          ? <Button onClick={goNext}>{step === 2 && !validItems.length && !csvGood.length ? t("wizard.skip") : t("wizard.next")}<ArrowRight className="h-4 w-4" /></Button>
          : <Button disabled={busy} onClick={finish}><Check className="h-4 w-4" />{t("stores.create")}</Button>}
      </div>
    </div>
  );
}
