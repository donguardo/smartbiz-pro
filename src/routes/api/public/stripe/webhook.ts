import { createFileRoute } from "@tanstack/react-router";
import { stripe, stripeEnv, verifyStripeWebhook } from "@/lib/stripe.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncSubscription(sub: any, env: "sandbox" | "live") {
  const db = await admin();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  let shopId: string | null = sub.metadata?.shop_id ?? null;
  // Fall back to the shop that owns this Stripe customer (set server-side at checkout).
  if (customerId) {
    const { data } = await db.from("shops").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    if (data?.id) shopId = data.id;
  }
  let userId: string | null = sub.metadata?.user_id ?? null;
  if (shopId && !userId) {
    const { data } = await db.from("shop_members").select("user_id").eq("shop_id", shopId).eq("role", "owner").limit(1).maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!shopId || !userId) return { shopId, userId, status: "failed" as const, detail: "No shop linked to this Stripe customer" };
  const item = sub.items?.data?.[0];
  const { error } = await db.from("subscriptions").upsert({
    user_id: userId,
    shop_id: shopId,
    provider: "stripe",
    paddle_subscription_id: sub.id,
    paddle_customer_id: customerId,
    product_id: "bizmanager_plan",
    price_id: "bizmanager_monthly_php",
    status: sub.status,
    current_period_start: iso(sub.current_period_start ?? item?.current_period_start),
    current_period_end: iso(sub.current_period_end ?? item?.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "paddle_subscription_id" });
  if (error) return { shopId, userId, status: "failed" as const, detail: "Could not save subscription" };
  return { shopId, userId, status: "synced" as const, detail: `Stripe status ${sub.status}${sub.cancel_at_period_end ? " (cancels at period end)" : ""}` };
}

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.text();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let event: any;
        try { event = await verifyStripeWebhook(payload, request.headers.get("stripe-signature")); }
        catch (e) { console.error("Stripe webhook verify error:", e); return new Response("Bad signature", { status: 400 }); }
        const env = event.livemode ? "live" : "sandbox";
        if (env !== stripeEnv()) return new Response("Wrong mode", { status: 400 });
        try {
          let sub = null;
          if (event.type === "checkout.session.completed" && event.data.object.subscription) sub = await stripe("GET", `/subscriptions/${event.data.object.subscription}`);
          else if (event.type.startsWith("customer.subscription.")) sub = event.data.object;
          if (!sub) return Response.json({ received: true });
          const o = await syncSubscription(sub, env);
          const db = await admin();
          await db.from("billing_events").insert({ shop_id: o.shopId, user_id: o.userId, paddle_event_id: event.id, event_type: `stripe ${event.type}`, paddle_subscription_id: sub.id, environment: env, sync_status: o.status, detail: o.detail });
          if (o.status === "failed" && o.detail.startsWith("Could not")) return new Response("Sync failed", { status: 500 });
          return Response.json({ received: true });
        } catch (e) {
          console.error("Stripe webhook error:", e);
          return new Response("Webhook error", { status: 500 });
        }
      },
    },
  },
});
