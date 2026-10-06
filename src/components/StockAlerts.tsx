import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk, type Product } from "@/lib/store";

const alertsKey = ["stock-alerts"];

async function fetchAlerts() {
  const { data, error } = await supabase.from("stock_alerts").select("*").is("read_at", null).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

/** Owner-only bell showing unread low-stock alerts. Pops a toast when new alerts arrive. */
export function StockAlertsBell({ className = "" }: { className?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [reorderIds, setReorderIds] = useState<string[] | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: async () => { const { data, error } = await supabase.from("suppliers").select("*").order("name"); if (error) throw error; return data; }, enabled: open });
  const seen = useRef<Set<string> | null>(null);
  const { data: alerts = [] } = useQuery({ queryKey: alertsKey, queryFn: fetchAlerts, refetchInterval: 2 * 60000, refetchOnWindowFocus: true });

  useEffect(() => {
    const ids = new Set(alerts.map((a) => a.id));
    if (seen.current) {
      const fresh = alerts.filter((a) => !seen.current!.has(a.id));
      if (fresh.length === 1) toast.warning(`Low stock: ${fresh[0]!.product_name} (${Number(fresh[0]!.stock_at)} ${fresh[0]!.unit} left)`);
      else if (fresh.length > 1) toast.warning(`${fresh.length} products are low on stock`);
    }
    seen.current = ids;
  }, [alerts]);

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await supabase.from("stock_alerts").update({ read_at: new Date().toISOString() }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: alertsKey });
  };

  const createReorder = async () => {
    if (!reorderIds?.length) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("create_reorder_from_alerts", { _alert_ids: reorderIds, ...(supplierId ? { _supplier_id: supplierId } : {}) });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Draft reorder created");
    setReorderIds(null); setOpen(false);
    void qc.invalidateQueries({ queryKey: alertsKey });
    void navigate({ to: "/reorders", search: { id: data } });
  };

  const Icon = alerts.length ? BellRing : Bell;
  return (
    <div className={`relative ${className}`}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Low-stock alerts (${alerts.length} unread)`} aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border">
        <Icon className="h-4 w-4" />
        {alerts.length > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-[18px] text-destructive-foreground">{alerts.length > 9 ? "9+" : alerts.length}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Low-stock alerts" className="absolute right-0 z-50 mt-2 w-[min(320px,calc(100vw-1.5rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl md:left-0 md:right-auto md:bottom-11 md:mt-0">
          <div className="flex items-center justify-between"><p className="font-semibold">Low-stock alerts</p><button aria-label="Close" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
          {alerts.length === 0 ? <p className="py-4 text-sm text-muted-foreground">All stocked up. No new alerts.</p> : (
            <>
              <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                    <span><b>{a.product_name}</b><span className="block text-xs text-muted-foreground">{Number(a.stock_at)} {a.unit} left · alert at {Number(a.threshold)} · {new Date(a.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></span>
                    <span className="flex shrink-0 flex-col items-end gap-1"><button onClick={() => setReorderIds([a.id])} className="text-xs font-semibold text-primary underline">Reorder</button><button onClick={() => markRead([a.id])} className="text-xs text-muted-foreground underline">Dismiss</button></span>
                  </li>
                ))}
              </ul>
              {reorderIds && <div className="mt-2 space-y-2 rounded-lg border border-primary/40 p-2 text-sm">
                <p className="font-medium">Draft reorder for {reorderIds.length} product{reorderIds.length === 1 ? "" : "s"}</p>
                <select aria-label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1.5">
                  <option value="">Choose supplier later</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="flex gap-2"><button disabled={creating} onClick={createReorder} className="flex-1 rounded-md bg-primary py-1.5 font-semibold text-primary-foreground disabled:opacity-50">{creating ? "Creating…" : "Create draft"}</button><button onClick={() => setReorderIds(null)} className="rounded-md border border-border px-3">Cancel</button></div>
              </div>}
              <div className="mt-2 flex flex-wrap justify-between gap-2">
                <button onClick={() => setReorderIds(alerts.map((a) => a.id))} className="text-sm font-semibold text-primary underline">Reorder all</button>
                <Link to="/inventory" onClick={() => setOpen(false)} className="text-sm font-medium text-primary">Open Products</Link>
                <button onClick={() => markRead(alerts.map((a) => a.id))} className="text-sm text-muted-foreground underline">Mark all read</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Owner card: turn alerts on/off and set each tracked product's alert threshold. */
export function LowStockSettings({ shopId, products }: { shopId: string; products: Product[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { data: enabled } = useQuery({
    queryKey: ["low-stock-alerts-enabled", shopId],
    queryFn: async () => { const { data, error } = await supabase.from("shops").select("low_stock_alerts").eq("id", shopId).single(); if (error) throw error; return data.low_stock_alerts; },
  });
  const toggle = async () => {
    const { error } = await supabase.from("shops").update({ low_stock_alerts: !enabled }).eq("id", shopId);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["low-stock-alerts-enabled", shopId] });
  };
  const tracked = products.filter((p) => p.track_stock && !p.archived_at);
  const saveThreshold = async (p: Product) => {
    const v = Number(draft[p.id]);
    if (!Number.isFinite(v) || v < 0) { toast.error("Enter 0 or more"); return; }
    const { error } = await supabase.rpc("update_product", { _id: p.id, _data: { reorder_level: Math.round(v) } });
    if (error) { toast.error(error.message); return; }
    setDraft((d) => { const n = { ...d }; delete n[p.id]; return n; });
    toast.success(`Alert for ${p.name} set at ${Math.round(v)} ${p.unit}`);
    void qc.refetchQueries({ queryKey: qk.products });
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-sm">
      <label className="flex items-center justify-between gap-3">
        <span><span className="font-medium">Low-stock alerts</span><span className="block text-xs text-muted-foreground">Owners get a bell alert when a tracked product drops to its alert level.</span></span>
        <input type="checkbox" role="switch" className="h-5 w-5 accent-primary" checked={!!enabled} onChange={toggle} />
      </label>
      <button onClick={() => setOpen((o) => !o)} className="mt-2 text-xs font-medium text-primary underline">{open ? "Hide alert levels" : `Set alert levels (${tracked.length} products)`}</button>
      {open && (
        <ul className="mt-2 max-h-80 divide-y divide-border overflow-y-auto">
          {tracked.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0"><span className="block truncate font-medium">{p.name}</span><span className="text-xs text-muted-foreground">{p.stock} {p.unit} in stock</span></span>
              <span className="flex shrink-0 items-center gap-1">
                <input aria-label={`Alert level for ${p.name}`} type="number" min="0" step="1" value={draft[p.id] ?? String(p.reorder_level)} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                  className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right font-mono" />
                {draft[p.id] !== undefined && <button onClick={() => saveThreshold(p)} className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">Save</button>}
              </span>
            </li>
          ))}
          {tracked.length === 0 && <li className="py-2 text-muted-foreground">No products track stock yet.</li>}
        </ul>
      )}
    </section>
  );
}
