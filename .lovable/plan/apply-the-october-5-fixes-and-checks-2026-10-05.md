# Apply the October 5 fixes and checks

## What will change

1. **Small, fixed BIZBOT launcher**
   - Replace the large draggable robot with a 56px circular button fixed 16px from the bottom-right on public and signed-in pages.
   - Keep the full chat panel, voice controls, and conversation behavior when tapped.
   - Reserve enough bottom space across page layouts so the launcher cannot cover calls to action, receipt totals, dashboard cards, charts, or inputs.

2. **Light-first visual treatment**
   - Keep light mode as the default for visitors without a saved preference and preserve the remembered light/dark toggle.
   - Remove purple-tinted section and frame backgrounds in light mode, leaving white cards, dark text, a plain light page background, and purple for the logo and primary actions.

3. **Clear business-status colors**
   - Show positive movement and profit in green with `▲`, negative movement and low stock in red with `▼`, and warnings in amber with `⚠`.
   - Apply this consistently to the public demo, signed-in dashboard, and inventory warnings, including the percentage inside the “Boss…” summary.

4. **Dashboard chart and language fixes**
   - Keep each category legend directly with its donut chart on both dashboards.
   - Use the exact requested Taglish card labels and translated summary while preserving plain English labels.
   - Add any new EN/TL wording to both the local fallback and editable backend translations.

5. **Server-only sales writes**
   - Keep browser write privileges removed from `sales` and `sale_items`.
   - Preserve `record_sale` as the only checkout path; it recalculates price and cost from products, timestamps on the server, identifies the signed-in cashier, and accepts only product IDs and quantities.
   - Add an owner-only server function for loading historical sample sales, then change the demo-store loader so it never writes sales or line items directly from the browser.
   - Keep product creation and sample sales in one controlled loading flow with clear error handling.

## Verification

- Confirm fresh visitors start in light mode and saved theme choices persist.
- Test public landing/demo and signed-in owner screens at 360px, 480px, and desktop widths for overlap and horizontal overflow.
- Exercise BIZBOT opening, EN/TL switching, chart legends, sample-store loading, and normal checkout.
- Attempt direct browser writes to `sales` and `sale_items` and confirm they are denied.
- Recheck the database schedule catalogue. The current database has no `cron.job` relation, so no database-scheduled jobs are active; the existing secured refresh endpoint remains unscheduled unless an external scheduler is configured.
- Run the final app checks, update the roadmap, and publish as requested by the attached instructions.

## External items not changed by app code

- Test-account credentials must be exchanged privately; passwords will not be posted in chat.
- The `www` redirect, custom-domain email DNS/DMARC, and hosted sign-in URL settings require the domain/email host controls. They will be reported separately if still unresolved after the app update.
