# MVP BizManager — Payments & Owner Payout Guide

MVP BizManager is an AI-assisted business manager and POS for small and medium businesses. This README explains what the app charges, who receives the money, how subscriptions control access, and how to test and launch payments.

**Documentation date:** October 6, 2026. This describes the current implementation, not a guarantee that every Stripe account setting or payout capability has been activated.

## 1. The two payment flows — important distinction

| Flow | Who pays? | Who receives the money? | What the app does |
| --- | --- | --- | --- |
| MVP BizManager subscription | A shop owner subscribing to the software | The business operating MVP BizManager, through its connected live Stripe account | Opens secure subscription checkout and synchronizes subscription access |
| A shop's customer purchase | A customer buying goods or services from a shop | That shop, through cash, its own GCash account, or its own card terminal/payment arrangement | Records the sale, payment method, receipt, and relevant stock changes |

**Shop owners pay for MVP BizManager; they do not receive a share of MVP BizManager subscription revenue.** The platform owner receives subscription revenue. Shop owners receive their own retail/service payments directly.

The Register is currently a **payment-recording POS**, not an online payment gateway for each shop. Choosing GCash or Card does not charge a customer, verify a transfer, or deposit money. Staff must first verify payment through the shop's actual cash collection, wallet, or terminal.

There is no connected-account marketplace, split-payment system, commission distribution, shop bank onboarding, or automatic shop payout service in this app.

## 2. Subscription product and pricing

| Item | Current configuration |
| --- | --- |
| Product | MVP BizManager plan |
| Product reference | `bizmanager_plan` |
| Price reference | `bizmanager_monthly` |
| Base subscription | ₱499/month |
| Checkout quantity | 1 |
| Free app trial | 14 days from shop creation |
| Plans | One monthly plan; no yearly, upgrade, or downgrade flow |
| Subscriber | Shop owner; the shop's cashiers share its entitlement |
| Product classification | SaaS / electronic services; configured tax code `txcd_10103001` |

The price is shown as ₱499/month. Checkout is quantity 1; the shop's cashiers are not charged separately.

The current checkout requests automatic tax calculation. Applicable tax can increase the total above ₱499. Do not treat ₱499 as a verified tax-inclusive final price for every buyer.

### Trial timing

The free app trial is stored on the shop; it is not a Stripe trial scheduled on the subscription. Checkout does **not** pass `trial_end` or `trial_period_days`.

**Subscribing during the 14-day app trial can charge immediately.** The app does not automatically defer the first payment until the trial finishes.

## 3. How the platform owner gets subscription payments

```text
Shop owner opens Billing
        → pays through Stripe's secure form
        → Stripe processes the subscription payment
        → funds enter the platform's live Stripe balance
        → eligible available funds are paid to the platform's configured bank account
```

### Requirements before real money can reach your bank

1. Open the project's **Payments** tab in Lovable and choose the live setup flow.
2. Claim the test environment by creating or signing in to the intended Stripe account.
3. Verify the email address and complete Stripe's business/identity checks.
4. Add the bank account that should receive MVP BizManager subscription revenue.
5. Complete Stripe's live activation steps.
6. Install the Lovable app on the **live** Stripe account, if it was not copied during onboarding.
7. Allow Lovable to provision live credentials and live webhook endpoints automatically.
8. Complete the Payments readiness check.
9. Publish the live-ready app and have an authorized operator align the app's payment mode with `live`.
10. Verify a live payment and inspect its balance transaction and payout in the connected Stripe account.

Use the account belonging to the business that legally operates MVP BizManager. This README does not establish that business's legal name or account country.

### Payout timing and fees

- A successful checkout is **not** the same thing as a bank deposit.
- Funds can initially be pending; they become available according to the account's settlement rules.
- Stripe pays out according to the account's configured schedule and supported payout options.
- First payouts, verification holds, reserves, disputes, holidays, and bank processing can affect timing.
- A monthly subscription renewal schedule is separate from the bank payout schedule.
- Stripe fees, refunds, disputes, currency conversion, and account adjustments affect the net amount received.
- PHP is the checkout currency; the bank settlement currency and any conversion depend on the connected account.

**No fixed payout time or net payout amount has been verified for this account.** Check the connected account's payout settings and pricing rather than assuming every ₱499 payment results in a ₱499 bank deposit.

