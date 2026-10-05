import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Store, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { qk } from "@/lib/store";

const SUGGESTED = ["Sari-sari store", "Coffee shop", "Café", "Restaurant", "Laundry", "Beauty parlor", "Bakery", "Pharmacy", "Hardware", "Grocery"];
const MAX_CATEGORIES = 12;

async function fetchShopProfile(shopId: string) {
  const { data, error } = await supabase.from("shops").select("id, name, logo_url, business_categories").eq("id", shopId).single();
  if (error) throw error;
  let logoSrc: string | null = null;
  if (data.logo_url) {
    const { data: signed } = await supabase.storage.from("shop-logos").createSignedUrl(data.logo_url, 3600);
    logoSrc = signed?.signedUrl ?? null;
  }
  return { ...data, logoSrc };
}

export function BusinessProfile({ shopId }: { shopId: string }) {
  const { t } = useT();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["shop-profile", shopId], queryFn: () => fetchShopProfile(shopId) });
  const [name, setName] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) { setName(data.name); setCats(data.business_categories ?? []); }
  }, [data]);

  const addCat = (c: string) => {
    const v = c.trim().slice(0, 40);
    if (!v || cats.some((x) => x.toLowerCase() === v.toLowerCase()) || cats.length >= MAX_CATEGORIES) return;
    setCats([...cats, v]); setNewCat("");
  };

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error(t("profile.logoType"));
    if (file.size > 2 * 1024 * 1024) return toast.error(t("profile.logoSize"));
    setBusy(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${shopId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("shop-logos").upload(path, file, { contentType: file.type });
    if (!error) {
      const old = data?.logo_url;
      const { error: e2 } = await supabase.from("shops").update({ logo_url: path }).eq("id", shopId);
      if (e2) toast.error(e2.message);
      else {
        if (old) await supabase.storage.from("shop-logos").remove([old]);
        toast.success(t("profile.logoSaved"));
        qc.invalidateQueries({ queryKey: ["shop-profile", shopId] });
      }
    } else toast.error(error.message);
    setBusy(false);
  };

  const removeLogo = async () => {
    if (!data?.logo_url) return;
    setBusy(true);
    await supabase.storage.from("shop-logos").remove([data.logo_url]);
    await supabase.from("shops").update({ logo_url: null }).eq("id", shopId);
    qc.invalidateQueries({ queryKey: ["shop-profile", shopId] });
    setBusy(false);
  };

  const save = async () => {
    const n = name.trim();
    if (n.length < 1 || n.length > 80) return toast.error(t("profile.nameRequired"));
    setBusy(true);
    const { error } = await supabase.from("shops").update({ name: n, business_categories: cats }).eq("id", shopId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("profile.saved"));
    qc.invalidateQueries({ queryKey: ["shop-profile", shopId] });
    qc.invalidateQueries({ queryKey: qk.shop });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{t("profile.title")}</h2>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">{t("profile.description")}</p>

      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {data?.logoSrc ? <img src={data.logoSrc} alt={t("profile.logo")} className="h-full w-full object-cover" /> : <Store className="h-10 w-10 text-muted-foreground" aria-hidden />}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <ImagePlus className="h-4 w-4" aria-hidden />
            {t("profile.uploadLogo")}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = ""; }} />
          </label>
          {data?.logo_url && <button type="button" onClick={removeLogo} disabled={busy} className="text-xs text-muted-foreground underline">{t("profile.removeLogo")}</button>}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <label htmlFor="biz-name" className="text-sm font-medium">{t("profile.businessName")}</label>
            <input id="biz-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("profile.categories")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {cats.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-sm text-foreground">
                  {c}
                  <button type="button" aria-label={`${t("showcase.remove")} ${c}`} onClick={() => setCats(cats.filter((x) => x !== c))}><X className="h-3.5 w-3.5" aria-hidden /></button>
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
          <Button onClick={save} disabled={busy}>{t("profile.save")}</Button>
        </div>
      </div>
    </section>
  );
}
