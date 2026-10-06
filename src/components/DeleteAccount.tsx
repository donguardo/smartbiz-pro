import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { deleteMyAccount } from "@/lib/account.functions";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AccountSection() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const { data: user } = useQuery({ queryKey: ["auth-user"], queryFn: async () => (await supabase.auth.getUser()).data.user });
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{t("account.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>{t("account.delete")}</Button>
      {open && <DeleteDialog onClose={() => setOpen(false)} />}
    </section>
  );
}

function DeleteDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const run = useServerFn(deleteMyAccount);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["deletion-scope"],
    queryFn: async () => {
      const [{ data: u }, { data: scope }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("get_account_deletion_scope")]);
      const providers = (u.user?.app_metadata?.providers as string[] | undefined) ?? [];
      return { hasPassword: providers.includes("email"), scope: scope?.[0] };
    },
  });
  const soleOwner = !!data?.scope?.sole_owner;
  const isCashier = data?.scope?.member_role === "cashier";

  const reauthGoogle = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(t("account.googleFailed")); else toast.success(t("account.googleDone"));
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await run({ data: { confirm: "DELETE", password: data?.hasPassword ? password : undefined } });
      await supabase.auth.signOut();
      qc.clear();
      toast.success(t("account.deleted"));
      navigate({ to: "/" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(msg.includes("WRONG_PASSWORD") ? t("account.wrongPassword") : msg.includes("REAUTH_REQUIRED") ? t("account.reauthNeeded") : msg.includes("ACTIVE_SUBSCRIPTION") ? t("account.cancelPlanFirst") : t("account.failed"));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("account.delete")}</DialogTitle>
          <DialogDescription>{t("account.permanent")}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>{t("account.whatLogin")}</li>
          {isCashier && <li>{t("account.whatCashier")}</li>}
          {!isCashier && !soleOwner && <li>{t("account.whatCoOwner")}</li>}
        </ul>
        {soleOwner && <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm font-semibold text-destructive">{t("account.wholeShop")}</p>}
        <label className="text-sm font-medium">{t("account.typeDelete")}
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
        </label>
        {data?.hasPassword ? (
          <label className="text-sm font-medium">{t("account.password")}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
          </label>
        ) : (
          <div className="space-y-2 text-sm"><p className="text-muted-foreground">{t("account.googleHelp")}</p><Button variant="outline" onClick={reauthGoogle}>{t("account.googleAgain")}</Button></div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("account.cancel")}</Button>
          <Button variant="destructive" disabled={busy || typed !== "DELETE" || !data || (data.hasPassword && !password)} onClick={confirm}>{busy ? t("account.deleting") : t("account.deleteForever")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
