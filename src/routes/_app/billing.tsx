import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Download, ExternalLink, X } from "lucide-react";
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

function CheckoutForm() {
  const checkout = useServerFn(createCheckoutSession);
  const fetchClientSecret = useCallback(async () => {
    const r = await checkout({ data: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/billing?checkout=success` } });
    if ("error" in r) { toast.error(r.error); throw new Error(r.error); }
    if (!r.clientSecret) throw new Error("Checkout could not start");
    return r.clientSecret;
  }, [checkout]);
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
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("checkout")) return;
    toast.success(t("billing.thanks"));
    const id = setInterval(() => void qc.invalidateQueries({ queryKey: billingKey }), 3000);
    const stop = setTimeout(() => clearInterval(id), 30000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [qc, t]);

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

  const startPay = () => {
    try { getStripeEnvironment(); setPaying(true); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not open checkout"); }
  };
  const manage = async () => {
    setBusy(true);
    try {
      const r = await portal({ data: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/billing` } });
      if ("error" in r) throw new Error(r.error);
      window.open(r.url, "_blank", "noopener");
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
      <p className="font-display text-3xl font-bold">₱499<span className="text-base font-normal text-muted-foreground">{t("billing.perMonth")}</span></p>
      <p className={b.state.startsWith("past_due") || !b.has_access ? "text-destructive" : "text-muted-foreground"}>{label[b.state] ?? b.state}</p>
      {!b.is_owner ? <p className="text-sm text-muted-foreground">{t("billing.ownerOnly")}</p> : (
        <div className="flex flex-wrap gap-2">
          {(!subscribed || b.state === "canceled") && !paying && <Button disabled={busy} onClick={startPay}>{t("billing.subscribe")}</Button>}
          {subscribed && <Button variant="outline" disabled={busy} onClick={manage}><ExternalLink className="h-4 w-4" /> {t("billing.manage")}</Button>}
          {!b.has_access && <Button variant="outline" disabled={busy} onClick={downloadData}><Download className="h-4 w-4" /> {t("billing.download")}</Button>}
        </div>
      )}
      {paying && (
        <div className="space-y-2">
          <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={() => setPaying(false)}><X className="h-4 w-4" /> {t("billing.close")}</Button></div>
          <div className="overflow-hidden rounded-xl bg-background"><CheckoutForm /></div>
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
      <div className="mx-auto max-w-xl space-y-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <BillingPanel />
        <BillingLinkCheck />
        <BillingEventLog />
      </div>
    </div>
  );
}
