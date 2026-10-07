import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { fetchMyPlan, fetchPlanLimits, qk } from "@/lib/store";

/** True when a Supabase/Postgres error was raised by a plan limit (HINT = 'upgrade'). */
export function isUpgradeError(e: unknown): boolean {
  return !!e && typeof e === "object" && (e as { hint?: unknown }).hint === "upgrade";
}

/** Shared Upgrade sheet: shows the database message as-is, the next plan up and a link to /billing. */
export function UpgradeSheet({ message, onClose }: { message: string | null; onClose: () => void }) {
  const { t } = useT();
  const open = message !== null;
  const { data: plan } = useQuery({ queryKey: qk.plan, queryFn: fetchMyPlan, enabled: open });
  const { data: limits = [] } = useQuery({ queryKey: ["plan-limits"], queryFn: fetchPlanLimits, enabled: open, staleTime: 10 * 60000 });
  if (!open) return null;
  const current = limits.find((l) => l.plan === plan?.plan);
  const next = limits.find((l) => l.monthly_price_php > (current?.monthly_price_php ?? 0));
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="upgrade-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-t-3xl bg-card p-6 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h3 id="upgrade-title" className="flex items-center gap-2 text-xl font-bold"><Sparkles className="h-5 w-5 text-primary" />{t("upgrade.title")}</h3>
          <button aria-label={t("upgrade.close")} onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {message && <p className="text-sm">{message}</p>}
        {next && <p className="rounded-xl border border-border p-3 text-sm font-medium">{t("upgrade.next", { label: next.label, price: next.monthly_price_php.toLocaleString("en-PH") })}</p>}
        <div className="flex gap-2">
          <Link to="/billing" onClick={onClose} className="flex-1 rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground">{t("upgrade.go")}</Link>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-3 text-sm">{t("upgrade.close")}</button>
        </div>
      </div>
    </div>
  );
}

/** Placeholder for a brand promotion. Holds no ad content yet; render only where brand_ads is true. */
export function BrandAdSlot() {
  const { t } = useT();
  const { data: plan } = useQuery({ queryKey: qk.plan, queryFn: fetchMyPlan, staleTime: 5 * 60000 });
  if (!plan?.brand_ads) return null;
  return <div aria-label={t("ads.slot")} className="flex min-h-16 items-center justify-center rounded-2xl border border-dashed border-border text-xs text-muted-foreground">{t("ads.slot")}</div>;
}
