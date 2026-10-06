import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { groupDeliveries } from "@/lib/billing-deliveries";

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

const badge = (s: string) => s === "synced" ? "shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary" : "shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive";
const statusName = (s: string) => (s === "synced" ? "Synced" : s === "skipped" ? "Skipped" : "Failed");

export function BillingEventLog() {
  const q = useQuery({
    queryKey: ["billing-events"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_events").select("id, paddle_event_id, event_type, sync_status, detail, environment, created_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return groupDeliveries(data).slice(0, 25);
    },
  });
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Payment updates received</h2>
        <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new Event(TEST_EVENT))}>Test failure alert</Button></div>
      <p className="text-xs text-muted-foreground">The test only shows the alert on this screen. Nothing is sent to Paddle or saved.</p>
      {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : !q.data?.length ? <p className="text-sm text-muted-foreground">No updates from Paddle yet.</p> : (
        <ul className="divide-y divide-border text-sm">{q.data.map(({ key, attempts, final }) => (
          <li key={key} className="py-2">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-medium">{final.event_type.replace("subscription.", "Subscription ")}</p>
                <p className="text-muted-foreground">{final.detail} · {modeName(final.environment)} · {when(final.created_at)}</p>
                {final.sync_status !== "synced" && <FailureInfo reason={final.detail} eventId={final.paddle_event_id} />}</div>
              <span className={badge(final.sync_status)}>Final: {statusName(final.sync_status)}</span>
            </div>
            {attempts.length > 1 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-muted-foreground">{attempts.length} delivery attempts</summary>
                <ol className="mt-1 space-y-1 border-l border-border pl-3 text-xs">{attempts.map((a, i) => (
                  <li key={a.id}><div className="flex justify-between gap-2"><span>Attempt {i + 1} · {when(a.created_at)} · {a.detail}</span><span className={badge(a.sync_status)}>{statusName(a.sync_status)}</span></div>
                    {a.sync_status !== "synced" && <FailureInfo reason={a.detail} eventId={a.paddle_event_id} />}</li>
                ))}</ol>
              </details>
            )}
          </li>
        ))}</ul>
      )}
    </div>
  );
}

function FailureInfo({ reason, eventId }: { reason: string | null; eventId: string | null }) {
  return (
    <div className="mt-1 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
      <p>Reason: {reason || "Unknown"}</p>
      <p className="break-all">Paddle event ID: <span className="font-mono select-all">{eventId ?? "—"}</span>
        {eventId && <button type="button" className="ml-2 underline" onClick={() => void navigator.clipboard.writeText(eventId).then(() => toast.success("Event ID copied"))}>Copy</button>}</p>
    </div>
  );
}

const SEEN_KEY = "billing-failure-seen-v1";
const TEST_EVENT = "billing-failure-test";

// Owners get a toast + banner when an event's final delivery failed; dismissing remembers it on this device.
export function BillingFailureAlert() {
  const [seen, setSeen] = useState<string | null>(null);
  const [test, setTest] = useState(false);
  useEffect(() => {
    const on = () => { setTest(true); toast.error("TEST: 1 payment update failed to sync", { id: "billing-failure-test" }); };
    window.addEventListener(TEST_EVENT, on);
    return () => window.removeEventListener(TEST_EVENT, on);
  }, []);
  useEffect(() => { setSeen(localStorage.getItem(SEEN_KEY) ?? ""); }, []);
  const q = useQuery({
    queryKey: ["billing-events-failures"],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_events").select("id, paddle_event_id, event_type, sync_status, detail, environment, created_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return groupDeliveries(data).filter((g) => g.final.sync_status === "failed");
    },
  });
  const fresh = seen === null ? [] : (q.data ?? []).filter((g) => g.final.created_at > seen);
  const latest = fresh[0]?.final.created_at;
  useEffect(() => {
    if (latest) toast.error(`${fresh.length} payment update(s) failed to sync`, { id: "billing-failure" });
  }, [latest, fresh.length]);
  if (test && !fresh.length) return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-sm text-destructive">
      <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />TEST ALERT — 1 Paddle payment update failed to sync. Latest: Could not update subscription (sample)</span>
      <span className="flex gap-3"><Link to="/billing" className="font-medium underline">Investigate</Link><button type="button" className="underline" onClick={() => setTest(false)}>Dismiss</button></span>
    </div>
  );
  if (!fresh.length || !latest) return null;
  const dismiss = () => { localStorage.setItem(SEEN_KEY, latest); setSeen(latest); };
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-sm text-destructive">
      <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{fresh.length} Paddle payment update(s) failed to sync. Latest: {fresh[0]!.final.detail}</span>
      <span className="flex gap-3"><Link to="/billing" className="font-medium underline">Investigate</Link><button type="button" className="underline" onClick={dismiss}>Dismiss</button></span>
    </div>
  );
}
