import { createFileRoute } from "@tanstack/react-router";
import { createStripeClient, verifyWebhook, type StripeEnv } from "@/lib/stripe.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Outcome = { shopId: string | null; userId: string | null; status: "synced" | "failed" | "skipped"; detail: string };
const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncSubscription(sub: any, env: StripeEnv, forceStatus?: string): Promise<Outcome> {
  const db = await admin();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  // The shop is resolved from the Stripe customer stored on it server-side at checkout.
  let shopId: string | null = null;
  if (customerId) {
    const { data } = await db.from("shops").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    shopId = data?.id ?? null;
  }
  if (!shopId) return { shopId: null, userId: null, status: "failed", detail: "No shop linked to this customer" };
  let userId: string | null = sub.metadata?.userId ?? null;
  if (userId) {
    const { data } = await db.from("shop_members").select("user_id").eq("shop_id", shopId).eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (!data) userId = null;
  }
  if (!userId) {
    const { data } = await db.from("shop_members").select("user_id").eq("shop_id", shopId).eq("role", "owner").order("created_at").limit(1).maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) return { shopId, userId: null, status: "failed", detail: "Shop has no owner" };
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id || "unknown";
  const status = forceStatus ?? sub.status;
  const { error } = await db.from("subscriptions").upsert({
    user_id: userId,
    shop_id: shopId,
    provider: "stripe",
    paddle_subscription_id: sub.id,
    paddle_customer_id: customerId,
    product_id: "bizmanager_plan",
    price_id: priceId,
    status,
    current_period_start: iso(item?.current_period_start ?? sub.current_period_start),
    current_period_end: iso(item?.current_period_end ?? sub.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "paddle_subscription_id" });
  if (error) return { shopId, userId, status: "failed", detail: "Could not save subscription" };
  return { shopId, userId, status: "synced", detail: `Status ${status}${sub.cancel_at_period_end ? " (cancels at period end)" : ""}` };
}

async function log(env: StripeEnv, eventId: string, type: string, subId: string | null, o: Outcome) {
  try {
    const db = await admin();
    await db.from("billing_events").insert({ shop_id: o.shopId, user_id: o.userId, paddle_event_id: eventId, event_type: type, paddle_subscription_id: subId, environment: env, sync_status: o.status, detail: o.detail });
  } catch (e) { console.error("billing_events log failed", e); }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // SECURITY: env is untrusted until verifyWebhook passes with that env's own secret.
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") return new Response("Bad env", { status: 400 });
        const env: StripeEnv = rawEnv;
        let event;
        try { event = await verifyWebhook(request, env); }
        catch (e) { console.error("Webhook verify error:", e); return new Response("Webhook error", { status: 400 }); }
        const obj = event.data.object;
        try {
          let sub = null;
          let forced: string | undefined;
          if (event.type.startsWith("customer.subscription.")) {
            sub = obj;
            if (event.type === "customer.subscription.deleted") forced = "canceled";
          } else if (event.type === "checkout.session.completed" && obj.subscription && obj.payment_status !== "unpaid") {
            sub = await createStripeClient(env).subscriptions.retrieve(typeof obj.subscription === "string" ? obj.subscription : obj.subscription.id);
          }
          if (!sub) return Response.json({ received: true });
          const o = await syncSubscription(sub, env, forced);
          await log(env, event.id, event.type.replace("customer.", ""), sub.id, o);
          if (o.status === "failed" && o.detail.startsWith("Could not")) return new Response("Sync failed", { status: 500 });
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          await log(env, event.id, event.type, null, { shopId: null, userId: null, status: "failed", detail: "Unexpected error" });
          return new Response("Webhook error", { status: 500 });
        }
      },
    },
  },
});
