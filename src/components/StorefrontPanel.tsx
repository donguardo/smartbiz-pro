import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink, Globe, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { peso } from "@/lib/format";

const SITE = "https://mvp.com.ai";
const STATUSES = ["new", "confirmed", "completed", "cancelled"] as const;

export function StorefrontPanel({ shopId, isOwner }: { shopId: string; isOwner: boolean }) {
  const { t } = useT();
  const qc = useQueryClient();
  const sfKey = ["my-storefront", shopId];
  const ordersKey = ["storefront-orders", shopId];
  const { data: sf } = useQuery({
    queryKey: sfKey,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_my_storefront"); if (error) throw error; return data?.[0] ?? null; },
  });
  const { data: orders = [] } = useQuery({
    queryKey: ordersKey,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from("storefront_orders")
        .select("id, order_no, customer_name, customer_mobile, note, total, status, created_at, storefront_order_items(name, unit, qty, price)")
        .eq("shop_id", shopId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (sf?.slug) setSlug(sf.slug); }, [sf?.slug]);

  if (!sf) return null;
  const url = `${SITE}/s/${sf.slug}`;

  const save = async (enabled: boolean, nextSlug = slug) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_my_storefront", { _slug: nextSlug.trim().toLowerCase(), _enabled: enabled });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("SLUG_TAKEN") ? t("sf.owner.taken") : error.message.includes("SLUG_INVALID") ? t("sf.owner.invalid") : t("sf.err.generic"));
      return;
    }
    toast.success(t("sf.owner.saved"));
    qc.invalidateQueries({ queryKey: sfKey });
  };
  const copy = async () => { await navigator.clipboard.writeText(url); toast.success(t("sf.owner.copied")); };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: t("sf.owner.title"), url }); } catch { /* cancelled */ } }
    else copy();
  };
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.rpc("set_storefront_order_status", { _id: id, _status: status });
    if (error) toast.error(t("sf.err.generic")); else qc.invalidateQueries({ queryKey: ordersKey });
  };
  const newCount = orders.filter((o) => o.status === "new").length;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Globe className="h-5 w-5 text-primary" />{t("sf.owner.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("sf.owner.body")}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${sf.storefront_enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          {sf.storefront_enabled ? t("sf.owner.on") : t("sf.owner.off")}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3">
        <code className="min-w-0 flex-1 truncate text-sm">{url}</code>
        <Button size="sm" variant="outline" onClick={copy}><Copy className="h-4 w-4" />{t("sf.owner.copy")}</Button>
        <Button size="sm" variant="outline" onClick={share}><Share2 className="h-4 w-4" />{t("sf.owner.share")}</Button>
        <Link to="/s/$slug" params={{ slug: sf.slug }} target="_blank" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background"><ExternalLink className="h-4 w-4" />{t("sf.owner.view")}</Link>
      </div>

      {isOwner && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="sf-slug" className="text-sm font-medium">{t("sf.owner.linkName")}</label>
            <div className="mt-1 flex items-center rounded-md border border-input bg-background pl-3 text-sm">
              <span className="text-muted-foreground">mvp.com.ai/s/</span>
              <input id="sf-slug" value={slug} maxLength={40} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="min-w-0 flex-1 bg-transparent py-2 pr-3 outline-none" />
            </div>
          </div>
          <Button variant="outline" disabled={busy || slug === sf.slug} onClick={() => save(sf.storefront_enabled)}>{t("sf.owner.saveLink")}</Button>
          <Button variant={sf.storefront_enabled ? "outline" : "default"} disabled={busy} onClick={() => save(!sf.storefront_enabled, sf.slug)}>
            {sf.storefront_enabled ? t("sf.owner.turnOff") : t("sf.owner.turnOn")}
          </Button>
        </div>
      )}

      <div>
        <h3 className="mb-2 font-semibold">{t("sf.owner.orders")} {newCount > 0 && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{newCount} {t("sf.owner.new")}</span>}</h3>
        {orders.length === 0 ? <p className="text-sm text-muted-foreground">{t("sf.owner.noOrders")}</p> : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} className={`rounded-lg border p-3 text-sm ${o.status === "new" ? "border-primary" : "border-border"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{o.order_no} · {o.customer_name} · <a href={`tel:${o.customer_mobile}`} className="text-primary underline">{o.customer_mobile}</a></p>
                  <select aria-label={t("sf.owner.status")} value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                    {STATUSES.map((s) => <option key={s} value={s}>{t(`sf.status.${s}`)}</option>)}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                <ul className="mt-1">
                  {o.storefront_order_items.map((i, n) => <li key={n}>{Number(i.qty)} {i.unit} × {i.name} — {peso(Number(i.qty) * Number(i.price))}</li>)}
                </ul>
                {o.note && <p className="mt-1 italic text-muted-foreground">“{o.note}”</p>}
                <p className="mt-1 font-bold">{t("sf.total")}: {peso(Number(o.total))}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
