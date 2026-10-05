CREATE POLICY "shop owners upload private documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shop-documents'
  AND public.is_shop_owner(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "shop owners read private documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'shop-documents'
  AND public.is_shop_owner(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "shop owners update private documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'shop-documents'
  AND public.is_shop_owner(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'shop-documents'
  AND public.is_shop_owner(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "shop owners delete private documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'shop-documents'
  AND public.is_shop_owner(((storage.foldername(name))[1])::uuid)
);