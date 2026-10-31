-- Run in Supabase SQL Editor to see what is already applied.
-- If core tables exist, skip 001_initial_schema.sql.

SELECT typname AS enum_type
FROM pg_type
WHERE typname IN (
  'user_role', 'store_type', 'order_status', 'payment_method'
)
ORDER BY 1;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'stores', 'products', 'orders', 'order_items',
    'catalog', 'addresses', 'khata_accounts', 'khata_ledger', 'payments'
  )
ORDER BY 1;

-- RLS enabled on main tables?
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('users', 'stores', 'orders', 'products')
ORDER BY 1;

-- Sample policies on users (if any row, 002 likely applied)
SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY 1;

-- Storage buckets (from 003 — run 003 only if this returns 0 rows)
SELECT id, public FROM storage.buckets
WHERE id IN ('store-photos', 'product-photos');
