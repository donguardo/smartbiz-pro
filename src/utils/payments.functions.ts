import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const envSchema = z.enum(["sandbox", "live"]);

// The caller's own paying account (RLS returns only theirs); must be the account this shop belongs to.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function myAccount(supabase: any, shopId: string) {
  const { data: acc } = await supabase.from("business_accounts").select("id, stripe_customer_id").maybeSingle();
  const { data: s } = await supabase.from("shops").select("business_account_id").eq("id", shopId).maybeSingle();
  if (!acc?.id || !s?.business_account_id || acc.id !== s.business_account_id) throw new Error("Only the account owner can manage billing");
  return { id: acc.id as string, stripe_customer_id: (acc.stripe_customer_id ?? null) as string | null };
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function serverMode(supabase: any, requested: StripeEnv): Promise<StripeEnv> {
  const { data, error } = await supabase.rpc("get_payments_env");
  if (error || (data !== "sandbox" && data !== "live") || data !== requested) {
    throw new Error("Payments are being set up. Please try again later.");
  }
  return data as StripeEnv;
}

// The return address is handed to the payer by Stripe, so only our own hosts are accepted.
// Exact host matches only — no suffix or wildcard matching, or any Lovable app would pass.
const RETURN_HOSTS = new Set([
  "mvp.com.ai",
  "www.mvp.com.ai",
  "smartbiz-pro.lovable.app",
  "id-preview--7743ade6-55a2-4176-8349-318ea4c04396.lovable.app",
  "7743ade6-55a2-4176-8349-318ea4c04396.lovableproject.com",
]);

function isAllowedReturnUrl(returnUrl: string): boolean {
  try {
    const u = new URL(returnUrl);
    return u.protocol === "https:" && u.pathname.startsWith("/billing") && RETURN_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

type CheckoutResult = { clientSecret: string } | { error: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv; returnUrl: string; plan?: "basic" | "standard" | "pro" }) =>
    z.object({ environment: envSchema, returnUrl: z.string().url().max(500), plan: z.enum(["basic", "standard", "pro"]).default("basic") }).parse(data))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      if (!isAllowedReturnUrl(data.returnUrl)) return { error: "Invalid return address" };
      const env = await serverMode(context.supabase, data.environment);
      const shop = await ownedShop(context.supabase);
      const account = await myAccount(context.supabase, shop.shopId);
      // Already-paying shops must use Manage billing instead of starting a second checkout.
      const { data: bill } = await context.supabase.rpc("get_shop_billing", { _env: "server" });
      const billState = bill?.[0]?.state;
      if (billState === "active" || billState === "trialing" || billState === "past_due") {
        return { error: "This shop already has an active plan. Use Manage billing to change it." };
      }
      // The price comes only from the server-side plans table, never from the browser.
      const { data: pl } = await context.supabase.from("plan_limits").select("stripe_lookup_key").eq("plan", data.plan).maybeSingle();
      if (!pl?.stripe_lookup_key) throw new Error("Plan price not found");
      const stripe = createStripeClient(env);
      const prices = await stripe.prices.list({ lookup_keys: [pl.stripe_lookup_key] });
      const price = prices.data[0];
      if (!price) throw new Error("Plan price not found");

      // One Stripe customer per account, created server-side and stored on the account.
      let customerId = account.stripe_customer_id ?? shop.customerId;
      if (customerId) {
        try { const c = await stripe.customers.retrieve(customerId); if ((c as { deleted?: boolean }).deleted) customerId = null; }
        catch { customerId = null; }
      }
      if (!customerId) {
        const email = (context.claims as { email?: string }).email;
        // Idempotent so two first checkouts at the same moment make one customer. Key = account id + hour
        // (never the shop name), so a customer deleted in Stripe can be created again a hour later.
        const params = { ...(email ? { email } : {}), metadata: { userId: context.userId, account_id: account.id } };
        let c: { id: string };
        try {
          c = await stripe.customers.create(params, { idempotencyKey: `bizmanager-customer-${env}-${account.id}-${new Date().toISOString().slice(0, 13)}` });
        } catch (e) {
          const err = e as { type?: string; rawType?: string };
          if (err.type !== "StripeIdempotencyError" && err.rawType !== "idempotency_error") throw e;
          // Same key, different details (for example the e-mail changed this hour): use the customer that is already saved, else create one without a key.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: saved } = await supabaseAdmin.from("business_accounts").select("stripe_customer_id").eq("id", account.id).maybeSingle();
          c = saved?.stripe_customer_id ? { id: saved.stripe_customer_id } : await stripe.customers.create(params);
        }
        customerId = c.id;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("business_accounts").update({ stripe_customer_id: customerId }).eq("id", account.id);
      }

      // A4: no second subscription for one account, even if two checkouts start at the same moment.
      const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
      if (existing.data.some((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status))) {
        return { error: "This account already has a plan. Use Manage billing to change it." };
      }
      // Only the newest checkout can be paid: close this customer's other unfinished checkouts.
      const open = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 20 });
      for (const old of open.data) {
        try { await stripe.checkout.sessions.expire(old.id); } catch { /* already finished or expired */ }
      }

      const meta = { userId: context.userId, account_id: account.id, shop_id: shop.shopId, managed_payments: "false" };
      const { createTaxAwareCheckout } = await import("@/lib/checkout-tax.server");
      const session = await createTaxAwareCheckout((params) => stripe.checkout.sessions.create(params), {
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
      }, env);
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
      if (!isAllowedReturnUrl(data.returnUrl)) return { error: "Invalid return address" };
      const env = await serverMode(context.supabase, data.environment);
      const shop = await ownedShop(context.supabase);
      const account = await myAccount(context.supabase, shop.shopId);
      let customer: string | null = account.stripe_customer_id;
      if (!customer) {
        const { data: sub } = await context.supabase.from("subscriptions").select("paddle_customer_id")
          .eq("account_id", account.id).eq("environment", env).eq("provider", "stripe")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        customer = sub?.paddle_customer_id ?? shop.customerId;
      }
      if (!customer) return { error: "No subscription found yet" };
      const portal = await createStripeClient(env).billingPortal.sessions.create({ customer, return_url: data.returnUrl });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
