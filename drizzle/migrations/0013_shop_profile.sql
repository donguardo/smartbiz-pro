ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS business_categories text[] NOT NULL DEFAULT '{}';
CREATE POLICY "shop owners upload logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-logos' AND public.is_shop_owner(((storage.foldername(name))[1])::uuid));
CREATE POLICY "shop owners update logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-logos' AND public.is_shop_owner(((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'shop-logos' AND public.is_shop_owner(((storage.foldername(name))[1])::uuid));
CREATE POLICY "shop owners delete logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-logos' AND public.is_shop_owner(((storage.foldername(name))[1])::uuid));