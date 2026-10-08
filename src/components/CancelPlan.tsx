import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { billingKey } from "@/lib/billing";
import { ownerCancelAnyway } from "@/utils/cancellation.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const key = ["cancel-request"] as const;

export function CancelPlan({ canRequest }: { canRequest: boolean }) {
  const { t } = useT();
  const qc = useQueryClient();
  const anyway = useServerFn(ownerCancelAnyway);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: req } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_cancellation_request");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: billingKey }); };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : t("cancel.failed")); } finally { setBusy(false); }
  };

  if (req?.status === "pending") return (
    <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
      <p className="font-semibold">{t("cancel.pendingTitle")}</p>
      <p className="text-muted-foreground">{t("cancel.pendingBody")}</p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { const { error } = await supabase.rpc("withdraw_cancellation"); if (error) throw error; toast.success(t("cancel.kept")); })}>{t("cancel.withdraw")}</Button>
    </div>
  );

  if (req?.status === "contacted") return (
    <div className="space-y-2 rounded-xl border border-primary p-4 text-sm">
      <p className="font-semibold">{t("cancel.contactedTitle")}</p>
      {req.admin_note && <p className="whitespace-pre-wrap rounded-lg bg-muted p-3">{req.admin_note}</p>}
      <p className="text-muted-foreground">{t("cancel.contactedBody")}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => run(async () => { const { error } = await supabase.rpc("withdraw_cancellation"); if (error) throw error; toast.success(t("cancel.kept")); })}>{t("cancel.keep")}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { const r = await anyway(); if ("error" in r) throw new Error(r.error); toast.success(t("cancel.done")); })}>{t("cancel.anyway")}</Button>
      </div>
    </div>
  );

  if (!canRequest) return null;
  if (!open) return <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setOpen(true)}>{t("cancel.request")}</Button>;
  return (
    <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
      <p className="font-semibold">{t("cancel.request")}</p>
      <p className="text-muted-foreground">{t("cancel.explain")}</p>
      <Textarea maxLength={1000} placeholder={t("cancel.reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => run(async () => {
          const { error } = await supabase.rpc("request_cancellation", { _reason: reason });
          if (error) throw new Error(error.message.includes("already") ? t("cancel.alreadyOpen") : t("cancel.failed"));
          setOpen(false); setReason(""); toast.success(t("cancel.sent"));
        })}>{t("cancel.send")}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("billing.close")}</Button>
      </div>
    </div>
  );
}
