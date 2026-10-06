import type Stripe from "stripe";

// Never silently disable tax on live payments or retry unrelated failures.
export async function createTaxAwareCheckout(
  create: (params: Stripe.Checkout.SessionCreateParams) => Promise<Stripe.Checkout.Session>,
  params: Stripe.Checkout.SessionCreateParams,
  environment: "sandbox" | "live",
) {
  try {
    return await create(params);
  } catch (error) {
    const failure = error as { code?: string; raw?: { code?: string } } | null;
    if (environment !== "sandbox" || (failure?.raw?.code ?? failure?.code) !== "stripe_tax_inactive") throw error;
    return create({
      ...params,
      automatic_tax: { enabled: false },
      metadata: { ...params.metadata, tax_mode: "sandbox_without_tax" },
      subscription_data: {
        ...params.subscription_data,
        metadata: { ...params.subscription_data?.metadata, tax_mode: "sandbox_without_tax" },
      },
    });
  }
}