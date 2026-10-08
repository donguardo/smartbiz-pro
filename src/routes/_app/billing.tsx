import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PLAN_FEATURES as FEATURES, PLAN_ALL_FEATURES as ALL_FEATURES, type PlanId } from "@/lib/plans";
import { fetchMyPlan, fetchMyUsage, fetchPlanLimits, qk } from "@/lib/store";
import { useServerFn } from "@tanstack/react-start";
import { Check, CreditCard, Download, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useSession } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useBilling, billingKey } from "@/lib/billing";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createBillingPortal, createCheckoutSession } from "@/utils/payments.functions";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { OwnerRedirect } from "@/components/OwnerRedirect";
import { downloadShopData } from "@/lib/export-data";
import { BillingLinkCheck, BillingEventLog } from "@/components/BillingDiagnostics";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({ meta: [
    { title: "Billing — MVP BizManager" },
    { name: "description", content: "Manage your MVP BizManager subscription and payment method." },
    { property: "og:title", content: "Billing — MVP BizManager" },
    { property: "og:description", content: "Manage your MVP BizManager subscription and payment method." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <OwnerRedirect><BillingPage /></OwnerRedirect>,
});

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-PH", { dateStyle: "medium" }) : "—");

const php = (n: number) => n.toLocaleString("en-PH");

function CheckoutForm({ plan }: { plan: PlanId }) {
  const checkout = useServerFn(createCheckoutSession);
  const fetchClientSecret = useCallback(async () => {
    const r = await checkout({ data: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/billing?checkout=success`, plan } });
    if ("error" in r) { toast.error(r.error); throw new Error(r.error); }
    if (!r.clientSecret) throw new Error("Checkout could not start");
    return r.clientSecret;
  }, [checkout, plan]);
  return (
    <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}

export function BillingPanel() {
  const { user } = useSession();
  const { t } = useT();
  const qc = useQueryClient();
  const { data: b, isLoading } = useBilling(!!user);
  const portal = useServerFn(createBillingPortal);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState<PlanId | null>(null);
  const { data: myPlan } = useQuery({ queryKey: qk.plan, queryFn: fetchMyPlan, enabled: !!user });
  const { data: usage } = useQuery({ queryKey: qk.usage, queryFn: fetchMyUsage, enabled: !!user });
  const { data: limits = [] } = useQuery({ queryKey: ["plan-limits"], queryFn: fetchPlanLimits, enabled: !!user, staleTime: 10 * 60000 });
  const refreshPlan = useCallback(() => { void qc.invalidateQueries({ queryKey: qk.plan }); void qc.invalidateQueries({ queryKey: qk.usage }); }, [qc]);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("checkout")) return;
    toast.success(t("billing.thanks"));
    const id = setInterval(() => { void qc.invalidateQueries({ queryKey: billingKey }); refreshPlan(); }, 3000);
    const stop = setTimeout(() => clearInterval(id), 30000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [qc, t, refreshPlan]);

  if (isLoading || !b) return <p className="text-muted-foreground">{t("billing.loading")}</p>;
  const subscribed = !["trial", "trial_ended", "expired"].includes(b.state);

  const label: Record<string, string> = {
    trial: t("billing.state.trial", { date: fmt(b.trial_ends_at) }),
    trial_ended: t("billing.state.trial_ended"),
    expired: t("billing.state.expired"),
    active: b.cancel_at_period_end ? t("billing.state.canceled", { date: fmt(b.period_end) }) : t("billing.state.active", { date: fmt(b.period_end) }),
    trialing: t("billing.state.active", { date: fmt(b.period_end) }),
    past_due: t("billing.state.past_due"),
    past_due_locked: t("billing.state.past_due_locked"),
    canceled: t("billing.state.canceled", { date: fmt(b.period_end) }),
    paused: t("billing.state.paused"),
  };

  const paid = subscribed && b.state !== "canceled";
  const accountOwner = !!myPlan?.is_account_owner;
  const startPay = (plan: PlanId) => {
    try { getStripeEnvironment(); setPaying(plan); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not open checkout"); }
  };
  const manage = async () => {
    setBusy(true);
    try {
      const r = await portal({ data: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/billing` } });
      if ("error" in r) throw new Error(r.error);
      window.open(r.url, "_blank", "noopener");
      // Refresh plan and usage when the owner comes back from the billing portal tab.
      window.addEventListener("focus", refreshPlan, { once: true });
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not open billing portal"); }
    finally { setBusy(false); }
  };
  const downloadData = async () => {
    setBusy(true);
    try { await downloadShopData(); toast.success(t("billing.downloadStarted")); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not export your data"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">{t("billing.plan")}</h2></div>
      {myPlan && <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-3xl font-bold">₱{php(myPlan.monthly_price_php)}<span className="text-base font-normal text-muted-foreground">{t("billing.perMonth")}</span></p>
        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">{myPlan.label}{myPlan.on_trial ? ` · ${t("plan.trialBadge")}` : ""}</span>
      </div>}
      <p className={b.state.startsWith("past_due") || !b.has_access ? "text-destructive" : "text-muted-foreground"}>{label[b.state] ?? b.state}</p>
      {myPlan && <div className="space-y-1 text-sm">
        <p>{t("plan.shops", { n: String(myPlan.shops_in_account), max: String(myPlan.max_stores ?? 5) })}</p>
        <p className="text-xs text-muted-foreground">{t("plan.moreShopsSoon")}</p>
        {myPlan.pending_plan && <p className="font-medium">{t("plan.pending", { plan: limits.find((l) => l.plan === myPlan.pending_plan)?.label ?? myPlan.pending_plan, date: fmt(myPlan.pending_plan_at) })}</p>}
      </div>}
      {usage && <p className="text-sm">{usage.max_skus == null ? t("plan.usageUnlimited", { n: String(usage.active_products) }) : t("plan.usage", { n: String(usage.active_products), max: String(usage.max_skus) })}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {limits.map((l) => (
          <div key={l.plan} className={`flex flex-col gap-3 rounded-xl border p-4 ${l.plan === myPlan?.plan ? "border-primary" : "border-border"}`}>
            <div>
              <p className="font-bold">{l.label}{l.plan === myPlan?.plan && <span className="ml-2 text-xs font-medium text-primary">{t("plan.current")}</span>}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t(`plan.${l.plan}.tagline`)}</p>
              <p className="font-display text-2xl font-bold">₱{php(l.monthly_price_php)}<span className="text-xs font-normal text-muted-foreground">{t("plan.perMonth")}</span></p>
            </div>
            <ul className="flex-1 space-y-1 text-xs">
              {[...(FEATURES[l.plan as PlanId] ?? []), ...ALL_FEATURES].map((k) => <li key={k} className="flex gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />{t(k)}</li>)}
            </ul>
            {accountOwner && (paid
              ? <Button size="sm" variant="outline" disabled={busy} onClick={manage}>{t("plan.change")}</Button>
              : <Button size="sm" disabled={busy || !!paying} onClick={() => startPay(l.plan as PlanId)}>{t("plan.choose")}</Button>)}
          </div>
        ))}
      </div>
      {accountOwner && <p className="text-xs text-muted-foreground">{t("plan.changeNote")}</p>}
      {!b.is_owner || !accountOwner ? <p className="text-sm text-muted-foreground">{t("billing.ownerOnly")}</p> : (
        <div className="flex flex-wrap gap-2">
          {subscribed && <Button variant="outline" disabled={busy} onClick={manage}><ExternalLink className="h-4 w-4" /> {t("billing.manage")}</Button>}
          {!b.has_access && <Button variant="outline" disabled={busy} onClick={downloadData}><Download className="h-4 w-4" /> {t("billing.download")}</Button>}
        </div>
      )}
      {paying && (
        <div className="space-y-2">
          <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={() => setPaying(null)}><X className="h-4 w-4" /> {t("billing.close")}</Button></div>
          <div className="overflow-hidden rounded-xl bg-background"><CheckoutForm plan={paying} /></div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("billing.fine")} <a href="/refund-policy" target="_blank" className="underline">{t("billing.refund")}</a>.</p>
    </div>
  );
}

function BillingPage() {
  return (
    <div>
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <BillingPanel />
        <BillingLinkCheck />
        <BillingEventLog />
      </div>
    </div>
  );
}