The app does not initiate bank payouts, store your bank account details, or display a reconciled payout ledger. Bank settlement is managed through Stripe.

### Where to check money received

Use Lovable's Payments tab to access the connected Stripe account. Check:

- **Payments:** whether the charge succeeded, failed, or was refunded.
- **Balance / balance transactions:** fees, pending funds, available funds, and adjustments.
- **Payouts:** deposit amount, destination bank, status, expected arrival, and failure details.

Labels can vary between Stripe account interfaces. If the test environment is unclaimed, dashboard links embedded in Stripe errors may not work; start from Lovable's Payments tab and complete the claim process.

**Test payments never create real money or real bank payouts.**

## 4. How shop owners receive their customers' payments

### Cash

1. Customer hands cash to the shop.
2. Staff select Cash in Register and enter the amount tendered.
3. The app calculates change and records the sale.
4. The cash remains with the shop; nothing goes through Stripe.

### GCash

1. Customer pays the shop's own GCash account using the shop's normal payment instructions.
2. Staff verify the payment in the shop's wallet or merchant confirmation.
3. Staff select GCash and record the sale.
4. The money goes to the shop's wallet, subject to that provider's rules—not to MVP BizManager's Stripe account.

### Card

1. Staff process the customer's card using the shop's own terminal or separate payment service.
2. Staff verify approval.
3. Staff select Card and record the sale.
4. Settlement follows the shop's card-provider agreement.

A POS receipt confirms an app-recorded sale; it is not independent proof that a wallet transfer or external card charge settled. A void in this app reverses the sale/stock record under its permission rules; it does **not** issue an external card or GCash refund. Handle any money refund separately with the relevant provider.

## 5. Subscription checkout: technical sequence

1. The signed-in owner opens `/billing` and selects Subscribe.
2. `CheckoutForm` calls authenticated `createCheckoutSession` with the client payment environment and return URL.
3. The server checks that the requested environment matches the server's configured mode.
4. It resolves the caller's shop and verifies owner membership; it does not accept a browser-supplied shop ID.
5. It resolves `bizmanager_monthly` using Stripe price lookup keys.
6. It retrieves the shop's stored Stripe customer or creates one with `userId` and `shop_id` metadata, then stores its ID on the shop.
7. It creates a subscription Checkout Session using `ui_mode: "embedded_page"`, quantity 1, customer, and shop/user metadata on the Session and Subscription.
8. The browser mounts Stripe's `EmbeddedCheckoutProvider` and `EmbeddedCheckout` using the returned client secret.
9. Stripe processes the payment and sends signed events to the app.
10. The webhook updates subscription records; the app reads those records to decide shop access.

Stripe API calls use `createStripeClient(environment)` from `src/lib/stripe.server.ts`. It routes requests through Lovable's connector gateway; the app does not use the manually supplied private Stripe API key.

Gateway connection keys are not ordinary Stripe secret keys. Never paste them into a direct Stripe SDK client or expose them in documentation, browser code, logs, or screenshots.

### Return page is not payment proof

Stripe returns to `/billing?checkout=success`. The UI shows a thank-you message and refreshes billing status every 3 seconds for up to 30 seconds.

The query parameter alone does **not** prove payment or unlock the shop. Confirm the synchronized subscription, correct shop, and correct payment mode. A redirect can complete before webhook processing finishes.

## 6. Test and live environments

| Setting | Test | Live |
| --- | --- | --- |
| Stored environment value | `sandbox` | `live` |
| Browser publishable token prefix | `pk_test_` | `pk_live_` |
| Real card charges / payouts | No | Yes |
| Webhook query | `?env=sandbox` | `?env=live` |

The browser derives its mode from the token prefix. Missing or unknown tokens are configuration errors, never an automatic fallback to live.

The backend's `app_config.payments_env` controls which subscriptions count for access. Its configuration is privileged—not owner-editable. Test subscriptions do not count when the app is configured for live, and vice versa.

Both environments can have records in the same database. They have different Stripe customer identities. The portal prefers the subscription's customer in the selected environment; webhook lookup can also use server-stamped customer metadata to resolve the shop.

### Current tax workaround

The app normally requests `automatic_tax: { enabled: true }`.

