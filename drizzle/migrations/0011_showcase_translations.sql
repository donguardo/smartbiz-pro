INSERT INTO public.translations (key, lang, value) VALUES
('nav.showcase','en','Business examples'),('nav.showcase','tl','Mga halimbawa ng negosyo'),
('showcase.kicker','en','Sample dashboard folders'),('showcase.kicker','tl','Mga sample dashboard folder'),
('showcase.title','en','See how MVP BizManager fits your business'),('showcase.title','tl','Tingnan kung paano babagay ang MVP BizManager sa negosyo mo'),
('showcase.description','en','Open a business folder, change its sample numbers, and see sales, profit, charts, and alerts recalculate instantly — no login needed.'),('showcase.description','tl','Buksan ang folder ng negosyo, palitan ang sample na numero, at makitang agad magbago ang benta, tubo, charts, at alerts — walang login.'),
('showcase.open','en','Open sample dashboard'),('showcase.open','tl','Buksan ang sample dashboard'),('showcase.sample','en','Interactive sample'),('showcase.sample','tl','Interactive sample'),
('showcase.goodFor','en','Who this fits'),('showcase.goodFor','tl','Para kanino ito'),('showcase.edit','en','Change the sample numbers'),('showcase.edit','tl','Palitan ang sample na numero'),
('showcase.reset','en','Reset'),('showcase.reset','tl','I-reset'),('showcase.sales','en','Weekly sales (₱)'),('showcase.sales','tl','Lingguhang benta (₱)'),
('showcase.margin','en','Profit %'),('showcase.margin','tl','Tubo %'),('showcase.growth','en','Week-on-week change'),('showcase.growth','tl','Pagbabago kada linggo'),
('showcase.ticket','en','Average customer spend'),('showcase.ticket','tl','Average na gastos ng customer'),('showcase.weeklyGoal','en','Weekly sales goal'),('showcase.weeklyGoal','tl','Goal sa lingguhang benta'),
('showcase.salesTrend','en','Sales by day'),('showcase.salesTrend','tl','Benta bawat araw'),('showcase.salesMix','en','Where sales come from'),('showcase.salesMix','tl','Pinanggagalingan ng benta'),
('showcase.yoursTitle','en','Ready to see your own business numbers?'),('showcase.yoursTitle','tl','Handa ka na bang makita ang numero ng negosyo mo?'),
('showcase.yoursBody','en','Start your MVP BizManager account and replace the sample with your real sales.'),('showcase.yoursBody','tl','Gumawa ng MVP BizManager account at palitan ang sample ng totoong benta mo.')
ON CONFLICT (key,lang) DO UPDATE SET value=EXCLUDED.value, updated_at=now();
