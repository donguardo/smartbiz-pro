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
  // The plan belongs to the paying account (one Stripe customer per account), not to a shop.
  type Acc = { id: string; owner_user_id: string; stripe_customer_id: string | null };
  const accCols = "id, owner_user_id, stripe_customer_id";
  let account: Acc | null = null;
  if (customerId) {
    ({ data: account } = await db.from("business_accounts").select(accCols).eq("stripe_customer_id", customerId).maybeSingle());
    if (!account) { // customers created before 4a were stored on the shop
      const { data: s } = await db.from("shops").select("business_account_id").eq("stripe_customer_id", customerId).maybeSingle();
      if (s?.business_account_id) ({ data: account } = await db.from("business_accounts").select(accCols).eq("id", s.business_account_id).maybeSingle());
    }
    if (!account) { // test and live customers differ: use the ids our server stamped on the customer at checkout
      const c = await createStripeClient(env).customers.retrieve(customerId);
      const meta = (c as { metadata?: Record<string, string> }).metadata ?? {};
      if (meta.account_id) ({ data: account } = await db.from("business_accounts").select(accCols).eq("id", meta.account_id).maybeSingle());
      if (!account && meta.shop_id) {
        const { data: s } = await db.from("shops").select("business_account_id").eq("id", meta.shop_id).maybeSingle();
        if (s?.business_account_id) ({ data: account } = await db.from("business_accounts").select(accCols).eq("id", s.business_account_id).maybeSingle());
      }
    }
  }
  if (!account) return { shopId: null, userId: null, status: "failed", detail: "No account linked to this customer" };
  const userId = account.owner_user_id;
  // Log against the checkout shop if it belongs to this account, else the account's oldest shop.
  let shopId: string | null = null;
  const metaShop: string | null = sub.metadata?.shop_id ?? null;
  if (metaShop) { const { data } = await db.from("shops").select("id").eq("id", metaShop).eq("business_account_id", account.id).maybeSingle(); shopId = data?.id ?? null; }
  if (!shopId) { const { data } = await db.from("shops").select("id").eq("business_account_id", account.id).order("created_at").limit(1).maybeSingle(); shopId = data?.id ?? null; }
  if (customerId && !account.stripe_customer_id) {
    await db.from("business_accounts").update({ stripe_customer_id: customerId }).eq("id", account.id).is("stripe_customer_id", null);
  }
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id || "unknown";
  // A downgrade booked for later: display only, never changes the plan in force.
  const lookupKey: string | null = item?.price?.lookup_key ?? null;
  let pendingPlan: string | null = null; let pendingAt: string | null = null;
  const scheduleId = typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
  if (scheduleId) {
    try {
      const sch = await createStripeClient(env).subscriptionSchedules.retrieve(scheduleId, { expand: ["phases.items.price"] });
      const nowSec = Math.floor(Date.now() / 1000);
      const next = (sch.phases ?? []).find((ph: { start_date: number }) => ph.start_date > nowSec);
      const nextKey = (next?.items?.[0]?.price as { lookup_key?: string } | undefined)?.lookup_key ?? null;
      if (next && nextKey && nextKey !== lookupKey) {
        const { data: pr } = await db.from("plan_limits").select("plan").eq("stripe_lookup_key", nextKey).maybeSingle();
        pendingPlan = pr?.plan ?? "basic"; pendingAt = iso(next.start_date);
      }
    } catch (e) { console.error("schedule read failed", e); }
  }
  const status = forceStatus ?? sub.status;
  const { data: saved, error } = await db.from("subscriptions").upsert({
    user_id: userId,
    shop_id: shopId,
    account_id: account.id,
    provider: "stripe",
    paddle_subscription_id: sub.id,
    paddle_customer_id: customerId,
    product_id: "bizmanager_plan",
    price_id: priceId,
    status,
    current_period_start: iso(item?.current_period_start ?? sub.current_period_start),
    current_period_end: iso(item?.current_period_end ?? sub.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    pending_plan: pendingPlan,
    pending_plan_at: pendingAt,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "paddle_subscription_id" }).select("plan").single();
  if (error) return { shopId, userId, status: "failed", detail: "Could not save subscription" };
  return { shopId, userId, status: "synced", detail: `Status ${status}${sub.cancel_at_period_end ? " (cancels at period end)" : ""} · plan ${saved?.plan ?? "?"}` };
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
            if (event.type === "customer.subscription.deleted") {
              sub = obj;
              forced = "canceled";
            } else {
              // created/updated payloads can be stale or replayed: re-read the live object
              // from Stripe and store that instead of the event body.
              sub = await createStripeClient(env).subscriptions.retrieve(obj.id);
            }
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
