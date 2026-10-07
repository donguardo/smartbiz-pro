# Roadmap
## Publishing build repair
- [x] Inline the startup guard in Nitro configuration to eliminate missing helper imports
- [x] Confirm automatic build passes after deployment diagnostics; no publishing or payments/secrets changes

## Offline account and shop safety
- [x] Keep queues shop-scoped, migrate legacy queues, and show other-shop/account counts
- [x] Scope deliberate sign-out cleanup; preserve queues after unexpected sign-out and clear read caches
- [x] Review code and automatic checks only; no database test writes, payments, secrets, or publishing

## Blockhole live page
- [x] Verify the embedded game loads in preview and identify the live startup error
- [x] Add and validate the final-output startup guard; automatic build passed and preview game renders
- [ ] Verify the live Blockhole page after publishing — blocked: changes have not been published

## Offline plan and price handling
- [x] Cache billing and apply offline expiry rules without blocking unknown plans
- [x] Explain changed prices, preserve original sale time and label aged receipts
- [x] Show last price-sync time; verify by code review and automatic checks only

## Offline sale idempotency
- [x] Apply exact sale-idempotency SQL and regenerate types without test data writes
- [x] Preserve checkout IDs, shop-scope queues, and serialize sync/queue changes across tabs
- [x] Display offline sync time on sales and receipts; review code and automatic build only

- [x] Landing page with setup walkthrough + live demo dashboard
- [x] Accounts (email + Google), light/dark theme, installable on phones
- [x] Dashboard, POS register with receipts, inventory
- [x] AI Manager: reorder + dead-stock alerts
- [x] Floating AI Manager chat with one browser-saved conversation and voice input/output
- [x] Double the floating BIZBOT size
- [x] Add random rotating, peeking, zooming, and playful BIZBOT motions
- [x] Purple–magenta theme with an animated Three.js background
- [x] Make the hero slogan dominant and reduce the supporting headline
- [x] Contain the hero animation and simplify it to a sphere and hexagon
- [x] Pitch black background (dark theme default)
- [x] Smoked-glass frames on cards, sidebar, and headers
- [x] Tagalog / English switcher with flags, wording stored in the database
- [x] Legible text contrast in light mode

- [x] First-visit opening intro video with skip and remembered completion
- [x] Show installed status and make installation guidance reusable from navigation
- [x] Fix phone layouts across landing and account pages
- [x] Add Privacy Notice and Terms of Service pages and links
- [x] Standardize the MVP BizManager brand and payment wording
- [x] Add anti-framing security headers
- [x] Add forgot-password and password-reset flows

## Core Benefits Expansion
- [x] D1: Simplify signed-in and demo dashboards, calmer accessible colors, light default, compact in-app BIZBOT
- [x] R1: Add shops, owner/cashier memberships, secure invites, role-aware navigation and permissions
- [x] G1: Add daily, weekly and monthly sales goals with live progress and celebrations
- [x] G2: Add saved 7/30-day forecasts and weekly opportunity summaries
- [ ] Schedule the secured daily forecast, opportunity and tip refresh (requires Lovable scheduling or Inngest)
- [x] G3: Add consent-based customers, server-masked mobile numbers and customer insights
- [x] G4: Add suppliers, expenses, notes, private documents and expiry reminders
- [x] G5: Add overstock analysis, daily localized AI tips and feedback
- [x] Sync all new English/Tagalog wording to backend translations
- [x] Verify the owner workspace across desktop and 360px mobile
- [x] Delete my account (Settings → Account) + public /delete-account page
- [ ] Verify cashier permissions and second-shop isolation (requires suitable additional test accounts)

