import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";
import { stripe } from "@/lib/stripe.server";

const envSchema = z.enum(["sandbox", "live"]);

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) =>
    z.object({ priceId: z.string().regex(/^[a-z0-9_]{1,64}$/), environment: envSchema }).parse(data))
  .handler(async ({ data }) => {
    const response = await gatewayFetch(data.environment, `/prices?external_id=${encodeURIComponent(data.priceId)}`);
    const result = await response.json();
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id as string;
  });

function origin() {
  const req = getRequest();
  return req.headers.get("origin") ?? new URL(req.url).origin;
}

// Returns the caller's shop only when they own it; never trusts a shop id from the browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ownedShop(supabase: any) {
  const { data, error } = await supabase.rpc("get_my_shop_context");
  const ctx = data?.[0];
  if (error || !ctx?.shop_id) throw new Error("Could not find your shop");
  if (ctx.member_role !== "owner") throw new Error("Only the shop owner can manage billing");
  const { data: shop } = await supabase.from("shops").select("id, name, stripe_customer_id").eq("id", ctx.shop_id).maybeSingle();
  return { shopId: ctx.shop_id as string, name: (shop?.name ?? ctx.shop_name) as string, customerId: (shop?.stripe_customer_id ?? null) as string | null };
}

export const createStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shop = await ownedShop(context.supabase);
    let customerId = shop.customerId;
    if (!customerId) {
      const email = (context.claims as { email?: string }).email;
      const c = await stripe("POST", "/customers", { email, name: shop.name, metadata: { shop_id: shop.shopId, user_id: context.userId } });
      customerId = c.id as string;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("shops").update({ stripe_customer_id: customerId }).eq("id", shop.shopId);
    }
    const base = origin();
    const session = await stripe("POST", "/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      client_reference_id: shop.shopId,
      line_items: [{ quantity: 1, price_data: { currency: "php", unit_amount: 49900, recurring: { interval: "month" }, product_data: { name: "MVP BizManager plan" } } }],
      subscription_data: { metadata: { shop_id: shop.shopId, user_id: context.userId } },
      metadata: { shop_id: shop.shopId, user_id: context.userId },
      success_url: `${base}/billing?checkout=success`,
      cancel_url: `${base}/billing?checkout=cancel`,
    });
    return session.url as string;
  });

// Stripe Customer Portal when this shop has a Stripe customer, otherwise the Paddle portal.
export const createBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: PaddleEnv }) => z.object({ environment: envSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const shop = await ownedShop(context.supabase);
    if (shop.customerId) {
      const s = await stripe("POST", "/billing_portal/sessions", { customer: shop.customerId, return_url: `${origin()}/billing` });
      return s.url as string;
    }
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id, environment")
      .eq("environment", data.environment)
      .eq("provider", "paddle")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Could not load your subscription");
    if (!sub) throw new Error("No subscription found yet");
    const session = await getPaddleClient(sub.environment as PaddleEnv).customerPortalSessions.create(sub.paddle_customer_id, [sub.paddle_subscription_id]);
    return session.urls.general.overview;
  });
