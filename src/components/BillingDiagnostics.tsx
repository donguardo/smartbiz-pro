import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const when = (d: string) => new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
const modeName = (e: string | null | undefined) => (e === "live" ? "Live" : e === "sandbox" ? "Test" : "—");

export function BillingLinkCheck() {
  const q = useQuery({
    queryKey: ["billing-link-check"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_billing_link_check");
      if (error) throw error;
      return data[0];
    },
  });
  const c = q.data;
  const rows: { ok: boolean; text: string }[] = [];
  if (c) {
    if (!c.paddle_subscription_id) rows.push({ ok: true, text: `No subscription yet — payment mode is ${modeName(c.payments_env)}` });
    else {
      rows.push({ ok: !!c.shop_ok, text: c.shop_ok ? "Subscription is linked to this shop" : "Subscription is NOT linked to this shop" });
      rows.push({ ok: !!c.env_ok, text: c.env_ok ? `Payment mode matches (${modeName(c.payments_env)})` : `Subscription is ${modeName(c.subscription_env)} but the app is in ${modeName(c.payments_env)} mode — it won't count` });
      rows.push({ ok: true, text: `Paddle status: ${c.subscription_status}` });
    }
    if (Number(c.other_env_count) > 0) rows.push({ ok: true, text: `${c.other_env_count} subscription(s) from the other payment mode are ignored` });
  }
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Subscription link check</h2>
        <Button size="sm" variant="ghost" onClick={() => void q.refetch()} aria-label="Re-check"><RefreshCw className="h-4 w-4" /></Button></div>
      {q.isLoading ? <p className="text-muted-foreground">Checking…</p> : q.error ? <p className="text-destructive">Could not run the check.</p> : (
        <ul className="space-y-2 text-sm">{rows.map((r) => (
          <li key={r.text} className="flex items-start gap-2">{r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}<span>{r.text}</span></li>
        ))}</ul>
      )}
    </div>
  );
}

export function BillingEventLog() {
  const q = useQuery({
    queryKey: ["billing-events"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_events").select("id, event_type, sync_status, detail, environment, created_at").order("created_at", { ascending: false }).limit(25);
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-bold">Payment updates received</h2>
      {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : !q.data?.length ? <p className="text-sm text-muted-foreground">No updates from Paddle yet.</p> : (
        <ul className="divide-y divide-border text-sm">{q.data.map((e) => (
          <li key={e.id} className="flex items-start justify-between gap-3 py-2">
            <div><p className="font-medium">{e.event_type.replace("subscription.", "Subscription ")}</p><p className="text-muted-foreground">{e.detail} · {modeName(e.environment)} · {when(e.created_at)}</p></div>
            <span className={e.sync_status === "synced" ? "shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary" : "shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive"}>
              {e.sync_status === "synced" ? "Synced" : e.sync_status === "skipped" ? "Skipped" : "Failed"}
            </span>
          </li>
        ))}</ul>
      )}
    </div>
  );
}
