import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const envSchema = z.enum(["sandbox", "live"]);
const PRICE_ID = "bizmanager_monthly";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertServerMode(supabase: any, env: StripeEnv) {
  const { data } = await supabase.rpc("get_payments_env");
  if (data !== env) throw new Error("Payments are being set up. Please try again later.");
}

type CheckoutResult = { clientSecret: string } | { error: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv; returnUrl: string }) =>
    z.object({ environment: envSchema, returnUrl: z.string().url().max(500) }).parse(data))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      await assertServerMode(context.supabase, data.environment);
      const shop = await ownedShop(context.supabase);
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [PRICE_ID] });
      const price = prices.data[0];
      if (!price) throw new Error("Plan price not found");

      // One Stripe customer per shop, created server-side and stored on the shop.
      let customerId = shop.customerId;
      if (customerId) {
        try { const c = await stripe.customers.retrieve(customerId); if ((c as { deleted?: boolean }).deleted) customerId = null; }
        catch { customerId = null; }
      }
      if (!customerId) {
        const email = (context.claims as { email?: string }).email;
        const c = await stripe.customers.create({
          ...(email ? { email } : {}),
          name: shop.name,
          metadata: { userId: context.userId, shop_id: shop.shopId },
        });
        customerId = c.id;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("shops").update({ stripe_customer_id: customerId }).eq("id", shop.shopId);
      }

      const meta = { userId: context.userId, shop_id: shop.shopId, managed_payments: "false" };
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        customer_update: { address: "auto", name: "auto" },
        automatic_tax: { enabled: true },
        client_reference_id: shop.shopId,
        metadata: meta,
        subscription_data: { metadata: meta },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

type PortalResult = { url: string } | { error: string };

export const createBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv; returnUrl: string }) =>
    z.object({ environment: envSchema, returnUrl: z.string().url().max(500) }).parse(data))
  .handler(async ({ data, context }): Promise<PortalResult> => {
    try {
      const shop = await ownedShop(context.supabase);
      if (!shop.customerId) return { error: "No subscription found yet" };
      const portal = await createStripeClient(data.environment).billingPortal.sessions.create({ customer: shop.customerId, return_url: data.returnUrl });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
