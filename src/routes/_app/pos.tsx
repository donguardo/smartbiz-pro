import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, Minus, Plus, Printer, QrCode, ScanLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, fetchProfile, qk, type Product } from "@/lib/store";
import { peso } from "@/lib/format";

export const Route = createFileRoute("/_app/pos")({
  head: () => ({ meta: [
    { title: "Register — BizManager.ai | MAS KITA, MAS TUBO!" },
    { name: "description", content: "Scan items, take payment and print receipts." },
    { property: "og:title", content: "Register — BizManager.ai | MAS KITA, MAS TUBO!" },
    { property: "og:description", content: "Scan items, take payment and print receipts." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: POS,
});

type Line = { p: Product; qty: number };
type Method = "cash" | "ewallet" | "card";
type Receipt = { no: string; lines: Line[]; total: number; method: Method; tendered: number; at: Date };

function POS() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: qk.products, queryFn: fetchProducts });
  const { data: profile } = useQuery({ queryKey: qk.profile, queryFn: fetchProfile });
  const [cart, setCart] = useState<Line[]>([]);
  const [scan, setScan] = useState("");
  const [cat, setCat] = useState("All");
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<Method>("cash");
  const [tendered, setTendered] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const cats = ["All", ...new Set(products.map((p) => p.category))];
  const shown = products.filter((p) => (cat === "All" || p.category === cat) && (!scan || p.name.toLowerCase().includes(scan.toLowerCase()) || p.sku.includes(scan)));
  const total = useMemo(() => cart.reduce((s, l) => s + Number(l.p.price) * l.qty, 0), [cart]);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const add = (p: Product) => setCart((c) => {
    const f = c.find((l) => l.p.id === p.id);
    if (f && f.qty >= p.stock) toast.warning(`Only ${p.stock} ${p.name} in stock`);
    return f ? c.map((l) => (l.p.id === p.id ? { ...l, qty: l.qty + 1 } : l)) : [...c, { p, qty: 1 }];
  });
  const setQty = (id: string, qty: number) => setCart((c) => (qty <= 0 ? c.filter((l) => l.p.id !== id) : c.map((l) => (l.p.id === id ? { ...l, qty } : l))));

  const onScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    const p = products.find((x) => x.sku === code) ?? (shown.length === 1 ? shown[0] : undefined);
    if (p) { add(p); setScan(""); } else toast.error(`No item matches "${code}"`);
    scanRef.current?.focus();
  };

  const change = method === "cash" ? Math.max(0, Number(tendered || 0) - total) : 0;
  const canPay = cart.length > 0 && (method !== "cash" || Number(tendered || 0) >= total);

  const checkout = async () => {
    setBusy(true);
    try {
      const receipt_no = `R-${Date.now().toString(36).toUpperCase()}`;
      const cost_total = cart.reduce((s, l) => s + Number(l.p.cost) * l.qty, 0);
      const { data: sale, error } = await supabase.from("sales")
        .insert({ receipt_no, total, cost_total, payment_method: method, amount_tendered: method === "cash" ? Number(tendered) : total })
        .select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("sale_items").insert(cart.map((l) => ({ sale_id: sale.id, product_id: l.p.id, name: l.p.name, category: l.p.category, qty: l.qty, price: l.p.price, cost: l.p.cost })));
      if (e2) throw e2;
      await Promise.all(cart.map((l) => supabase.rpc("decrement_stock", { _product_id: l.p.id, _qty: l.qty })));
      setReceipt({ no: receipt_no, lines: cart, total, method, tendered: method === "cash" ? Number(tendered) : total, at: new Date() });
      setCart([]); setTendered(""); setPaying(false);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally { setBusy(false); }
  };

  const quick = [total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, 1000].filter((v, i, a) => v > 0 && a.indexOf(v) === i);

  return (
    <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-4">
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
            <button key={p.id} onClick={() => add(p)} className="group flex flex-col rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary active:scale-[0.98]">
              <span className="text-xs text-muted-foreground">{p.category}</span>
              <span className="mt-1 line-clamp-2 font-medium leading-tight">{p.name}</span>
              <span className="mt-auto flex items-end justify-between pt-3">
                <span className="font-display text-lg font-semibold">{peso(Number(p.price))}</span>
                <span className={`font-mono text-[11px] ${p.stock <= p.reorder_level ? "text-destructive" : "text-muted-foreground"}`}>{p.stock} left</span>
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
                <p className="font-mono text-xs text-muted-foreground">{peso(Number(l.p.price))}</p>
              </div>
              <div className="flex items-center gap-1">
                <button aria-label="Less" onClick={() => setQty(l.p.id, l.qty - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border">{l.qty === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}</button>
                <span className="w-7 text-center font-mono text-sm">{l.qty}</span>
                <button aria-label="More" onClick={() => setQty(l.p.id, l.qty + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <span className="w-20 text-right font-mono text-sm">{peso(Number(l.p.price) * l.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-3 border-t border-border p-4">
          <div className="flex justify-between text-sm text-muted-foreground"><span>{count} items</span><span>VAT incl.</span></div>
          <div className="flex items-baseline justify-between"><span className="font-medium">Total</span><span className="font-display text-3xl font-bold">{peso(total)}</span></div>
          <button disabled={!cart.length} onClick={() => setPaying(true)} className="w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-40">Charge {peso(total)}</button>
        </div>
      </aside>

      {paying && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4" onClick={() => setPaying(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Take payment</h3><button aria-label="Close" onClick={() => setPaying(false)}><X className="h-5 w-5" /></button></div>
            <p className="mt-1 font-display text-4xl font-bold">{peso(total)}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {([["cash", "Cash", Banknote], ["ewallet", "E-wallet / QR", QrCode], ["card", "Card", CreditCard]] as const).map(([m, l, I]) => (
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
                <p className="mt-3 text-sm text-muted-foreground">Customer scans with GCash, Maya or any QR Ph app. Confirm once you see the payment.</p>
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
            <div id="receipt" className="rounded-2xl bg-card p-6 font-mono text-sm text-card-foreground">
              <p className="text-center font-bold uppercase">{profile?.business_name ?? "Store"}</p>
              <p className="text-center text-xs text-muted-foreground">{receipt.at.toLocaleString("en-PH")}</p>
              <p className="text-center text-xs text-muted-foreground">Receipt {receipt.no}</p>
              <div className="my-3 border-t border-dashed border-border" />
              {receipt.lines.map((l) => (
                <div key={l.p.id} className="flex justify-between py-0.5"><span className="truncate pr-2">{l.p.name} ×{l.qty}</span><span>{(Number(l.p.price) * l.qty).toFixed(2)}</span></div>
              ))}
              <div className="my-3 border-t border-dashed border-border" />
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{peso(receipt.total)}</span></div>
              <div className="flex justify-between"><span>{receipt.method === "ewallet" ? "E-WALLET/QR" : receipt.method.toUpperCase()}</span><span>{peso(receipt.tendered)}</span></div>
              {receipt.method === "cash" && <div className="flex justify-between"><span>CHANGE</span><span>{peso(receipt.tendered - receipt.total)}</span></div>}
              <p className="mt-4 text-center text-xs text-muted-foreground">Thank you! Come again.</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 print:hidden">
              <button onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 font-semibold"><Printer className="h-4 w-4" /> Print</button>
              <button onClick={() => { setReceipt(null); scanRef.current?.focus(); }} className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground">New sale</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
