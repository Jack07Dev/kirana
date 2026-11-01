-- Phase 5: RLS for delivery tables

ALTER TABLE delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage delivery partners"
  ON delivery_partners FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

CREATE POLICY "Partners read own partner row"
  ON delivery_partners FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners see store assignments"
  ON delivery_assignments FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "Partners see own assignments"
  ON delivery_assignments FOR SELECT
  USING (
    partner_id IN (
      SELECT id FROM delivery_partners WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Customers see assignment otp for own order"
  ON delivery_assignments FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );

CREATE POLICY "No direct assignment writes"
  ON delivery_assignments FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct assignment updates"
  ON delivery_assignments FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No direct assignment deletes"
  ON delivery_assignments FOR DELETE TO authenticated USING (false);

CREATE POLICY "Order history visible to order parties"
  ON order_status_history FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE customer_id = auth.uid()
         OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    )
    OR order_id IN (
      SELECT da.order_id FROM delivery_assignments da
      JOIN delivery_partners dp ON dp.id = da.partner_id
      WHERE dp.user_id = auth.uid()
    )
  );

CREATE POLICY "No direct history writes"
  ON order_status_history FOR INSERT TO authenticated WITH CHECK (false);
