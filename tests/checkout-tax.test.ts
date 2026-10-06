import { expect, test } from "bun:test";
import type Stripe from "stripe";
import { createTaxAwareCheckout } from "../src/lib/checkout-tax.server";

const params: Stripe.Checkout.SessionCreateParams = {
  mode: "subscription", ui_mode: "embedded_page", automatic_tax: { enabled: true },
  metadata: { shop_id: "shop-test" }, subscription_data: { metadata: { shop_id: "shop-test" } },
};
const session = { id: "cs_test" } as Stripe.Checkout.Session;

test("unsupported sandbox tax retries once and preserves shop linkage", async () => {
  const calls: Stripe.Checkout.SessionCreateParams[] = [];
  const result = await createTaxAwareCheckout(async (input) => {
    calls.push(input);
    if (calls.length === 1) throw { raw: { code: "stripe_tax_inactive" } };
    return session;
  }, params, "sandbox");
  expect(result.id).toBe("cs_test");
  expect(calls).toHaveLength(2);
  expect(calls[1].automatic_tax?.enabled).toBe(false);
  expect(calls[1].metadata?.shop_id).toBe("shop-test");
  expect(calls[1].subscription_data?.metadata?.shop_id).toBe("shop-test");
  expect(params.automatic_tax?.enabled).toBe(true);
});

test("live tax failures and unrelated sandbox errors are never bypassed", async () => {
  for (const [environment, code] of [["live", "stripe_tax_inactive"], ["sandbox", "card_declined"]] as const) {
    let calls = 0;
    try {
      await createTaxAwareCheckout(async () => { calls++; throw { code }; }, params, environment);
      throw new Error("Expected checkout rejection");
    } catch (error) {
      expect((error as { code: string }).code).toBe(code);
    }
    expect(calls).toBe(1);
  }
});

test("working tax checkout does not retry", async () => {
  let calls = 0;
  await createTaxAwareCheckout(async () => { calls++; return session; }, params, "sandbox");
  expect(calls).toBe(1);
});