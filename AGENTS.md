<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use React Three Fiber for decorative 3D scenes so renderer lifecycle, resize, and cleanup stay React-managed.
- UI wording lives in the backend translations table (key, lang en/tl); src/lib/i18n-dict.ts is the offline fallback and seed source — keeps copy editable without code changes.
- BIZBOT uses one browser-local AI SDK UIMessage conversation and a global floating client — matching the chosen single-device chat experience.
- The opening video is browser-local first-visit onboarding and emits completion before the install prompt — prevents overlapping first-run experiences.
- Installation state and reopening use the shared browser event in src/lib/install.ts — keeps public and signed-in navigation synchronized with one install window.
- All server responses set X-Frame-Options DENY and CSP frame-ancestors none — prevents clickjacking by disallowing third-party framing.
- Account deletion runs in a requireSupabaseAuth server function that re-verifies the user and calls a service-role-only SQL function; audit keeps only date + hashed id — keeps the service key server-side and PII out of logs.
- Sales and historical sample-store rows are written only by authenticated database functions; browser roles have no direct sales write grants — totals, costs, timestamps, shop, and cashier remain server-controlled.
- Staff activity is recorded by database triggers into activity_log (owner-read only) and refresh jobs record each run in refresh_runs — audit can't be skipped or forged from the browser.
- Shared audit triggers use JSON-safe field access in cross-table guards and access typed NEW/OLD fields only inside table-specific branches — unrelated shop updates must not resolve sales-only columns.
- Business color themes (incl. custom palettes) override semantic CSS tokens, are cached in browser storage, and sync to the signed-in account via user_theme_prefs — themes follow the user across devices without per-theme component styles.
- Store branding in Settings, navigation, and receipts uses one shop-scoped profile query with refreshed private logo URLs — saved owner changes reach every shop member without using stale personal profile names.
- Store image choices are previewed locally, resized to PNG, and saved through the same private logo upload; AI generation streams through an owner-verified server route with server-only credentials and a durable access-block record — generated images never overwrite the store logo without confirmation.
- Platform Super Admin lives at /admin (served on admin.mvp.com.ai, hidden on shop hosts); access = platform_admins allowlist + TOTP MFA (aal2), enforced inside SECURITY DEFINER admin_* SQL functions — keeps admin data unreachable from the shop app and browser writes impossible. Seed admins via SQL only: insert into public.platform_admins (email, created_by) values (lower('YOUR_ADMIN_EMAIL'), 'sql_seed');
- Product stock lives in numeric products.stock_qty (stock is a synced whole-number mirror); shop_id is forced by trigger, product edits go through update_product/remove_product RPCs and cashier inserts depend on shops.allow_cashier_products — keeps decimals, archiving and cashier limits enforced in the database without exposing cost.
- Stock restocks/losses/corrections go only through the owner-only adjust_stock RPC, which writes stock_movements (owner-read, no browser write grants); bun integration tests in tests/ exercise RLS with throwaway signed-in users — history cannot be forged and permissions are verified against the real backend.
- Sign-up details (owner name, mobile, business type) travel in auth user metadata and are copied onto the shop only by ensure_my_shop when it creates a brand-new shop; product cost is nullable (unknown) and sales treat it as 0 — no browser write path to shop identity and no fake 100% margins.
- Low-stock alerts are rows in stock_alerts written only by a products trigger when tracked stock crosses its reorder_level (shop toggle shops.low_stock_alerts, one unread alert per product); owners can only read and mark read — event-driven, no scheduled polling, cannot be forged from the browser.
- Supplier reorders are purchase_orders/purchase_order_items (owner-only RLS, shop forced by trigger, items editable only while draft); drafts are created from stock_alerts by create_reorder_from_alerts and receiving restocks via adjust_stock so every received unit lands in stock history.
- Shop subscriptions are written only by the signature-verified payments webhook (service role); shop_has_access(shop) (trial window or paid-through subscription) gates current_shop_id() and restrictive RLS on every shop-data table, while current_shop_id_raw() serves billing status, shop context and onboarding — unpaid shops are blocked in the database, not just the UI.

- Stripe (own account, REST via fetch in src/lib/stripe.server.ts) runs beside Paddle; Stripe subscriptions share the subscriptions table (provider=stripe) and are written only by the signature-verified /api/public/stripe/webhook — one access rule for both providers.
