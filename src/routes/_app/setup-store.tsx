import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Hammer, Plus, Trash2 } from "lucide-react";
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
  const validItems = items.filter((i) => i.name.trim() && i.price !== "" && Number(i.price) >= 0);
  const mobileOk = mobile === "" || /^09\d{9}$/.test(mobile);
  const canNext = [cats.length > 0, name.trim().length > 0 && mobileOk, true, true][step];
  const steps = [t("wizard.s1"), t("wizard.s2"), t("wizard.s3"), t("wizard.s4")];

  const finish = async () => {
    setBusy(true);
    try {
      const { data: newId, error } = await supabase.rpc("create_my_store", { _name: name.trim(), _categories: cats });
      if (error) throw error;
      if (owner.trim() || mobile) {
        await supabase.from("shops").update({ owner_name: owner.trim().slice(0, 80) || null, mobile: mobile || null }).eq("id", newId as string);
      }
      if (validItems.length) {
        const cat = cats[0] ?? "General";
        const rows = validItems.map((i, n) => ({
          name: i.name.trim().slice(0, 120), sku: `SKU-${Date.now().toString(36).toUpperCase()}-${n + 1}`, category: cat,
          price: Number(i.price), unit: "pc", track_stock: true, stock_qty: Math.max(0, Math.round(Number(i.stock || 0))), reorder_level: 5, cost: null,
        }));
        const { error: pe } = await supabase.from("products").insert(rows as never);
        if (pe) toast.error(t("wizard.productsFailed"));
      }
      await qc.invalidateQueries();
      toast.success(t("stores.created"));
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
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">{t("wizard.detailsTitle")}</h2>
            <label className="block text-sm font-medium">{t("profile.businessName")} *<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={input} /></label>
            <label className="block text-sm font-medium">{t("wizard.owner")}<input value={owner} maxLength={80} onChange={(e) => setOwner(e.target.value)} className={input} /></label>
            <label className="block text-sm font-medium">{t("wizard.mobile")}<input value={mobile} inputMode="numeric" maxLength={11} placeholder="09XXXXXXXXX" onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} className={input} /></label>
            {!mobileOk && <p className="text-xs text-destructive">{t("wizard.mobileInvalid")}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">{t("wizard.productsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("wizard.productsHint")}</p>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_5.5rem_4.5rem_auto] items-end gap-2">
                <label className="text-xs">{t("wizard.pName")}<input value={it.name} maxLength={120} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={input} /></label>
                <label className="text-xs">{t("wizard.pPrice")}<input value={it.price} inputMode="decimal" onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, price: e.target.value.replace(/[^\d.]/g, "") } : x))} className={input} /></label>
                <label className="text-xs">{t("wizard.pStock")}<input value={it.stock} inputMode="numeric" onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, stock: e.target.value.replace(/\D/g, "") } : x))} className={input} /></label>
                <button type="button" aria-label={t("showcase.remove")} onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [{ ...blank }])} className="mb-1 flex h-9 w-9 items-center justify-center rounded-md border border-border"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {items.length < 10 && <Button variant="outline" size="sm" onClick={() => setItems([...items, { ...blank }])}><Plus className="h-4 w-4" />{t("wizard.addRow")}</Button>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 text-sm">
            <h2 className="text-lg font-bold">{t("wizard.reviewTitle")}</h2>
            <p><span className="text-muted-foreground">{t("wizard.s1")}:</span> {cats.join(", ")}</p>
            <p><span className="text-muted-foreground">{t("profile.businessName")}:</span> {name}</p>
            {owner && <p><span className="text-muted-foreground">{t("wizard.owner")}:</span> {owner}</p>}
            {mobile && <p><span className="text-muted-foreground">{t("wizard.mobile")}:</span> {mobile}</p>}
            <p><span className="text-muted-foreground">{t("wizard.s3")}:</span> {validItems.length ? validItems.map((i) => `${i.name} (₱${i.price})`).join(", ") : t("wizard.noProducts")}</p>
          </div>
        )}
      </section>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" />{t("wizard.back")}</Button>
        {step < 3
          ? <Button disabled={!canNext} onClick={() => setStep(step + 1)}>{step === 2 && !validItems.length ? t("wizard.skip") : t("wizard.next")}<ArrowRight className="h-4 w-4" /></Button>
          : <Button disabled={busy} onClick={finish}><Check className="h-4 w-4" />{t("stores.create")}</Button>}
      </div>
    </div>
  );
}