## October 5 fixes and checks
- [x] Replace BIZBOT launcher with a fixed 56px bottom-right button and reserve page space
- [x] Confirm light-mode default and restrict purple to logo and primary actions
- [x] Apply semantic green/red/amber indicators across demo and signed-in dashboards
- [x] Keep each donut legend with its donut chart
- [x] Complete requested Taglish dashboard labels and summaries
- [x] Harden sales writes to server-only functions and move sample sales seeding server-side
- [x] Inspect scheduled database jobs and report external domain/email/test-account blockers
- [x] Verify 360–480px and desktop flows, then publish
- [x] Replace placeholder support email with the real support address (needs the address from the user)
- [x] Fix pie chart label contrast so text stays readable over every slice colour
- [x] Enlarge BIZBOT by 20% and restore levitating, screen-bounded dragging
- [x] Add saved business color themes in Settings (MVP, café brown, coffeehouse green, fiesta red)
- [x] Add BIZBOT minimize and restore controls without leaving the page
- [x] Remember BIZBOT's dragged position across refreshes and app reopenings
- [x] Add five interactive business dashboard showcases with matching themes and EN/TL wording
- [x] Add auto-playing business showcase carousel to the hero with theme-colored slides
- [x] Add touch-swipe navigation to the hero showcase carousel
- [x] Add visible pause and play control to the hero showcase carousel
- [x] Make each business slide change a pronounced elastic bounce-in transition
- [x] Add a countdown progress bar to the hero showcase carousel
- [x] Add auto-playing business showcase carousel to the hero with theme-colored slides
- [x] Add touch-swipe navigation to the hero showcase carousel
- [x] Add a visible pause and play control to the hero carousel
- [x] Add a visible progress indicator to the hero carousel
- [x] Redesign the hero carousel as a peeking slide-track: next/previous business cards visible on the left/right edges while sliding
- [x] Platform Super Admin (/admin, allowlist + MFA, view-only) — blocked: first admin email + admin.mvp.com.ai domain connection
- [x] Business profile manager (logo, name, categories) in Settings
- [x] Add preset business icons and prompt-based AI logo previews with explicit save to the store profile — preset save/reload/removal and real AI generation verified in signed-in Settings; mobile layout checked.
- [x] Fix profile/logo saves blocked by shared activity trigger — actual business name save/reload, private logo upload/reload, and removal verified; original test shop details restored.
- [x] Show saved business name and private store logo in app navigation, digital receipts, and receipt-only printing — signed-in name checked; logo/receipt rendering checked with isolated sample responses, without creating real sales.

## Payments
- [x] Create ₱499/user/month plan in payment provider
- [x] Checkout + subscription sync + access control (awaiting business rules)
- [x] Customer billing portal

## Billing launch checklist (real payments)
- [ ] Legal business details — blocked: need your legal business name (or your own name if selling as an individual)
- [ ] Terms of Service — still placeholder; must name the seller, include the Paddle reseller (Merchant of Record) clause, acceptable use, IP, suspension (waits on legal name)
- [ ] Privacy Notice — must name the seller as data controller, list data collected, and name Paddle as a recipient (waits on legal name)
- [x] Refund policy — /refund-policy, 30-day money-back guarantee, linked in footer and Billing
- [ ] Payment readiness check — not started (runs from the Payments dashboard after the pages above are done)
- [x] Project published
- [ ] Payment-provider verification — action required: complete the verification form in the Payments dashboard
- [ ] Domain review, business/identity checks, final review — by the payment provider after verification
- [x] Automated tests: expired-trial lockout and subscription restore (tests/billing.integration.test.ts)
- [x] Patch 3: payments test mode — server-side payments_env (app_config), access counts only same-mode subscriptions, locked shops owner read-only + data export, Billing/Reorders owner-only, webhook env verified by signature
- [ ] Patch 3 retest checklist T3a/T4/T5/T8 (needs Paddle sandbox webhook simulator and test-card checkout)

- [ ] Email owners on failed Paddle deliveries — blocked: email domain not set up
- [x] Switched billing from Paddle to built-in Stripe
- [x] Sandbox-only unsupported-tax retry preserves live tax settings and shop linkage; focused tests added.
- [ ] Verify embedded test-card checkout after tax fix; live setup awaits sandbox claim and verification.
