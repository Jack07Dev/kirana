-- Phase 3: RLS for inventory_movements

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners read store inventory movements"
  ON inventory_movements FOR SELECT
  USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "No direct inventory movement writes"
  ON inventory_movements FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No inventory movement updates"
  ON inventory_movements FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No inventory movement deletes"
  ON inventory_movements FOR DELETE TO authenticated
  USING (false);
