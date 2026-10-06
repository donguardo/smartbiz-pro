import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Outcome = { shopId: string | null; userId: string | null; status: "synced" | "failed" | "skipped"; detail: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onCreated(data: any, env: PaddleEnv): Promise<Outcome> {
  const userId = data.customData?.userId;
  if (!userId || typeof userId !== "string") return { shopId: null, userId: null, status: "skipped", detail: "No user linked at checkout" };
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  const db = await admin();
  // The plan covers the shop this user owns; never trust a shop id from the browser.
  const { data: owner } = await db.from("shop_members").select("shop_id").eq("user_id", userId).eq("role", "owner").order("created_at").limit(1).maybeSingle();
  const shopId = owner?.shop_id ?? null;
  if (!priceId || !productId) return { shopId, userId, status: "skipped", detail: "Unknown plan (missing external id)" };
  const { error } = await db.from("subscriptions").upsert({
    user_id: userId,
    shop_id: shopId,
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
  if (error) return { shopId, userId, status: "failed", detail: "Could not save subscription" };
  return { shopId, userId, status: shopId ? "synced" : "failed", detail: shopId ? `Status ${data.status}` : "Saved, but no owner shop found" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onUpdated(data: any, env: PaddleEnv): Promise<Outcome> {
  const db = await admin();
  const patch: { status: string; cancel_at_period_end: boolean; updated_at: string; current_period_start?: string; current_period_end?: string } = {
    status: data.status,
    cancel_at_period_end: data.scheduledChange?.action === "cancel",
    updated_at: new Date().toISOString(),
  };
  // Canceled events have no billing period; keep the paid-through date so access lasts to month end.
  if (data.currentBillingPeriod) {
    patch.current_period_start = data.currentBillingPeriod.startsAt;
    patch.current_period_end = data.currentBillingPeriod.endsAt;
  }
  const { data: rows, error } = await db.from("subscriptions").update(patch).eq("paddle_subscription_id", data.id).eq("environment", env).select("shop_id, user_id");
  const row = rows?.[0];
  if (error) return { shopId: row?.shop_id ?? null, userId: row?.user_id ?? null, status: "failed", detail: "Could not update subscription" };
  if (!row) return { shopId: null, userId: null, status: "failed", detail: "Subscription not found for this payment mode" };
  return { shopId: row.shop_id, userId: row.user_id, status: "synced", detail: `Status ${data.status}${patch.cancel_at_period_end ? " (cancels at period end)" : ""}` };
}

async function logEvent(env: PaddleEnv, eventId: string | null, type: string, subId: string | null, o: Outcome) {
  try {
    const db = await admin();
    await db.from("billing_events").insert({ shop_id: o.shopId, user_id: o.userId, paddle_event_id: eventId, event_type: type, paddle_subscription_id: subId, environment: env, sync_status: o.status, detail: o.detail });
  } catch (e) { console.error("billing_events log failed", e); }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // SECURITY: envParam is untrusted until verifyWebhook passes with that env's own secret.
        const envParam = new URL(request.url).searchParams.get("env");
        if (envParam !== "sandbox" && envParam !== "live") return new Response("Bad env", { status: 400 });
        let event;
        try { event = await verifyWebhook(request, envParam); }
        catch (e) { console.error("Webhook verify error:", e); return new Response("Webhook error", { status: 400 }); }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = event.data as any;
        try {
          let o: Outcome | null = null;
          switch (event.eventType) {
            case EventName.SubscriptionCreated: o = await onCreated(data, envParam); break;
            case EventName.SubscriptionUpdated:
            case EventName.SubscriptionCanceled: o = await onUpdated(data, envParam); break;
            default: console.log("Unhandled event:", event.eventType);
          }
          if (o) await logEvent(envParam, event.eventId, event.eventType, data?.id ?? null, o);
          if (o?.status === "failed" && o.detail.startsWith("Could not")) return new Response("Sync failed", { status: 500 });
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          await logEvent(envParam, event.eventId, event.eventType, data?.id ?? null, { shopId: null, userId: null, status: "failed", detail: "Unexpected error" });
          return new Response("Webhook error", { status: 500 });
        }
      },
    },
  },
});
