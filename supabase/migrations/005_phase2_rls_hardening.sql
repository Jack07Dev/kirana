-- Phase 2: RLS hardening — orders via RPC only; product visibility; fee rules admin-only writes

DROP POLICY IF EXISTS "Anyone can view active products of visible stores" ON products;

CREATE POLICY "View active products of online approved stores"
  ON products FOR SELECT USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR (
      is_active = true
      AND store_id IN (
        SELECT id FROM stores
        WHERE is_online = true AND approval_status = 'approved'
      )
    )
  );

DROP POLICY IF EXISTS "Customers can create orders" ON orders;
DROP POLICY IF EXISTS "Customers insert order items" ON order_items;

-- Customers may still cancel pending orders
-- (existing policy "Customers can cancel pending orders" unchanged)

-- Fee rules: read-only for app users (writes via service role / future admin)
CREATE POLICY "No direct fee rule writes"
  ON platform_fee_rules FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct fee rule updates"
  ON platform_fee_rules FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No direct fee rule deletes"
  ON platform_fee_rules FOR DELETE TO authenticated
  USING (false);