If Stripe returns `stripe_tax_inactive` **in test mode only**, checkout retries once with automatic tax disabled. Session and subscription metadata are marked `tax_mode: "sandbox_without_tax"`.

- The fallback does not retry unrelated Stripe failures.
- It never disables tax for a live checkout.
- It does not change the product price or grant access itself.
- It does not fix live account country eligibility or tax activation.

The code currently uses tax calculation/collection, **not** end-to-end filing/remittance handling (`managed_payments` is false). Do not assume Stripe is filing or remitting your taxes. Live tax settings and legal obligations must be reviewed for the actual account country before launch.

## 7. Webhooks, renewal, and cancellation

Endpoint: `/api/public/payments/webhook`.

The handler verifies the raw request body with the environment's webhook signing secret, checks signature format and a 5-minute timestamp tolerance, then processes supported events.

| Event | Current app behavior |
| --- | --- |
| `customer.subscription.created` / `updated` | Upserts the subscription and billing dates |
| `customer.subscription.deleted` | Stores canceled status |
| `checkout.session.completed` | Retrieves and synchronizes its subscription when payment status is not unpaid |
| Other events | Acknowledges receipt; no additional app-side action |

The shop is resolved from the server-stored Stripe customer or its server-stamped shop metadata. Owner identity is checked against shop membership. Subscription upserts use the provider subscription ID.

Stripe handles recurring payment attempts; the app does not charge cards with its own renewal scheduler. Updated subscription period dates arrive through Stripe events.

### Access rules

| Condition | Access |
| --- | --- |
| Shop is within its 14-day app trial | Available |
| Active/trialing subscription with a future billing period end (or null period end under current rules) | Available |
| `past_due` for less than 7 days | Available during the grace period |
| `past_due` for 7 days or more, with no remaining app trial or other qualifying subscription | Locked |
| Canceled subscription with a future paid-through date | Available until that date |
| Trial and paid-through access expired | Locked |

An unexpired app trial independently grants access. Canceling a subscription does not cancel any remaining app trial.

When locked, the owner retains read-only access and a **Download my data (CSV)** export; protected writes are blocked. Cashiers are blocked from protected shop data. Database policies and sensitive database functions enforce this—not just hidden buttons.

### Managing a plan

Billing → **Manage billing & payment method** creates a temporary hosted Stripe portal link and opens it in a new tab. Depending on portal configuration, owners can update payment methods, view invoices, and cancel renewal.

Open the preview in its own tab if the editor prevents the portal opening. Portal functionality depends on the connected account's portal configuration; the app does not implement a replacement portal.

Cancellation at period end keeps access through the paid-through date. Canceling is not the same as refunding.

## 8. Account deletion and refunds

### Deletion

Settings → Account → Delete my account requires typing `DELETE` and password re-verification, or recent Google reauthentication.

A sole shop owner with a renewing subscription is blocked from deletion until they cancel it. The check includes active, trialing, past-due, unpaid, incomplete, and paused subscriptions that are not marked to cancel at period end.

- Cashier deletion removes their login/membership while retaining shop sales as Former staff.
- An owner leaving a shop with another owner does not delete the shop.
- Sole-owner deletion removes the shop's associated data under the account-deletion rules.

Cancel before deletion and verify cancellation has synchronized. Deletion does not itself create a refund.

### Refund policy

The public `/refund-policy` currently offers a full refund requested within 30 days of the first payment **or each monthly renewal**.

Requests go to **orangewareph@gmail.com**, with the receipt email. Approved refunds go back to the original payment method; the policy estimates 5–10 business days, subject to bank/provider processing.

There is **no automated in-app refund request, refund approval, or refund-to-entitlement workflow**. Operators must process approved refunds through the payment provider and verify whether cancellation/access changes are also required. Do not assume a refund automatically cancels renewal or revokes access.

## 9. Billing diagnostics and troubleshooting

Billing provides:

- **Subscription link check:** current shop linkage, configured mode, subscription status, and other-mode records that are ignored.
- **Payment updates received:** recent app-logged webhook attempts, grouped by event ID with the newest attempt shown as final.
- **Retry history:** expandable recorded attempts with failure reason and copyable event ID.
- **Failure notifications:** owner-only in-app pop-up/banner, checked approximately once a minute; dismissal remembered on that device.
- **Test failure alert:** a local sample pop-up/banner; no provider failure, database event, email, or charge is created.

