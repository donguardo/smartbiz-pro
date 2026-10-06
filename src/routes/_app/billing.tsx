import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth";
import { useBilling, billingKey } from "@/lib/billing";
import { getPaddleEnvironment, openSubscriptionCheckout } from "@/lib/paddle";
import { createBillingPortal } from "@/utils/payments.functions";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({ meta: [
    { title: "Billing — MVP BizManager" },
    { name: "description", content: "Manage your MVP BizManager subscription and payment method." },
    { property: "og:title", content: "Billing — MVP BizManager" },
    { property: "og:description", content: "Manage your MVP BizManager subscription and payment method." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: BillingPage,
});

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-PH", { dateStyle: "medium" }) : "—");

export function BillingPanel() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: b, isLoading } = useBilling(!!user);
  const portal = useServerFn(createBillingPortal);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("checkout")) return;
    toast.success("Thanks! Your subscription is being activated.");
    const id = setInterval(() => void qc.invalidateQueries({ queryKey: billingKey }), 3000);
    const stop = setTimeout(() => clearInterval(id), 30000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [qc]);

  if (isLoading || !b) return <p className="text-muted-foreground">Loading…</p>;
  const subscribed = !["trial", "trial_ended"].includes(b.state) && b.state !== "expired";

  const label: Record<string, string> = {
    trial: `Free trial — ends ${fmt(b.trial_ends_at)}`,
    trial_ended: "Your free trial has ended",
    expired: "Your subscription has ended",
    active: b.cancel_at_period_end ? `Canceled — access until ${fmt(b.period_end)}` : `Active — renews ${fmt(b.period_end)}`,
    trialing: `Active — renews ${fmt(b.period_end)}`,
    past_due: "Payment failed — please update your payment method",
    canceled: `Canceled — access until ${fmt(b.period_end)}`,
    paused: "Paused",
  };

  const subscribe = async () => {
    if (!user) return;
    setBusy(true);
    try { await openSubscriptionCheckout({ userId: user.id, email: user.email ?? undefined }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not open checkout"); }
    finally { setBusy(false); }
  };
  const manage = async () => {
    setBusy(true);
    try { const url = await portal({ data: { environment: getPaddleEnvironment() } }); window.open(url, "_blank", "noopener"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not open billing portal"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">MVP BizManager plan</h2></div>
      <p className="font-display text-3xl font-bold">₱499<span className="text-base font-normal text-muted-foreground">/month</span></p>
      <p className={b.state === "past_due" || !b.has_access ? "text-destructive" : "text-muted-foreground"}>{label[b.state] ?? b.state}</p>
      {!b.is_owner ? <p className="text-sm text-muted-foreground">Only the shop owner can manage billing.</p> : (
        <div className="flex flex-wrap gap-2">
          {(!subscribed || (b.state === "canceled")) && <Button disabled={busy} onClick={subscribe}>Subscribe now</Button>}
          {subscribed && <Button variant="outline" disabled={busy} onClick={manage}><ExternalLink className="h-4 w-4" /> Manage billing & payment method</Button>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Charged in USD at checkout (about ₱499). 30-day money-back guarantee — see our <a href="/refund-policy" target="_blank" className="underline">Refund Policy</a>.</p>
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
      </div>
    </div>
  );
}
