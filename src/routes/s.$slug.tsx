import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, Plus, Search, ShoppingBag, Store, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { peso } from "@/lib/format";
import { getStorefront, type StorefrontProduct } from "@/lib/storefront.functions";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    const store = await getStorefront({ data: { slug: params.slug } });
    if (!store) throw notFound();
    return store;
  },
  head: ({ params, loaderData }) => {
    const url = `https://mvp.com.ai/s/${params.slug}`;
    if (!loaderData) return { meta: [{ title: "Store not found — MVP BizManager.ai" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.shop_name} — Shop online`;
    const desc = `Browse ${loaderData.shop_name}'s products and prices and send an order.`;
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title }, { property: "og:description", content: desc },
        { property: "og:type", content: "website" }, { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: StoreNotFound,
  component: Storefront,
});

function StoreNotFound() {
  const { t } = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Store className="h-10 w-10 text-primary" />
      <h1 className="text-xl font-bold">{t("sf.notFound")}</h1>
      <p className="text-sm text-muted-foreground">{t("sf.notFoundBody")}</p>
      <Link to="/" className="text-sm text-primary underline">MVP BizManager.ai</Link>
    </div>
  );
}

const ERRORS: Record<string, string> = {
  STORE_UNAVAILABLE: "sf.err.unavailable", NAME_INVALID: "sf.err.name", MOBILE_INVALID: "sf.err.mobile",
  NOTE_TOO_LONG: "sf.err.note", ITEMS_INVALID: "sf.err.items", SOLD_OUT: "sf.err.soldOut", RATE_LIMITED: "sf.err.rate",
};

function Storefront() {
  const store = Route.useLoaderData();
  const { t } = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const cats = useMemo(() => Array.from(new Set(store.products.map((p) => p.category))).sort(), [store.products]);
  const shown = store.products.filter((p) => (!cat || p.category === cat) && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const byId = useMemo(() => new Map(store.products.map((p) => [p.id, p])), [store.products]);
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(id)!, qty })).filter((l) => l.p);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + l.qty * l.p.price, 0);

  const setQty = (p: StorefrontProduct, n: number) =>
    setCart((c) => { const next = { ...c }; if (n <= 0) delete next[p.id]; else next[p.id] = Math.min(n, 999); return next; });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr(t("sf.err.name"));
    if (!/^09\d{9}$/.test(mobile.replace(/\D/g, ""))) return setErr(t("sf.err.mobile"));
    setBusy(true);
    const { data, error } = await supabase.rpc("place_storefront_order", {
      _slug: store.slug, _name: name.trim(), _mobile: mobile, _note: note.trim(),
      _items: lines.map((l) => ({ product_id: l.p.id, qty: l.qty })),
    });
    setBusy(false);
    if (error) {
      const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
      return setErr(t((code && ERRORS[code]) || "sf.err.generic"));
    }
    setDone(data as string);
    setCart({});
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xl font-bold text-primary">
            {store.shop_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{store.shop_name}</h1>
            <p className="truncate text-sm text-muted-foreground">{store.categories.join(" · ") || t("sf.tagline")}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("sf.search")} aria-label={t("sf.search")}
            className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm" />
        </div>
        {cats.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[null, ...cats].map((c) => (
              <button key={c ?? "all"} type="button" onClick={() => setCat(c)}
                className={`shrink-0 rounded-full border px-3 py-1 text-sm ${cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                {c ?? t("sf.all")}
              </button>
            ))}
          </div>
        )}

        {store.products.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">{t("sf.empty")}</p>
        ) : shown.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">{t("sf.noMatch")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <li key={p.id} className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold text-primary">{peso(p.price)}<span className="text-xs font-normal text-muted-foreground"> / {p.unit}</span></p>
                      <p className={`text-xs ${p.in_stock ? "text-muted-foreground" : "text-destructive"}`}>{p.in_stock ? t("sf.inStock") : t("sf.soldOut")}</p>
                    </div>
                    {!p.in_stock ? null : qty === 0 ? (
                      <Button size="sm" onClick={() => setQty(p, 1)}><Plus className="h-4 w-4" />{t("sf.add")}</Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="h-8 w-8" aria-label={t("sf.less")} onClick={() => setQty(p, qty - 1)}><Minus className="h-4 w-4" /></Button>
                        <span className="w-6 text-center font-semibold">{qty}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8" aria-label={t("sf.more")} onClick={() => setQty(p, qty + 1)}><Plus className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="pt-6 text-center text-xs text-muted-foreground">
          {t("sf.poweredBy")} <Link to="/" className="text-primary underline">MVP BizManager.ai</Link>
        </p>
      </main>

      {count > 0 && !open && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/90 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm"><strong>{count}</strong> {t("sf.items")} · <strong>{peso(total)}</strong></p>
            <Button onClick={() => { setOpen(true); setDone(null); setErr(null); }}><ShoppingBag className="h-4 w-4" />{t("sf.review")}</Button>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={t("sf.yourOrder")}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{done ? t("sf.sentTitle") : t("sf.yourOrder")}</h2>
              <button type="button" aria-label={t("sf.close")} onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {done ? (
              <div className="space-y-3 text-sm">
                <p>{t("sf.sentBody", { store: store.shop_name })}</p>
                <p className="rounded-lg bg-muted p-3 text-center text-lg font-bold">{done}</p>
                <Button className="w-full" onClick={() => setOpen(false)}>{t("sf.close")}</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <ul className="divide-y divide-border text-sm">
                  {lines.map((l) => (
                    <li key={l.p.id} className="flex justify-between gap-2 py-2"><span>{l.qty} × {l.p.name}</span><span>{peso(l.qty * l.p.price)}</span></li>
                  ))}
                  <li className="flex justify-between py-2 font-bold"><span>{t("sf.total")}</span><span>{peso(total)}</span></li>
                </ul>
                <div>
                  <label htmlFor="sf-name" className="text-sm font-medium">{t("sf.name")}</label>
                  <input id="sf-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
                </div>
                <div>
                  <label htmlFor="sf-mobile" className="text-sm font-medium">{t("sf.mobile")}</label>
                  <input id="sf-mobile" inputMode="numeric" value={mobile} maxLength={13} placeholder="09XXXXXXXXX" onChange={(e) => setMobile(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
                </div>
                <div>
                  <label htmlFor="sf-note" className="text-sm font-medium">{t("sf.note")}</label>
                  <textarea id="sf-note" value={note} maxLength={300} rows={2} onChange={(e) => setNote(e.target.value)} placeholder={t("sf.notePh")} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
                <p className="text-xs text-muted-foreground">{t("sf.payNote")}</p>
                <Button type="submit" className="w-full" disabled={busy || lines.length === 0}>{busy ? "…" : t("sf.send")}</Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