The event list checks every 15 seconds, reads up to 100 rows, and displays up to 25 event groups. It is **not** the provider's complete delivery/payout history. A displayed “Final” result means the latest attempt recorded so far; another retry can arrive later.

Legacy database columns named `paddle_*` now hold Stripe customer, subscription, and event identifiers. This does not mean Paddle still processes payments.

### Common issues

| Symptom | Check / action |
| --- | --- |
| `stripe_tax_inactive` in test checkout | Current code retries without tax only in test mode; reload/open checkout again |
| Same tax error in live checkout | Review account country eligibility and tax configuration; live tax is not silently bypassed |
| Unclaimed test environment / broken Stripe error links | Claim through Lovable's Payments tab |
| “Payments are being set up” | Browser environment and server mode must match; complete live setup if applicable |
| Return shows thanks but access is not updated | Check actual provider payment and synchronized subscription; refresh Billing and inspect events |
| Wrong payment mode | Test and live subscriptions are separate; correct privileged configuration instead of editing subscription rows |
| Manage billing does not open | Check portal activation/configuration and pop-up restrictions; use standalone preview |
| Payment succeeded but no bank deposit | Check pending/available balance, payout schedule, verification holds, and bank payout status |
| GCash/Card sale recorded but money missing | Verify the shop's external wallet/terminal; Register does not collect that payment |

Email notifications for low-stock or failed payment deliveries remain dependent on configuring the email domain; this README does not claim they are active.

## 10. Preview test procedure

**Use test cards only in a checkout clearly marked TEST MODE. Never use a real card for preview testing.**

1. Sign in as a shop owner and open Billing in the preview.
2. Confirm the test-mode banner and that the subscription link check reports Test.
3. Select Subscribe and confirm the embedded Stripe form opens.
4. For a successful test, enter:
   - Card: `4242 4242 4242 4242`
   - Expiry: any valid future month/year
   - CVC: any valid 3-digit value, such as `123`
   - Name and any required billing details: suitable test values
5. Submit Pay and subscribe. This creates a test subscription, not real money.
6. After returning, confirm Active, the correct shop link, matching Test mode, and a Synced payment update. Refresh if events take longer than the UI's 30-second polling window.
7. For meaningful unlock testing, use an expired-trial test shop; a new shop already has trial access, so access alone does not prove the subscription unlocked it.
8. Open Manage billing and test cancellation at period end. Confirm the paid-through date remains and access stays available until then.
9. Before canceling, verify deletion is blocked for a sole owner with a renewing plan. Do not finish deletion on an account you need to keep.
10. Select Test failure alert, verify the sample pop-up/banner, then Dismiss. This does not test a real webhook delivery.

Additional cards, in separate suitable test attempts:

| Scenario | Test card |
| --- | --- |
| Decline | `4000 0000 0000 0002` |
| Authentication / 3D Secure | `4000 0025 0000 3155` |

Do not repeatedly subscribe a shop that already has a plan. Use a dedicated test shop and review/cancel test subscriptions afterward. The server currently has no explicit duplicate-active-subscription guard; do not rely on hidden UI buttons as duplicate-payment protection.

### Automated checks

```sh
bun test tests/checkout-tax.test.ts
bun test tests/billing.integration.test.ts tests/billing-diagnostics.integration.test.ts tests/products.integration.test.ts --timeout 30000
```

Backend integration tests require the project's test environment and use throwaway authenticated accounts. Treat test credentials as secrets and follow the test files' setup. Do not run backend tests against a different production account without checking their setup and cleanup behavior.

The tax helper's three focused tests passed and the signed-in embedded test checkout form was verified opening after the tax fix. **Form rendering is not proof of a completed charge, synchronized subscription, or payout.** A success URL alone is also not that proof.

## 11. Live launch checklist and current limitations

