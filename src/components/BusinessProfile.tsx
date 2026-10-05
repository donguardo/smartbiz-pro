import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Store, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { qk } from "@/lib/store";
import { useShopProfile } from "@/lib/shop-profile";
import { StoreImagePicker } from "@/components/StoreImagePicker";

const SUGGESTED = ["Sari-sari store", "Coffee shop", "Café", "Restaurant", "Laundry", "Beauty parlor", "Bakery", "Pharmacy", "Hardware", "Grocery"];
const MAX_CATEGORIES = 12;

export function BusinessProfile({ shopId }: { shopId: string }) {
  const { t } = useT();
  const qc = useQueryClient();
  const { data } = useShopProfile(shopId);
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
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { toast.error(t("profile.logoType")); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error(t("profile.logoSize")); return; }
    setBusy(true);
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
    const path = `${shopId}/logo-${crypto.randomUUID()}.${ext}`;
    try {
      const { error } = await supabase.storage.from("shop-logos").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { error: saveError } = await supabase.from("shops").update({ logo_url: path }).eq("id", shopId).select("id").single();
      if (saveError) {
        await supabase.storage.from("shop-logos").remove([path]);
        throw saveError;
      }
      if (data?.logo_url) await supabase.storage.from("shop-logos").remove([data.logo_url]);
      toast.success(t("profile.logoSaved"));
      await qc.invalidateQueries({ queryKey: ["shop-profile", shopId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : t("profile.logoType"));
    } finally { setBusy(false); }
  };

  const removeLogo = async () => {
    if (!data?.logo_url) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("shops").update({ logo_url: null }).eq("id", shopId).select("id").single();
      if (error) throw error;
      const { error: storageError } = await supabase.storage.from("shop-logos").remove([data.logo_url]);
      if (storageError) toast.error(storageError.message);
      await qc.invalidateQueries({ queryKey: ["shop-profile", shopId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : t("profile.nameRequired"));
    } finally { setBusy(false); }
  };

  const save = async () => {
    const n = name.trim();
    if (n.length < 1 || n.length > 80) { toast.error(t("profile.nameRequired")); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("shops").update({ name: n, business_categories: cats }).eq("id", shopId).select("id").single();
      if (error) throw error;
      toast.success(t("profile.saved"));
      await Promise.all([qc.invalidateQueries({ queryKey: ["shop-profile", shopId] }), qc.invalidateQueries({ queryKey: qk.shop })]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : t("profile.nameRequired"));
    } finally { setBusy(false); }
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
      <StoreImagePicker onSave={uploadLogo} disabled={busy} />
    </section>
  );
}
