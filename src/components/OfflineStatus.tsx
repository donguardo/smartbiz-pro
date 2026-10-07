import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudUpload, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { peso } from "@/lib/format";
import { discardQueuedSale, retryQueuedSale, syncQueuedSales, useOnline, useQueuedSales, type QueuedSale } from "@/lib/offline";

/** App-wide offline banner and automatic sync of sales recorded without internet. */
export function OfflineStatus() {
  const { t } = useT();
  const online = useOnline();
  const queue = useQueuedSales();
  const qc = useQueryClient();
  const waiting = queue.filter((s) => !s.error).length;

  useEffect(() => {
    if (!online) return;
    void syncQueuedSales().then(({ synced, failed }) => {
      if (synced) { toast.success(t("offline.synced").replace("{n}", String(synced))); void qc.invalidateQueries(); }
      if (failed) toast.error(t("offline.syncFailed"));
    });
  }, [online, waiting, qc, t]);

  if (online && queue.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm ${online ? "border-primary/40 bg-primary/10" : "border-warning/50 bg-warning/15"}`}>
      {online ? <CloudUpload className="h-4 w-4" /> : <WifiOff className="h-4 w-4 text-warning" />}
      <span className="font-semibold">{online ? t("offline.syncing") : t("offline.banner")}</span>
      {waiting > 0 && <span className="opacity-80">· {t("offline.waiting").replace("{n}", String(waiting))}</span>}
    </div>
  );
}

/** Sales the server refused during sync (for example, not enough stock any more). */
export function FailedQueuedSales() {
  const { t } = useT();
  const failed = useQueuedSales().filter((s): s is QueuedSale & { error: string } => !!s.error);
  if (!failed.length) return null;
  return (
    <section className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4">
      <h2 className="font-bold text-destructive">{t("offline.failedTitle")}</h2>
      <ul className="mt-2 space-y-2">
        {failed.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{new Date(s.createdAt).toLocaleString("en-PH")} · {peso(s.total)} · <span className="text-destructive">{s.error}</span></span>
            <span className="flex gap-2">
              <button onClick={() => void retryQueuedSale(s.id)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1"><RefreshCw className="h-3 w-3" />{t("offline.retry")}</button>
              <button onClick={() => { if (confirm(t("offline.discardConfirm"))) void discardQueuedSale(s.id); }} className="flex items-center gap-1 rounded-md border border-border px-2 py-1"><Trash2 className="h-3 w-3" />{t("offline.discard")}</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
