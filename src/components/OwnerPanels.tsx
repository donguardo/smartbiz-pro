import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export function RefreshStatusPanel({ lang }: { lang: string }) {
  const tl = lang === "tl";
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["refresh-runs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("refresh_runs").select("id,status,started_at,finished_at,shops_processed,error").order("started_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });
  const latest = runs[0];
  const lastOk = runs.find((r) => r.status === "success");
  const errors = runs.filter((r) => r.status === "error").slice(0, 3);
  const stale = !lastOk || Date.now() - new Date(lastOk.finished_at ?? lastOk.started_at).getTime() > 36 * 3600000;
  const status = !latest ? "none" : latest.status;
  const badge =
    status === "success" && !stale ? { icon: CheckCircle2, cls: "text-success", text: tl ? "Gumagana" : "Running on schedule" }
    : status === "running" ? { icon: RefreshCw, cls: "text-primary", text: tl ? "Tumatakbo ngayon" : "Running now" }
    : status === "error" ? { icon: XCircle, cls: "text-destructive", text: tl ? "Pumalya ang huling takbo" : "Last run failed" }
    : status === "none" ? { icon: Clock, cls: "text-muted-foreground", text: tl ? "Hindi pa tumatakbo" : "Not run yet" }
    : { icon: Clock, cls: "text-warning", text: tl ? "Huli na ang update" : "Overdue" };
  const Icon = badge.icon;
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-bold"><RefreshCw className="h-4 w-4" />{tl ? "Araw-araw na update" : "Scheduled refresh"}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{tl ? "Ina-update ang forecast at tip araw-araw." : "Updates forecasts, weekly opportunity and the daily tip."}</p>
      {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : (
        <div className="mt-3 space-y-2 text-sm">
          <p className={`flex items-center gap-2 font-semibold ${badge.cls}`}><Icon className="h-4 w-4" />{badge.text}</p>
          <p><span className="text-muted-foreground">{tl ? "Huling matagumpay:" : "Last successful run:"}</span> <b>{when(lastOk?.finished_at ?? null)}</b>{lastOk ? ` · ${lastOk.shops_processed} ${tl ? "tindahan" : "shops"}` : ""}</p>
          {errors.length > 0 && (
            <ul className="space-y-1">
              {errors.map((e) => <li key={e.id} className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{when(e.started_at)} — {e.error ?? "Unknown error"}</li>)}
            </ul>
          )}
          {errors.length === 0 && latest && <p className="text-xs text-muted-foreground">{tl ? "Walang error kamakailan." : "No recent errors."}</p>}
        </div>
      )}
    </section>
  );
}

export function ActivityLogPanel({ lang }: { lang: string }) {
  const tl = lang === "tl";
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["activity-log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_log").select("id,actor_name,actor_role,entity,action,summary,created_at").order("created_at", { ascending: false }).limit(25);
      if (error) throw error;
      return data;
    },
  });
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-bold"><Activity className="h-4 w-4" />{tl ? "Talaan ng gawain" : "Activity log"}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{tl ? "Sino ang nagbenta at nagbago ng records." : "Who made each sale and changed shop records."}</p>
      {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{tl ? "Wala pang gawain." : "No activity yet."}</p>
      ) : (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">{r.summary}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.actor_name}{r.actor_role ? ` · ${r.actor_role === "owner" ? (tl ? "May-ari" : "Owner") : (tl ? "Kahera" : "Cashier")}` : r.actor_name === "System" ? "" : ` · ${tl ? "Dating staff" : "Former staff"}`} · {when(r.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
