import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onCreated(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  if (!userId || typeof userId !== "string") { console.error("No userId in customData"); return; }
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  if (!priceId || !productId) { console.warn("Skipping subscription: missing importMeta.externalId"); return; }
  const db = await admin();
  // The plan covers the shop this user owns; never trust a shop id from the browser.
  const { data: owner } = await db.from("shop_members").select("shop_id").eq("user_id", userId).eq("role", "owner").order("created_at").limit(1).maybeSingle();
  const { error } = await db.from("subscriptions").upsert({
    user_id: userId,
    shop_id: owner?.shop_id ?? null,
    paddle_subscription_id: data.id,
    paddle_customer_id: data.customerId,
    product_id: productId,
    price_id: priceId,
    status: data.status,
    current_period_start: data.currentBillingPeriod?.startsAt ?? null,
    current_period_end: data.currentBillingPeriod?.endsAt ?? null,
    cancel_at_period_end: data.scheduledChange?.action === "cancel",
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "paddle_subscription_id" });
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onUpdated(data: any, env: PaddleEnv) {
  const db = await admin();
  const patch: Record<string, unknown> = {
    status: data.status,
    cancel_at_period_end: data.scheduledChange?.action === "cancel",
    updated_at: new Date().toISOString(),
  };
  // Canceled events have no billing period; keep the paid-through date so access lasts to month end.
  if (data.currentBillingPeriod) {
    patch.current_period_start = data.currentBillingPeriod.startsAt;
    patch.current_period_end = data.currentBillingPeriod.endsAt;
  }
  const { error } = await db.from("subscriptions").update(patch).eq("paddle_subscription_id", data.id).eq("environment", env);
  if (error) throw error;
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const envParam = new URL(request.url).searchParams.get("env");
        if (envParam !== "sandbox" && envParam !== "live") return new Response("Bad env", { status: 400 });
        try {
          const event = await verifyWebhook(request, envParam);
          switch (event.eventType) {
            case EventName.SubscriptionCreated: await onCreated(event.data, envParam); break;
            case EventName.SubscriptionUpdated:
            case EventName.SubscriptionCanceled: await onUpdated(event.data, envParam); break;
            default: console.log("Unhandled event:", event.eventType);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
