-- Supabase Storage for store & product images (public read)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'store-photos',
    'store-photos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'product-photos',
    'product-photos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  )
ON CONFLICT (id) DO NOTHING;

-- Path: {user_id}/stores/{store_id}/...
CREATE POLICY "Owners upload store photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners update store photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners delete store photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public read store photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'store-photos');

-- Path: {user_id}/products/{store_id}/...
CREATE POLICY "Owners upload product photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners update product photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners delete product photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public read product photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-photos');
