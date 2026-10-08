-- Patch 4d: plan positioning. Customer-facing names become Solopreneur / Booming Business / MultiVerse,
-- with SKU caps 500 / 1,000 / 2,000 per shop.
-- Internal plan keys stay basic/standard/pro on purpose: they are permanent keys referenced by
-- subscriptions.plan, subscriptions.pending_plan, the trial_plan config and the Stripe lookup keys,
-- so only the customer-facing label and the per-shop caps move here.
UPDATE public.plan_limits SET
  label = CASE plan WHEN 'basic' THEN 'Solopreneur' WHEN 'standard' THEN 'Booming Business' WHEN 'pro' THEN 'MultiVerse' END,
  max_skus = CASE plan WHEN 'basic' THEN 500 WHEN 'standard' THEN 1000 WHEN 'pro' THEN 2000 END,
  updated_at = now()
WHERE plan IN ('basic','standard','pro');

-- Wording: new names, the exact positioning lines, the "best for" lines, and every place the old
-- plan names or the old 999 / unlimited SKU figures were quoted.
INSERT INTO public.translations (key, lang, value, updated_at) VALUES
  ('plan.basic.name','en','Solopreneur',now()), ('plan.basic.name','tl','Solopreneur',now()),
  ('plan.standard.name','en','Booming Business',now()), ('plan.standard.name','tl','Booming Business',now()),
  ('plan.pro.name','en','MultiVerse',now()), ('plan.pro.name','tl','MultiVerse',now()),
  ('plan.basic.tagline','en','One store. Full control. Zero complexity.',now()), ('plan.basic.tagline','tl','Isang tindahan. Buong kontrol. Walang complication.',now()),
  ('plan.standard.tagline','en','Your business is growing — manage 3 stores without the chaos.',now()), ('plan.standard.tagline','tl','Lumalaki na ang negosyo mo — pamahalaan ang 3 tindahan nang walang gulo.',now()),
  ('plan.pro.tagline','en','Run up to 5 stores across your own little universe.',now()), ('plan.pro.tagline','tl','Pamahalaan ang hanggang 5 tindahan sa sarili mong maliit na sansinukob.',now()),
  ('plan.basic.best','en','Single store / solo owner',now()), ('plan.basic.best','tl','Isang tindahan / solo owner',now()),
  ('plan.standard.best','en','Growing 2–3 locations',now()), ('plan.standard.best','tl','Lumalaking 2–3 lokasyon',now()),
  ('plan.pro.best','en','Multi-branch operators',now()), ('plan.pro.best','tl','May maraming branch',now()),
  ('plan.standard.f2','en','1,000 products per shop',now()), ('plan.standard.f2','tl','1,000 produkto bawat tindahan',now()),
  ('plan.pro.f2','en','2,000 products per shop',now()), ('plan.pro.f2','tl','2,000 produkto bawat tindahan',now()),
  ('plan.standard.skus','en','1,000 products (SKUs) per shop',now()), ('plan.standard.skus','tl','1,000 produkto (SKU) kada shop',now()),
  ('plan.pro.skus','en','2,000 products (SKUs) per shop',now()), ('plan.pro.skus','tl','2,000 produkto (SKU) kada shop',now()),
  ('plan.trial','en','14-day free trial of Booming Business, no card needed',now()), ('plan.trial','tl','14 araw na libreng trial ng Booming Business, walang card',now()),
  ('plan.trial_left','en','Booming Business trial: {n} days left',now()), ('plan.trial_left','tl','Booming Business trial: {n} araw na lang',now()),
  ('plan.locked.smart_reorder','en','Best orders list is on Booming Business and MultiVerse.',now()), ('plan.locked.smart_reorder','tl','Nasa Booming Business at MultiVerse ang Best orders list.',now()),
  ('reorder.smartLocked','en','Best orders list (Booming Business and MultiVerse)',now()), ('reorder.smartLocked','tl','Best orders list (Booming Business at MultiVerse)',now()),
  ('bot.faqPricing','en','Solopreneur ₱499/month: 1 shop, 500 products per shop, brand promotions. Booming Business ₱999/month: up to 3 shops, 1,000 products per shop, no ads, AI Menu Builder. MultiVerse ₱1,499/month: up to 5 shops, 2,000 products per shop, no ads. One price covers the whole business, cashiers included. Opening more shops is coming soon.',now()),
  ('bot.faqPricing','tl','Solopreneur ₱499/buwan: 1 tindahan, 500 produkto bawat tindahan, may brand promotions. Booming Business ₱999/buwan: hanggang 3 tindahan, 1,000 produkto bawat tindahan, walang ads, may AI Menu Builder. MultiVerse ₱1,499/buwan: hanggang 5 tindahan, 2,000 produkto bawat tindahan, walang ads. Isang presyo para sa buong negosyo, kasama na ang mga cashier. Malapit na ang pagbukas ng dagdag na tindahan.',now()),
  ('bot.faqTrial','en','Yes. New owners get a 14-day free trial of Booming Business, no card needed. After the trial, pick Solopreneur, Booming Business or MultiVerse on the Billing page.',now()),
  ('bot.faqTrial','tl','Oo. May 14 araw na libreng trial ng Booming Business ang bagong owner, hindi kailangan ng card. Pagkatapos ng trial, pumili ng Solopreneur, Booming Business o MultiVerse sa Billing page.',now())
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.translations FROM anon, authenticated;