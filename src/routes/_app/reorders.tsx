import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCopy, PackageCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { OwnerOnly } from "@/components/OwnerOnly";
import { isDecimalUnit, qk } from "@/lib/store";
import { peso } from "@/lib/format";

export const Route = createFileRoute("/_app/reorders")({
  validateSearch: z.object({ id: z.string().optional() }),
  head: () => ({ meta: [
    { title: "Supplier reorders — MVP BizManager" },
    { name: "description", content: "Draft supplier reorders from low-stock alerts with quantities and estimated costs." },
    { property: "og:title", content: "Supplier reorders — MVP BizManager" },
    { property: "og:description", content: "Draft supplier reorders from low-stock alerts with quantities and estimated costs." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <OwnerRedirect><Reorders /></OwnerRedirect>,
});

const STATUS: Record<string, string> = { draft: "Draft", sent: "Sent", received: "Received", cancelled: "Cancelled" };
const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Reorders() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { data: orders = [] } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("id,status,created_at,supplier_id,suppliers(name),purchase_order_items(qty,unit_cost)").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-5 p-4 md:p-8">
      <div><h1 className="text-3xl font-bold">Supplier reorders</h1><p className="text-muted-foreground">Turn low-stock alerts into draft orders from the bell, then edit, copy and mark them received.</p></div>
      {id ? <OrderEditor id={id} onClose={() => navigate({ to: "/reorders", search: {} })} /> : null}
      <section className="rounded-2xl border border-border bg-card">
        {orders.length === 0 ? <p className="p-8 text-center text-muted-foreground">No reorders yet. Open the bell and tap “Reorder” on a low-stock alert.</p> : (
          <ul className="divide-y divide-border">
            {orders.map((o) => {
              const total = o.purchase_order_items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_cost ?? 0), 0);
              return (
                <li key={o.id}><Link to="/reorders" search={{ id: o.id }} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm hover:bg-muted">
                  <span><b>{o.suppliers?.name ?? "No supplier yet"}</b><span className="block text-xs text-muted-foreground">{o.purchase_order_items.length} items · {when(o.created_at)}</span></span>
                  <span className="flex items-center gap-3"><span className="font-mono">{peso(total)}</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{STATUS[o.status]}</span></span>
                </Link></li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function OrderEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const key = ["purchase-order", id];
  const { data: order, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*, purchase_order_items(*)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: async () => { const { data, error } = await supabase.from("suppliers").select("*").order("name"); if (error) throw error; return data; } });
  const refresh = async () => { await Promise.all([qc.refetchQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ["purchase-orders"] })]); };
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!order) return <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">This reorder was not found.</p>;
  const draft = order.status === "draft";
  const items = [...order.purchase_order_items].sort((a, b) => a.product_name.localeCompare(b.product_name));
  const total = items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_cost ?? 0), 0);
  const missingCost = items.filter((i) => i.unit_cost == null).length;
  const supplier = suppliers.find((s) => s.id === order.supplier_id);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    if (ok) toast.success(ok);
    await refresh();
    return true;
  };
  const saveItem = (itemId: string, field: "qty" | "unit_cost", raw: string, unit: string) => {
    const v = raw.trim() === "" ? null : Number(raw);
    if (field === "qty" && (!v || v <= 0 || (!isDecimalUnit(unit) && !Number.isInteger(v)))) { toast.error(isDecimalUnit(unit) ? "Enter a quantity above 0" : "Enter a whole quantity above 0"); return; }
    if (v != null && (!Number.isFinite(v) || v < 0)) { toast.error("Enter 0 or more"); return; }
    void run(() => supabase.from("purchase_order_items").update(field === "qty" ? { qty: v as number } : { unit_cost: v }).eq("id", itemId));
  };
  const copyText = async () => {
    const lines = [supplier ? `Order for ${supplier.name}:` : "Order:", ...items.map((i) => `• ${i.product_name} — ${Number(i.qty)} ${i.unit}`), order.note ? `Note: ${order.note}` : ""].filter(Boolean);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Order copied — paste it in Messenger, Viber or SMS");
  };
  const field = "rounded-md border border-input bg-background px-2 py-1 text-sm";

  return (
    <section className="space-y-4 rounded-2xl border border-primary/40 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="text-xl font-bold">Reorder · {STATUS[order.status]}</h2><p className="text-xs text-muted-foreground">Created {when(order.created_at)}{order.received_at ? ` · received ${when(order.received_at)}` : ""}</p></div>
        <button aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></button>
      </div>
      <label className="block text-xs text-muted-foreground">Supplier
        <select disabled={!draft || busy} value={order.supplier_id ?? ""} onChange={(e) => run(() => supabase.from("purchase_orders").update({ supplier_id: e.target.value || null, updated_at: new Date().toISOString() }).eq("id", id))} className={`mt-1 block w-full ${field} py-2`}>
          <option value="">Choose later</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {suppliers.length === 0 && <span className="mt-1 block">Add suppliers in <Link to="/business" className="text-primary underline">Business</Link>.</span>}
      </label>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Product</th><th className="p-2 text-right">Quantity</th><th className="p-2 text-right">Est. unit cost</th><th className="p-2 text-right">Est. total</th>{draft && <th className="p-2" />}</tr></thead>
          <tbody className="divide-y divide-border">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="p-2 font-medium">{i.product_name}</td>
                <td className="p-2 text-right">{draft ? <input key={`q${i.qty}`} aria-label={`Quantity of ${i.product_name}`} type="number" min="0" step={isDecimalUnit(i.unit) ? "0.001" : "1"} defaultValue={Number(i.qty)} onBlur={(e) => Number(e.target.value) !== Number(i.qty) && saveItem(i.id, "qty", e.target.value, i.unit)} className={`w-20 text-right font-mono ${field}`} /> : Number(i.qty)} {i.unit}</td>
                <td className="p-2 text-right">{draft ? <input key={`c${i.unit_cost}`} aria-label={`Unit cost of ${i.product_name}`} type="number" min="0" step="0.01" placeholder="—" defaultValue={i.unit_cost == null ? "" : Number(i.unit_cost)} onBlur={(e) => e.target.value !== (i.unit_cost == null ? "" : String(Number(i.unit_cost))) && saveItem(i.id, "unit_cost", e.target.value, i.unit)} className={`w-24 text-right font-mono ${field}`} /> : i.unit_cost == null ? "—" : peso(Number(i.unit_cost))}</td>
                <td className="p-2 text-right font-mono">{i.unit_cost == null ? "—" : peso(Number(i.qty) * Number(i.unit_cost))}</td>
                {draft && <td className="p-2 text-right"><button aria-label={`Remove ${i.product_name}`} disabled={busy} onClick={() => run(() => supabase.from("purchase_order_items").delete().eq("id", i.id))} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>}
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No items in this reorder.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-right text-sm">Estimated total <b className="font-display text-xl">{peso(total)}</b>{missingCost > 0 && <span className="block text-xs text-muted-foreground">{missingCost} item{missingCost === 1 ? " has" : "s have"} no cost yet</span>}</p>
      <label className="block text-xs text-muted-foreground">Note for supplier
        <textarea disabled={!draft} maxLength={1000} defaultValue={order.note ?? ""} onBlur={(e) => e.target.value !== (order.note ?? "") && run(() => supabase.from("purchase_orders").update({ note: e.target.value || null }).eq("id", id))} className={`mt-1 block w-full ${field} py-2`} rows={2} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button onClick={copyText} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><ClipboardCopy className="h-4 w-4" /> Copy order text</button>
        {draft && <button disabled={busy || !items.length} onClick={() => run(() => supabase.from("purchase_orders").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", id), "Marked as sent")} className="rounded-lg border border-border px-3 py-2 text-sm">Mark as sent</button>}
        {(order.status === "draft" || order.status === "sent") && <>
          <button disabled={busy || !items.length} onClick={async () => { if (!confirm("Add these quantities to stock now?")) return; if (await run(() => supabase.rpc("receive_purchase_order", { _order_id: id }), "Stock updated from this order")) void qc.invalidateQueries({ queryKey: qk.products }); }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><PackageCheck className="h-4 w-4" /> Mark received</button>
          <button disabled={busy} onClick={() => run(() => supabase.from("purchase_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id), "Reorder cancelled")} className="rounded-lg px-3 py-2 text-sm text-destructive">Cancel order</button>
        </>}
      </div>
    </section>
  );
}
