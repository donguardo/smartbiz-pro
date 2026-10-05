CREATE POLICY "shop members read logos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shop-logos' AND public.is_shop_member(((storage.foldername(name))[1])::uuid));
COMMENT ON COLUMN public.shops.logo_url IS 'Storage path of the shop logo in the private shop-logos bucket (not a public URL)';