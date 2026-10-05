# MVP BizManager Core Benefits Expansion

## Goal
Ship the complete uploaded D1, G1–G5, and R1 scope now as one coordinated release while preserving existing accounts, profiles, products, sales, receipts, and language preferences.

## Build sequence

### 1. Establish secure shops and staff roles first
- Add shops, owner/cashier memberships, one-time 48-hour invites, and server-verified membership/ownership helpers.
- Migrate every existing account and its products, sales, and sale items into its own shop without deleting or resetting data.
- Record the cashier on every new sale and make checkout atomic so the receipt, line items, and stock update together.
- Replace owner-ID policies with shop membership for allowed reads/actions and ownership checks for sensitive actions.
- Add a Staff page for invite links, pending-invite cancellation, cashier removal, and visible role labels.
- Restrict cashiers to the register, products/stock, receipts, and today’s sales; protect reports, costs, goals editing, settings, staff, customer contacts, expenses, and supplier contacts on the server.

### 2. Simplify both dashboards
- Use plain EN/TL labels, an instant “answer first” sales sentence, a mobile 2×2 metric grid, chart legends/day labels, and a maximum five-category sales mix plus Others.
- Show profit per ₱100 as pesos, directional arrows for gains/losses, and accessible green/red/amber states.
- Make light mode the first-use default and use the specified calm light/dark dashboard surfaces while keeping brand purple/magenta for key actions and selected navigation.
- Replace the large signed-in BIZBOT with a fixed 56px face button above mobile navigation; retain the larger public landing-page robot.

### 3. Add goals and forecasts
- Add owner-managed daily, weekly, and monthly peso goals in Settings, using Asia/Manila periods and one active goal per period.
- Show live progress, amount remaining, expected-pace state, and a remembered one-time goal celebration from completed, non-voided, non-refunded sales only.
- Add explainable 7-day and 30-day forecasts based on eight weeks of shop history, capped recent trend, weekday variation, shop-specific payday effects, and low/high ranges.
- Save forecasts daily at 1:00 AM Manila time and weekly opportunity summaries every Monday; show the two-week minimum-data message when needed.
- Include goal and forecast summaries in BIZBOT context, always describing forecasts as estimates.

### 4. Add customers and privacy controls
- Add optional customers to checkout, with required consent only when creating a customer; checkout remains valid without one.
- Give owners full customer management and 30/90-day insights, repeat-buyer counts, lapsed-customer lists, and copyable promo suggestions.
- Return only server-masked mobile numbers to cashiers and never send customer names or numbers to BIZBOT.
- Anonymize deleted customers while preserving historical sale totals.

### 5. Add suppliers, expenses, notes, and documents
- Add owner-managed suppliers and product costs; cashiers see only supplier names and product relationships.
- Add owner-only expenses and monthly category totals, then calculate net profit from sales minus product costs and expenses.
- Add 2,000-character shop notes and private PDF/JPG/PNG documents, limited to 5 MB, with browser photo resizing to 1600px/approximately 80% JPEG quality.
- Keep files private by shop, open them with short-lived signed links, and show permit/document expiry reminders 30 days ahead.

### 6. Complete inventory assistance and daily tips
- Calculate 30-day days-of-supply, flag over 60 days as overstock, show money tied up, add an Overstock filter, and retain no-sale dead-stock handling.
- Generate one localized tip per shop each day at 6:00 AM Manila time from approved totals and product names only; store it so reloads never regenerate it.
- Add a deterministic saved-data fallback and thumbs-up/down feedback.
- Schedule AI work through a secret-verified TanStack public server endpoint, the supported equivalent of the uploaded document’s older edge-function instruction.

### 7. Navigation, wording, and verification
- Add role-aware Settings, Staff, Customers, Suppliers, Expenses, and Documents pages with unique metadata.
- Store every new EN/TL label in backend translations and keep the local dictionary synchronized as the offline fallback.
- Verify desktop and 360px mobile layouts, WCAG AA contrast, no horizontal scrolling, receipt/void goal recalculation, invite acceptance/removal, masked cashier responses, private files, forecast access rejection, and complete two-shop isolation.

## Technical details
- Use one database migration with explicit grants before row-level security policies for every new public table.
- Keep roles in the dedicated membership table; all privileged mutations use authenticated server functions or security-definer database functions with fixed search paths.
- Add sale status/refund fields so goals, forecasts, insights, and reports consistently exclude voided/refunded sales.
- Daily database schedules save forecasts/opportunities and call the secret-verified tip endpoint; no AI call happens during ordinary page loading.
- Private document storage uses per-shop folders and signed URLs only.
- Existing browser-local BIZBOT conversation, PWA installation flow, intro video, branding, legal pages, and account recovery remain intact.