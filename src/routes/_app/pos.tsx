import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, Minus, Plus, Printer, QrCode, ScanLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchCustomers, fetchProducts, fetchShopContext, isDecimalUnit, qk, type Product } from "@/lib/store";
import { peso } from "@/lib/format";
import { useShopProfile } from "@/lib/shop-profile";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { enqueueSale, isNetworkError, useOnline } from "@/lib/offline";
import { FailedQueuedSales } from "@/components/OfflineStatus";
import "@/receipt-print.css";

export const Route = createFileRoute("/_app/pos")({
  head: () => ({ meta: [
    { title: "Register — MVP BizManager" },
    { name: "description", content: "Scan items, take payment and print receipts." },
    { property: "og:title", content: "Register — MVP BizManager" },
    { property: "og:description", content: "Scan items, take payment and print receipts." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: POS,
});

type Line = { p: Product; qty: number };
type Method = "cash" | "ewallet" | "card";
type Receipt = { no: string; lines: Line[]; total: number; method: Method; tendered: number; at: Date; pending?: boolean; clientSaleId?: string; syncedAt?: string | null };

function POS() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: qk.products, queryFn: fetchProducts });
  const { t, lang } = useT();
  const online = useOnline();
  const { data: shop } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext });
  const { data: business } = useShopProfile(shop?.shop_id);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { data: customers = [] } = useQuery({ queryKey: qk.customers, queryFn: fetchCustomers });
  const [cart, setCart] = useState<Line[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [scan, setScan] = useState("");
  const [cat, setCat] = useState("All");
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<Method>("cash");
  const [tendered, setTendered] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const savedReceipt = useQuery({
    queryKey: ["receipt-sync", shop?.shop_id, receipt?.clientSaleId],
    enabled: online && !!shop?.shop_id && !!receipt?.pending && !!receipt?.clientSaleId,
    refetchInterval: 5000,
    queryFn: async () => {
      if (!shop || !receipt?.clientSaleId) return null;
      const { data, error } = await supabase.from("sales").select("receipt_no, created_at, synced_at, total").eq("shop_id", shop.shop_id).eq("client_sale_id", receipt.clientSaleId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const saved = savedReceipt.data;
    if (!saved) return;
    setReceipt((previous) => previous?.pending ? { ...previous, no: saved.receipt_no, at: new Date(saved.created_at), total: Number(saved.total), pending: false, syncedAt: saved.synced_at } : previous);
  }, [savedReceipt.data]);
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", mobile: "", consent: false });
  const scanRef = useRef<HTMLInputElement>(null);

  const cats = ["All", ...[...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b))];
  const lineTotal = (l: Line) => Math.round(Number(l.p.price) * l.qty * 100) / 100;
  const shown = products.filter((p) => (cat === "All" || p.category === cat) && (!scan || p.name.toLowerCase().includes(scan.toLowerCase()) || p.sku.includes(scan)));
  const total = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart]);
  const count = cart.length;

  const outOfStock = (p: Product) => p.track_stock && p.stock <= 0;
  const add = (p: Product) => {
    const f = cart.find((l) => l.p.id === p.id);
    const next = (f?.qty ?? 0) + (isDecimalUnit(p.unit) && p.track_stock && p.stock < 1 ? p.stock : 1);
    if (p.track_stock && (p.stock <= 0 || next > p.stock)) { toast.error(`Not enough stock: ${p.name} (${p.stock} left)`); return; }
    setCart((c) => (f ? c.map((l) => (l.p.id === p.id ? { ...l, qty: next } : l)) : [...c, { p, qty: next }]));
  };
  const shortages = cart.filter((l) => { const cur = products.find((x) => x.id === l.p.id); return !cur || (cur.track_stock && cur.stock < l.qty); })
    .map((l) => { const cur = products.find((x) => x.id === l.p.id); return `Not enough stock: ${l.p.name} (${cur?.stock ?? 0} left)`; });
  const setQty = (id: string, qty: number) => { const p = products.find((x) => x.id === id); if (p?.track_stock && qty > p.stock) { toast.error(`Not enough stock: ${p.name} (${p.stock} left)`); return; } setCart((c) => (qty <= 0 ? c.filter((l) => l.p.id !== id) : c.map((l) => (l.p.id === id ? { ...l, qty } : l)))); };

  const onScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    const p = products.find((x) => x.sku === code) ?? (shown.length === 1 ? shown[0] : undefined);
    if (p) { add(p); setScan(""); } else toast.error(`No item matches "${code}"`);
    scanRef.current?.focus();
  };

  const change = method === "cash" ? Math.max(0, Number(tendered || 0) - total) : 0;
  const canPay = cart.length > 0 && shortages.length === 0 && (method !== "cash" || Number(tendered || 0) >= total);

  const checkout = async () => {
    setBusy(true);
    const clientSaleId = crypto.randomUUID();
    const paid = method === "cash" ? Number(tendered) : total;
    const queueOffline = async () => {
      if (newCustomer.name.trim()) { toast.error(t("offline.noNewCustomer")); return; }
      const q = await enqueueSale({ id: clientSaleId, method, tendered: paid, total, customerId: customerId || null, items: cart.map((l) => ({ product_id: l.p.id, qty: l.qty, name: l.p.name, price: Number(l.p.price) })) });
      qc.setQueryData<Product[]>(qk.products, (ps) => ps?.map((p) => { const l = cart.find((x) => x.p.id === p.id); return l && p.track_stock ? { ...p, stock: p.stock - l.qty } : p; }));
      setReceipt({ no: `OFFLINE-${q.id.slice(0, 6).toUpperCase()}`, lines: cart, total, method, tendered: paid, at: new Date(q.createdAt), pending: true, clientSaleId: q.id });
      setCart([]); setTendered(""); setCustomerId(""); setPaying(false);
      toast.success(t("offline.queued"));
    };
    if (!navigator.onLine) { try { await queueOffline(); } finally { setBusy(false); } return; }
    try {
      let selectedCustomer = customerId || null;
      if (newCustomer.name.trim()) {
        const { data, error } = await supabase.rpc("create_shop_customer", { _name: newCustomer.name, _mobile: newCustomer.mobile, _consented: newCustomer.consent });
        if (error) throw error;
        selectedCustomer = data;
      }
      const { data, error } = await supabase.rpc("record_sale", { _client_sale_id: clientSaleId, _payment_method: method, _amount_tendered: method === "cash" ? Number(tendered) : total, _customer_id: selectedCustomer as string, _items: cart.map((l) => ({ product_id: l.p.id, qty: l.qty })) });
      if (error) throw error;
      const sale = data[0];
      if (!sale) throw new Error("Payment could not be recorded");
      setReceipt({ no: sale.receipt_no, lines: cart, total, method, tendered: method === "cash" ? Number(tendered) : total, at: new Date() });
      setCart([]); setTendered(""); setCustomerId(""); setNewCustomer({ name: "", mobile: "", consent: false }); setPaying(false);
      qc.invalidateQueries();
    } catch (err) {
      if (isNetworkError(err)) { await queueOffline(); return; }
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "Payment failed"; toast.error(msg); void qc.invalidateQueries({ queryKey: qk.products });
    } finally { setBusy(false); }
  };

  const quick = [total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, 1000].filter((v, i, a) => v > 0 && a.indexOf(v) === i);

  return (
    <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-4">
        <FailedQueuedSales />
        <form onSubmit={onScan} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
          <ScanLine className="ml-2 h-5 w-5 text-primary" />
          <input ref={scanRef} autoFocus value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan barcode or search item, then press Enter"
            className="flex-1 bg-transparent px-2 py-2 font-mono text-sm outline-none" />
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add</button>
        </form>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{c}</button>
          ))}
        </div>
        {products.length === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">No products yet — add some in Inventory.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((p) => (
            <button key={p.id} onClick={() => add(p)} disabled={outOfStock(p)} aria-disabled={outOfStock(p)} className="group flex flex-col rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border">
              <span className="text-xs text-muted-foreground">{p.category}</span>
              <span className="mt-1 line-clamp-2 font-medium leading-tight">{p.name}</span>
              <span className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-0.5 pt-3">
                <span className="font-display text-lg font-semibold">{peso(Number(p.price))}{isDecimalUnit(p.unit) && <span className="text-xs font-normal text-muted-foreground">/{p.unit}</span>}</span>
                <span className={`font-mono text-[11px] leading-tight ${p.track_stock && p.stock <= p.reorder_level ? "text-destructive" : "text-muted-foreground"}`}>{outOfStock(p) ? "Out of stock" : p.track_stock ? `${p.stock} ${p.unit} left` : p.unit === "service" ? "service" : `per ${p.unit}`}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <aside className="flex flex-col rounded-2xl border border-border bg-card lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">Current sale</h2>
          {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-muted-foreground hover:text-destructive">Clear</button>}
        </div>
        <ul className="flex-1 divide-y divide-border overflow-auto">
          {cart.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">Scan or tap items to add them.</li>}
          {cart.map((l) => (
            <li key={l.p.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.p.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{peso(Number(l.p.price))} / {l.p.unit}</p>
              </div>
              <div className="flex items-center gap-1">
                <button aria-label="Less" onClick={() => setQty(l.p.id, Math.round((l.qty - 1) * 1000) / 1000)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border">{l.qty <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}</button>
                {isDecimalUnit(l.p.unit) ? <input aria-label={`${l.p.name} quantity in ${l.p.unit}`} type="number" inputMode="decimal" min="0.001" step="0.001" value={drafts[l.p.id] ?? String(l.qty)} onChange={(e) => { const raw = e.target.value; setDrafts((d) => ({ ...d, [l.p.id]: raw })); const v = Math.round(Number(raw) * 1000) / 1000; if (raw !== "" && Number.isFinite(v) && v > 0) setQty(l.p.id, v); }} onBlur={() => setDrafts((d) => { const n = { ...d }; delete n[l.p.id]; return n; })} className="w-16 rounded-md border border-input bg-background px-1 py-0.5 text-center font-mono text-sm" /> : <span className="w-7 text-center font-mono text-sm">{l.qty}</span>}
                <button aria-label="More" onClick={() => setQty(l.p.id, l.qty + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <span className="w-20 text-right font-mono text-sm">{peso(lineTotal(l))}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-3 border-t border-border p-4">
          <div className="flex justify-between text-sm text-muted-foreground"><span>{count} items</span><span>VAT incl.</span></div>
          <div className="flex items-baseline justify-between"><span className="font-medium">Total</span><span className="font-display text-3xl font-bold">{peso(total)}</span></div>
          {shortages.map((m) => <p key={m} role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{m}</p>)}
          <button disabled={!cart.length || shortages.length > 0} onClick={() => setPaying(true)} className="w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-40">Charge {peso(total)}</button>
        </div>
      </aside>

      {paying && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4" onClick={() => setPaying(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Record payment</h3><button aria-label="Close" onClick={() => setPaying(false)}><X className="h-5 w-5" /></button></div>
            <p className="mt-1 font-display text-4xl font-bold">{peso(total)}</p>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium" htmlFor="customer">Customer (optional)</label>
              <select id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="">No customer</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.mobile ? ` · ${customer.mobile}` : ""}</option>)}
              </select>
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Add new customer</summary>
                <div className="mt-3 space-y-2">
                  <input value={newCustomer.name} onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))} maxLength={60} placeholder="Customer name" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                  <input value={newCustomer.mobile} onChange={(e) => setNewCustomer((c) => ({ ...c, mobile: e.target.value }))} placeholder="+63 9XX XXX XXXX" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                  <label className="flex gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={newCustomer.consent} onChange={(e) => setNewCustomer((c) => ({ ...c, consent: e.target.checked }))} /> Optional. Used only for this store's receipts and promos.</label>
                </div>
              </details>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {([["cash", "Cash", Banknote], ["ewallet", "GCash", QrCode], ["card", "Card", CreditCard]] as const).map(([m, l, I]) => (
                <button key={m} onClick={() => setMethod(m)} className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-sm ${method === m ? "border-primary bg-accent text-accent-foreground" : "border-border"}`}>
                  <I className="h-5 w-5" />{l}
                </button>
              ))}
            </div>
            {method === "cash" && (
              <div className="mt-5 space-y-3">
                <input type="number" inputMode="decimal" autoFocus placeholder="Amount received" value={tendered} onChange={(e) => setTendered(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 font-mono text-lg" />
                <div className="flex flex-wrap gap-2">
                  {quick.map((q) => <button key={q} onClick={() => setTendered(String(q))} className="rounded-lg border border-border px-3 py-1.5 font-mono text-sm">{peso(q)}</button>)}
                </div>
                <div className="flex justify-between rounded-xl bg-muted p-3"><span>Change</span><span className="font-display text-xl font-bold">{peso(change)}</span></div>
              </div>
            )}
            {method === "ewallet" && (
              <div className="mt-5 flex flex-col items-center rounded-xl bg-muted p-5 text-center">
                <div className="grid h-36 w-36 grid-cols-8 gap-0.5 rounded-lg bg-card p-2">
                  {Array.from({ length: 64 }, (_, i) => <span key={i} className={(i * 7 + Math.floor(total)) % 3 === 0 ? "bg-foreground" : ""} />)}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Customer pays with GCash. Confirm once you see the payment.</p>
              </div>
            )}
            {method === "card" && <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">Tap, insert or swipe the card on your terminal, then confirm once approved.</p>}
            <button disabled={!canPay || busy} onClick={checkout} className="mt-6 w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-40">
              {busy ? "Processing…" : "Confirm payment"}
            </button>
          </div>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 print:static print:bg-transparent">
          <div className="w-full max-w-sm">
            <div id="receipt" ref={receiptRef} className="rounded-2xl bg-card p-6 font-mono text-sm text-card-foreground">
              {business?.logoSrc && <img src={business.logoSrc} alt={t("profile.logo")} className="mx-auto mb-3 h-20 w-20 object-contain" />}
              <p className="break-words text-center font-bold">{business?.name ?? shop?.shop_name ?? "Store"}</p>
              <p className="text-center text-xs text-muted-foreground">{receipt.at.toLocaleString("en-PH")}</p>
              {receipt.syncedAt && <p className="text-center text-xs text-muted-foreground">{t("offline.saleSyncedAt", { at: new Date(receipt.syncedAt).toLocaleString(lang === "tl" ? "fil-PH" : "en-PH") })}</p>}
              <p className="text-center text-xs text-muted-foreground">Receipt {receipt.no}</p>
              {receipt.pending && <p className="text-center text-xs font-semibold text-warning">{t("offline.receiptPending")}</p>}
              <div className="my-3 border-t border-dashed border-border" />
              {receipt.lines.map((l) => (
                <div key={l.p.id} className="flex justify-between py-0.5"><span className="truncate pr-2">{l.p.name} ×{l.qty}{isDecimalUnit(l.p.unit) ? ` ${l.p.unit}` : ""}</span><span>{lineTotal(l).toFixed(2)}</span></div>
              ))}
              <div className="my-3 border-t border-dashed border-border" />
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{peso(receipt.total)}</span></div>
               <div className="flex justify-between"><span>{receipt.method === "ewallet" ? "Paid: GCash" : `Paid: ${receipt.method.charAt(0).toUpperCase()}${receipt.method.slice(1)}`}</span><span>{peso(receipt.tendered)}</span></div>
              {receipt.method === "cash" && <div className="flex justify-between"><span>CHANGE</span><span>{peso(receipt.tendered - receipt.total)}</span></div>}
              <p className="mt-4 text-center text-xs text-muted-foreground">Thank you! Come again.</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 print:hidden">
              <Button variant="outline" onClick={async () => {
                const images = Array.from(receiptRef.current?.querySelectorAll("img") ?? []);
                await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
                window.print();
              }}><Printer className="h-4 w-4" /> Print</Button>
              <button onClick={() => { setReceipt(null); scanRef.current?.focus(); }} className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground">New sale</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
