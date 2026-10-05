# Business dashboard showcase

## What will be built
- Add a public **Business Showcase** gallery linked from the landing page, with folder-style category cards for:
  - Coffee Shop
  - Laundry
  - Beauty Parlor
  - Café
  - Restaurant
- Give each category its own detailed preview page with realistic Philippine SME sample figures, category mix, sales trend, profit, transactions, operational alerts, and a short customer scenario.
- Keep every sample interactive so customers can adjust sales, margins, growth, and average ticket, with charts and totals recalculating immediately.
- Use a suitable, accessible visual theme for each business while preserving MVP BizManager branding:
  - Coffee Shop: deep coffeehouse green
  - Laundry: clean aqua/blue
  - Beauty Parlor: plum with exact `#FF00FF` when magenta appears
  - Café: warm coffee brown
  - Restaurant: fiesta red and gold
- Add English and Tagalog wording through the existing translations system.
- Ensure the gallery and every sample dashboard work cleanly on phones and desktop.

## Workspace organization
- Create five parallel showcase drafts, one for each business category, so each can be reviewed independently without changing the main app.
- A Lovable workspace folder cannot be created with the available project tools. No matching folder currently exists, so moving the project copies into a dashboard-level folder will remain pending until a folder is created from **New folder** in the Lovable workspace.

## Technical details
- Add a data-driven scenario catalog and reusable showcase dashboard rather than duplicating chart logic five times.
- Add `/showcase` and `/showcase/$business` public pages with unique titles and sharing descriptions.
- Extend semantic color tokens with laundry and beauty themes; reuse existing coffeehouse, café, and fiesta themes.
- Add the new wording to both the offline dictionary and backend translations table.
- Verify all five samples at phone and desktop sizes, including chart contrast, overflow, navigation, interactive recalculation, and theme switching.