- [ ] Confirm the seller's legal business name and Stripe account country.
- [ ] Complete Terms of Service and Privacy Notice; current legal drafts must be reviewed before launch.
- [ ] Claim the test environment, finish live verification, and configure the receiving bank account.
- [ ] Confirm the Lovable app is installed on the live Stripe account and live credentials/webhooks are provisioned.
- [ ] Complete the Payments readiness check and publish the live-ready app.
- [ ] Align privileged server payment mode with the live browser configuration.
- [ ] Verify live tax eligibility/settings and the final buyer price.
- [ ] Verify the customer portal's payment-method and cancellation settings.
- [ ] Complete a test-card subscription and read back the correct shop/mode through Billing.
- [ ] Verify renewal, failed-payment recovery, cancellation, and refund operations before relying on them for customers.
- [ ] Verify the first real payment and the actual bank payout separately.

As of the last account-status check in this conversation, claiming was in progress and subsequent live setup steps were not completed. Recheck Payments for the latest status; this README is not a live account-status feed.

Additional limitations visible in the current code:

- No annual plans, plan-change flow, or self-service refund workflow.
- No shop connected-account payouts or retail payment gateway.
- No app-side bank payout reconciliation or payout-failure notification.
- No explicit duplicate-subscription guard in the checkout server function.
- No dedicated app-side invoice/refund event reconciliation; access primarily follows subscription events.
- Webhook retry reporting is limited to attempts successfully logged by the app; it is not a complete delivery guarantee.
- Some Billing diagnostics and error wording remain English-only despite EN/TL support elsewhere.

These are documented limitations, not features added by this README update.

## 12. Implementation map

| File / area | Responsibility |
| --- | --- |
| `src/routes/_app/billing.tsx` | Billing UI, embedded checkout, portal action, export action, return polling |
| `src/utils/payments.functions.ts` | Authenticated owner checkout/portal creation |
| `src/lib/stripe.server.ts` | Gateway Stripe client, error detail, webhook signature verification |
| `src/lib/stripe.ts` | Browser Stripe loading and environment detection |
| `src/lib/checkout-tax.server.ts` | Narrow test-only unsupported-tax fallback |
| `src/routes/api/public/payments/webhook.ts` | Signed subscription synchronization and event logging |
| `src/lib/billing.ts` | Database-authoritative billing/environment reads |
| `src/components/BillingDiagnostics.tsx` | Shop link check, attempts, failure notifications, sample alert |
| `src/lib/billing-deliveries.ts` | Groups recorded attempts by event ID |
| `src/lib/account.functions.ts` | Reauthenticated account deletion and renewing-plan guard |
| `src/routes/_app/pos.tsx` | Records external Cash/GCash/Card shop sales |
| `src/routes/refund-policy.tsx` | Public refund policy |
| `drizzle/migrations/0023*`–`0030*` | Billing schema, access restrictions, mode, events, Stripe transition, grace period |
| `tests/checkout-tax.test.ts` | Tax retry boundaries |
| `tests/billing*.test.ts` | Access and diagnostics integration checks |

Security boundaries: owner membership is checked server-side, browser roles cannot write authoritative subscription rows, webhook signatures are required, and shop access is enforced in the database. Keep generated integration files and private credentials out of manual edits.

## 13. Official references

- [Lovable payments](https://docs.lovable.dev/features/payments)
- [Stripe payouts](https://docs.stripe.com/payouts)
- [Stripe payout balances](https://docs.stripe.com/payouts/balances)
- [Stripe refunds](https://docs.stripe.com/refunds)
- [Stripe testing](https://docs.stripe.com/testing)
- [Stripe customer portal](https://docs.stripe.com/customer-management)
- [Stripe tax supported countries](https://docs.stripe.com/tax/supported-countries)
- [Stripe pricing](https://stripe.com/pricing)

Account-specific fee rates, payout schedules, country support, and requirements can change; use the connected account's current settings and official guidance.

## 14. Project and development

**Public app:** https://mvp.com.ai  
**Alternate published address:** https://smartbiz-pro.lovable.app  
**Support:** orangewareph@gmail.com

Built with Lovable using React, TanStack Start, Lovable Cloud, and Tailwind CSS. The app also includes inventory, decimal stock quantities, customers, suppliers, stock history, owner/cashier roles, AI insights, and an installable PWA experience.

For local development, install the project's dependencies and use the configured development command. Never commit private keys, session tokens, or production credentials.

```sh
bun install
bun run dev
```

Continue changes through the [Lovable project editor](https://lovable.dev/projects/7743ade6-55a2-4176-8349-318ea4c04396).
