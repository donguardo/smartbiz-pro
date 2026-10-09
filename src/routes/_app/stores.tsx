import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Hammer, Plus, Settings, Store, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { fetchMyPlan, fetchShopContext, qk } from "@/lib/store";
import { storeErrorMessage, storesKey, useMyStores, useSwitchStore } from "@/lib/stores";
import { BusinessProfile } from "@/components/BusinessProfile";

export const Route = createFileRoute("/_app/stores")({
  head: () => ({
    meta: [
      { title: "Store Builder — MVP BizManager.ai" },
      { name: "description", content: "Create and set up your stores, categories and logos." },
      { property: "og:title", content: "Store Builder — MVP BizManager.ai" },
      { property: "og:description", content: "Create and set up your stores, categories and logos." },
    ],
  }),
  component: StoreBuilder,
});

const SUGGESTED = ["Sari-sari store", "Coffee shop", "Café", "Restaurant", "Laundry", "Beauty parlor", "Bakery", "Pharmacy", "Hardware", "Grocery"];

function StoreBuilder() {
  const { t } = useT();
  const qc = useQueryClient();
  const { data: shop } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext });
  const { data: plan } = useQuery({ queryKey: qk.plan, queryFn: fetchMyPlan });
  const { data: stores = [] } = useMyStores();
  const switchStore = useSwitchStore();
  const [name, setName] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);

  if (shop && shop.member_role !== "owner") {
    return <div className="p-6 text-muted-foreground">{t("stores.ownerOnly")}</div>;
  }

  const maxStores = plan?.max_stores ?? 1;
  const maxCats = plan?.plan === "basic" ? 1 : 12;
  const owned = stores.filter((s) => s.member_role === "owner").length;
  const canAdd = owned < maxStores;

  const addCat = (c: string) => {
    const v = c.trim().slice(0, 40);
    if (!v || cats.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    setCats(maxCats === 1 ? [v] : cats.length >= maxCats ? cats : [...cats, v]);
    setNewCat("");
  };

  const create = async () => {
    if (!name.trim()) { toast.error(t("profile.nameRequired")); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_my_store", { _name: name.trim(), _categories: cats });
      if (error) throw error;
      toast.success(t("stores.created"));
      setName(""); setCats([]);
      await qc.invalidateQueries();
      await qc.invalidateQueries({ queryKey: storesKey });
    } catch (e) { toast.error(storeErrorMessage(e, t)); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Hammer className="h-6 w-6 text-primary" />{t("stores.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("stores.subtitle", { used: String(owned), max: String(maxStores), plan: plan?.label ?? "…" })}</p>
        </div>
        <Link to="/settings" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"><Settings className="h-4 w-4" />{t("app.nav.settings")}</Link>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-lg font-bold">{t("stores.yourStores")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {stores.map((s) => (
            <li key={s.shop_id} className={`flex items-center gap-3 rounded-lg border p-3 ${s.is_current ? "border-primary" : "border-border"}`}>
              <Store className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.shop_name}</p>
                <p className="truncate text-xs text-muted-foreground">{(s.business_categories ?? []).join(", ") || "—"}</p>
              </div>
              {s.is_current ? <span className="inline-flex items-center gap-1 text-xs text-primary"><Check className="h-3.5 w-3.5" />{t("stores.current")}</span>
                : <Button size="sm" variant="outline" onClick={async () => { try { await switchStore(s.shop_id); } catch (e) { toast.error(storeErrorMessage(e, t)); } }}>{t("stores.open")}</Button>}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-bold">{t("stores.addTitle")}</h2>
        {!canAdd ? (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-muted-foreground">{t("stores.limitReached")}</p>
            <Link to="/billing" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t("stores.upgrade")}</Link>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <Link to="/setup-store" className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><Hammer className="h-4 w-4" />{t("wizard.start")}</Link>
            <div>
              <label htmlFor="new-store" className="text-sm font-medium">{t("profile.businessName")}</label>
              <input id="new-store" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
            </div>
            <div>
              <p className="text-sm font-medium">{maxCats === 1 ? t("stores.chooseOne") : t("profile.categories")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {cats.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-sm">{c}
                    <button type="button" aria-label={`${t("showcase.remove")} ${c}`} onClick={() => setCats(cats.filter((x) => x !== c))}><X className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
              </div>
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addCat(newCat); }}>
                <input value={newCat} maxLength={40} onChange={(e) => setNewCat(e.target.value)} placeholder={t("profile.addCategoryPlaceholder")} className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <Button type="submit" variant="outline" size="sm" className="self-center">{t("profile.add")}</Button>
              </form>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTED.filter((s) => !cats.includes(s)).map((s) => (
                  <button key={s} type="button" onClick={() => addCat(s)} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted">+ {s}</button>
                ))}
              </div>
            </div>
            <Button onClick={create} disabled={busy}><Plus className="h-4 w-4" />{t("stores.create")}</Button>
          </div>
        )}
      </section>

      {shop?.shop_id && <BusinessProfile shopId={shop.shop_id} />}
    </div>
  );
}
