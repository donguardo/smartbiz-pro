import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isDecimalUnit, qk, type Product } from "@/lib/store";

type Kind = "restock" | "loss" | "correction";
const KINDS: { k: Kind; label: string; hint: string }[] = [
  { k: "restock", label: "Restock", hint: "Add received stock" },
  { k: "loss", label: "Loss", hint: "Damaged, expired or missing" },
  { k: "correction", label: "Correction", hint: "Set the counted amount" },
];
const REASONS: Record<Kind, string[]> = {
  restock: ["Supplier delivery", "Returned to shelf"],
  loss: ["Damaged", "Expired", "Missing / stolen", "Used in store"],
  correction: ["Physical count", "Encoding error"],
};
export const stockMovementsKey = ["stock-movements"];

export function StockAdjustDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("restock");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(qty);
  const after = qty === "" || !Number.isFinite(n) ? null : kind === "restock" ? product.stock + n : kind === "loss" ? product.stock - n : n;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("adjust_stock", { _product_id: product.id, _kind: kind, _qty: n, _reason: reason });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${product.name} stock updated`);
    qc.invalidateQueries({ queryKey: qk.products });
    qc.invalidateQueries({ queryKey: stockMovementsKey });
    onClose();
  };
  const input = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-t-3xl bg-card p-6 sm:rounded-3xl">
        <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Adjust stock</h3><button type="button" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></button></div>
        <p className="text-sm"><b>{product.name}</b> · now {product.stock} {product.unit}</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Adjustment type">
          {KINDS.map((o) => (
            <button key={o.k} type="button" role="radio" aria-checked={kind === o.k} onClick={() => { setKind(o.k); setReason(""); }}
              className={`rounded-xl border p-2 text-left text-sm ${kind === o.k ? "border-primary bg-accent text-accent-foreground" : "border-border"}`}>
              <span className="block font-semibold">{o.label}</span><span className="block text-[11px] text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>
        <label className="block text-xs text-muted-foreground">{kind === "correction" ? `Counted stock (${product.unit})` : `Quantity (${product.unit})`}
          <input required type="number" min="0" step={isDecimalUnit(product.unit) ? "0.001" : "1"} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={input} />
        </label>
        <label className="block text-xs text-muted-foreground">Reason
          <input required minLength={3} maxLength={300} list="stock-reasons" value={reason} onChange={(e) => setReason(e.target.value)} className={input} placeholder="e.g. Supplier delivery" />
          <datalist id="stock-reasons">{REASONS[kind].map((r) => <option key={r} value={r} />)}</datalist>
        </label>
        <div className="flex flex-wrap gap-1.5">{REASONS[kind].map((r) => <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-border px-2.5 py-1 text-xs">{r}</button>)}</div>
        {after !== null && <p className={`rounded-lg bg-muted p-3 text-sm ${after < 0 ? "text-destructive" : ""}`}>New stock: <b>{Math.round(after * 1000) / 1000} {product.unit}</b></p>}
        <button disabled={busy || after === null || after < 0} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save adjustment"}</button>
      </form>
    </div>
  );
}

export function StockHistoryPanel() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: stockMovementsKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  const label = { restock: "Restock", loss: "Loss", correction: "Correction" } as Record<string, string>;
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-bold"><History className="h-4 w-4" /> Stock history</h2>
      <p className="mt-1 text-xs text-muted-foreground">Every restock, loss and correction, with who did it and why.</p>
      {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No stock adjustments yet.</p> : (
        <ul className="mt-3 max-h-96 divide-y divide-border overflow-y-auto">
          {rows.map((r) => {
            const change = Number(r.qty_change);
            return (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0"><b>{r.product_name}</b> · {label[r.kind]} — {r.reason}
                  <span className="block text-xs text-muted-foreground">{r.actor_name} · {new Date(r.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></span>
                <span className="font-mono text-xs"><span className={change >= 0 ? "text-success" : "text-destructive"}>{change >= 0 ? "▲ +" : "▼ "}{change}</span> · {Number(r.stock_before)} → {Number(r.stock_after)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
