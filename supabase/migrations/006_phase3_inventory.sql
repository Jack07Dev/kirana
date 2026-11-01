-- Phase 3: inventory movements, stock RPCs, order cancel restore, direct stock edit guard

CREATE TYPE inventory_movement_type AS ENUM (
  'sale',
  'restock',
  'adjustment',
  'cancellation_release',
  'status_override'
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reorder_threshold INTEGER NOT NULL DEFAULT 5
    CHECK (reorder_threshold >= 0);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS inventory_restored BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE inventory_movements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  movement_type   inventory_movement_type NOT NULL,
  quantity_delta  NUMERIC(10, 2) NOT NULL,
  quantity_after  NUMERIC(10, 2),
  note            TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inventory_movements_product_idx
  ON inventory_movements(product_id, created_at DESC);
CREATE INDEX inventory_movements_store_idx
  ON inventory_movements(store_id, created_at DESC);
CREATE INDEX inventory_movements_order_idx
  ON inventory_movements(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX products_low_stock_idx
  ON products(store_id, stock_status)
  WHERE is_active = true AND stock_status IN ('low_stock', 'out_of_stock');

-- ─── Internal helpers ─────────────────────────────────────
CREATE OR REPLACE FUNCTION assert_store_owner(p_store_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sync_stock_status_from_qty(p_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p products;
BEGIN
  SELECT * INTO p FROM products WHERE id = p_product_id;
  IF NOT FOUND OR p.stock_qty IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('kirana.inventory_bypass', 'on', true);
  UPDATE products
  SET stock_status = CASE
    WHEN stock_qty <= 0 THEN 'out_of_stock'::stock_status
    WHEN stock_qty <= COALESCE(reorder_threshold, 5) THEN 'low_stock'::stock_status
    ELSE 'in_stock'::stock_status
  END,
  updated_at = NOW()
  WHERE id = p_product_id;
  PERFORM set_config('kirana.inventory_bypass', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION apply_product_stock_delta(
  p_product_id UUID,
  p_delta NUMERIC,
  p_movement_type inventory_movement_type,
  p_order_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p products;
  v_after NUMERIC;
BEGIN
  SELECT * INTO p FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  IF p.stock_qty IS NULL THEN
    IF p_delta < 0 AND p_movement_type = 'sale' THEN
      IF p.stock_status = 'out_of_stock' THEN
        RAISE EXCEPTION 'out_of_stock';
      END IF;
    END IF;

    INSERT INTO inventory_movements (
      store_id, product_id, order_id, movement_type,
      quantity_delta, quantity_after, note, created_by
    )
    VALUES (
      p.store_id, p.id, p_order_id, p_movement_type,
      p_delta, NULL, p_note, COALESCE(p_created_by, auth.uid())
    );

    IF p_delta < 0 AND p_movement_type = 'sale' THEN
      PERFORM set_config('kirana.inventory_bypass', 'on', true);
      UPDATE products
      SET stock_status = 'out_of_stock'::stock_status, updated_at = NOW()
      WHERE id = p.id AND p.stock_status <> 'out_of_stock';
      PERFORM set_config('kirana.inventory_bypass', 'off', true);
    ELSIF p_delta > 0 AND p_movement_type = 'cancellation_release' THEN
      PERFORM set_config('kirana.inventory_bypass', 'on', true);
      UPDATE products
      SET stock_status = 'in_stock'::stock_status, updated_at = NOW()
      WHERE id = p.id;
      PERFORM set_config('kirana.inventory_bypass', 'off', true);
    END IF;

    SELECT * INTO p FROM products WHERE id = p_product_id;
    RETURN p;
  END IF;

  v_after := p.stock_qty + p_delta;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'insufficient_stock';
  END IF;

  PERFORM set_config('kirana.inventory_bypass', 'on', true);
  UPDATE products
  SET stock_qty = v_after::integer, updated_at = NOW()
  WHERE id = p_product_id;
  PERFORM set_config('kirana.inventory_bypass', 'off', true);

  PERFORM sync_stock_status_from_qty(p_product_id);

  SELECT * INTO p FROM products WHERE id = p_product_id;

  INSERT INTO inventory_movements (
    store_id, product_id, order_id, movement_type,
    quantity_delta, quantity_after, note, created_by
  )
  VALUES (
    p.store_id, p.id, p_order_id, p_movement_type,
    p_delta, p.stock_qty, p_note, COALESCE(p_created_by, auth.uid())
  );

  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION restore_order_inventory(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o orders;
  line order_items;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.inventory_restored THEN
    RETURN;
  END IF;

  FOR line IN
    SELECT * FROM order_items WHERE order_id = p_order_id
  LOOP
    IF line.product_id IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM inventory_movements
      WHERE order_id = p_order_id
        AND product_id = line.product_id
        AND movement_type = 'sale'
    ) OR EXISTS (
      SELECT 1 FROM products
      WHERE id = line.product_id AND stock_qty IS NOT NULL
    ) THEN
      PERFORM apply_product_stock_delta(
        line.product_id,
        line.quantity,
        'cancellation_release',
        p_order_id,
        'Stock restored — order ' || o.status,
        NULL
      );
    END IF;
  END LOOP;

  UPDATE orders
  SET inventory_restored = true, updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION trg_order_inventory_restore()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'rejected')
     AND OLD.status = 'pending'
     AND NOT NEW.inventory_restored THEN
    PERFORM restore_order_inventory(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_inventory_restore_trg ON orders;
CREATE TRIGGER orders_inventory_restore_trg
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_order_inventory_restore();

CREATE OR REPLACE FUNCTION trg_prevent_direct_stock_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('kirana.inventory_bypass', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.stock_qty IS DISTINCT FROM OLD.stock_qty
    OR NEW.stock_status IS DISTINCT FROM OLD.stock_status
  ) THEN
    RAISE EXCEPTION 'inventory_use_rpc';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_stock_guard_trg ON products;
CREATE TRIGGER products_stock_guard_trg
  BEFORE UPDATE OF stock_qty, stock_status ON products
  FOR EACH ROW
  EXECUTE FUNCTION trg_prevent_direct_stock_edit();

-- ─── Owner-facing RPCs ────────────────────────────────────
CREATE OR REPLACE FUNCTION owner_adjust_stock(
  p_product_id UUID,
  p_delta NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p products;
  v_type inventory_movement_type;
BEGIN
  SELECT * INTO p FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;
  PERFORM assert_store_owner(p.store_id);

  IF p_delta = 0 THEN
    RAISE EXCEPTION 'invalid_delta';
  END IF;

  v_type := CASE WHEN p_delta > 0 THEN 'restock'::inventory_movement_type
            ELSE 'adjustment'::inventory_movement_type END;

  RETURN apply_product_stock_delta(
    p_product_id,
    p_delta,
    v_type,
    NULL,
    COALESCE(NULLIF(trim(p_note), ''), 'Manual stock adjustment'),
    auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION owner_set_stock_qty(
  p_product_id UUID,
  p_new_qty INTEGER,
  p_note TEXT DEFAULT NULL
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p products;
  v_delta NUMERIC;
BEGIN
  IF p_new_qty < 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  SELECT * INTO p FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;
  PERFORM assert_store_owner(p.store_id);

  IF p.stock_qty IS NULL THEN
    PERFORM set_config('kirana.inventory_bypass', 'on', true);
    UPDATE products
    SET stock_qty = p_new_qty, updated_at = NOW()
    WHERE id = p_product_id;
    PERFORM set_config('kirana.inventory_bypass', 'off', true);
    PERFORM sync_stock_status_from_qty(p_product_id);

    INSERT INTO inventory_movements (
      store_id, product_id, movement_type,
      quantity_delta, quantity_after, note, created_by
    )
    VALUES (
      p.store_id, p_product_id, 'restock',
      p_new_qty, p_new_qty,
      COALESCE(NULLIF(trim(p_note), ''), 'Initial stock count'),
      auth.uid()
    );
  ELSE
    v_delta := p_new_qty - p.stock_qty;
    IF v_delta <> 0 THEN
      PERFORM apply_product_stock_delta(
        p_product_id,
        v_delta,
        'adjustment',
        NULL,
        COALESCE(NULLIF(trim(p_note), ''), 'Stock count correction'),
        auth.uid()
      );
    END IF;
  END IF;

  SELECT * INTO p FROM products WHERE id = p_product_id;
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION owner_set_stock_status(
  p_product_id UUID,
  p_status stock_status,
  p_note TEXT DEFAULT NULL
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p products;
BEGIN
  SELECT * INTO p FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;
  PERFORM assert_store_owner(p.store_id);

  PERFORM set_config('kirana.inventory_bypass', 'on', true);
  UPDATE products
  SET stock_status = p_status,
      stock_qty = CASE
        WHEN p_status = 'out_of_stock'::stock_status AND stock_qty IS NOT NULL THEN 0
        ELSE stock_qty
      END,
      updated_at = NOW()
  WHERE id = p_product_id;
  PERFORM set_config('kirana.inventory_bypass', 'off', true);

  INSERT INTO inventory_movements (
    store_id, product_id, movement_type,
    quantity_delta, quantity_after, note, created_by
  )
  VALUES (
    p.store_id, p_product_id, 'status_override',
    0, (SELECT stock_qty FROM products WHERE id = p_product_id),
    COALESCE(NULLIF(trim(p_note), ''), 'Status set to ' || p_status::text),
    auth.uid()
  );

  SELECT * INTO p FROM products WHERE id = p_product_id;
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION owner_set_reorder_threshold(
  p_product_id UUID,
  p_threshold INTEGER
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p products;
BEGIN
  IF p_threshold < 0 THEN
    RAISE EXCEPTION 'invalid_threshold';
  END IF;
  SELECT * INTO p FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;
  PERFORM assert_store_owner(p.store_id);

  UPDATE products
  SET reorder_threshold = p_threshold, updated_at = NOW()
  WHERE id = p_product_id;

  PERFORM sync_stock_status_from_qty(p_product_id);
  SELECT * INTO p FROM products WHERE id = p_product_id;
  RETURN p;
END;
$$;

-- ─── Replace place_order_secure to use movement helper ────
CREATE OR REPLACE FUNCTION place_order_secure(
  p_store_id UUID,
  p_address_id UUID,
  p_payment_method payment_method,
  p_notes TEXT,
  p_items JSONB
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID := auth.uid();
  v_store stores;
  v_addr addresses;
  v_subtotal NUMERIC(10, 2) := 0;
  v_platform_fee NUMERIC(10, 2);
  v_delivery_fee NUMERIC(10, 2);
  v_total NUMERIC(10, 2);
  v_dist DOUBLE PRECISION;
  v_order orders;
  item JSONB;
  v_pid UUID;
  v_qty NUMERIC;
  v_prod products;
  v_acc khata_accounts;
  v_new_balance NUMERIC(10, 2);
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  SELECT * INTO v_store FROM stores WHERE id = p_store_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_found';
  END IF;

  IF NOT v_store.is_online OR v_store.approval_status <> 'approved' THEN
    RAISE EXCEPTION 'store_offline';
  END IF;

  IF NOT is_store_open_at(v_store.opening_hours) THEN
    RAISE EXCEPTION 'store_closed';
  END IF;

  SELECT * INTO v_addr FROM addresses WHERE id = p_address_id AND user_id = v_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'address_not_found';
  END IF;

  v_dist := ST_Distance(v_store.location, v_addr.location);
  IF v_dist > v_store.delivery_radius_m THEN
    RAISE EXCEPTION 'address_not_serviceable';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;

    SELECT * INTO v_prod
    FROM products
    WHERE id = v_pid
      AND store_id = p_store_id
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_product';
    END IF;

    IF v_prod.stock_status = 'out_of_stock' THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;

    IF v_prod.stock_qty IS NOT NULL AND v_prod.stock_qty < v_qty THEN
      RAISE EXCEPTION 'insufficient_stock';
    END IF;

    v_subtotal := v_subtotal + (v_prod.selling_price * v_qty);
  END LOOP;

  v_platform_fee := calculate_platform_fee(v_subtotal);
  v_delivery_fee := calculate_delivery_fee(v_subtotal);
  v_total := v_subtotal + v_platform_fee + v_delivery_fee;

  IF p_payment_method = 'khata' THEN
    SELECT * INTO v_acc
    FROM khata_accounts
    WHERE store_id = p_store_id
      AND customer_id = v_customer_id
      AND is_enabled = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'khata_not_enabled';
    END IF;

    IF v_acc.balance + v_total > v_acc.credit_limit THEN
      RAISE EXCEPTION 'khata_limit_exceeded';
    END IF;
  END IF;

  INSERT INTO orders (
    store_id,
    customer_id,
    address_id,
    status,
    payment_method,
    payment_status,
    subtotal,
    delivery_fee,
    platform_fee,
    discount_total,
    total,
    notes,
    order_number,
    inventory_restored
  )
  VALUES (
    p_store_id,
    v_customer_id,
    p_address_id,
    'pending',
    p_payment_method,
    'pending',
    v_subtotal,
    v_delivery_fee,
    v_platform_fee,
    0,
    v_total,
    NULLIF(trim(p_notes), ''),
    '',
    false
  )
  RETURNING * INTO v_order;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::numeric;

    SELECT * INTO v_prod FROM products WHERE id = v_pid FOR UPDATE;

    PERFORM apply_product_stock_delta(
      v_pid,
      -v_qty,
      'sale',
      v_order.id,
      'Order ' || v_order.order_number,
      v_customer_id
    );

    SELECT * INTO v_prod FROM products WHERE id = v_pid;

    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      unit,
      quantity,
      mrp,
      selling_price,
      line_total
    )
    VALUES (
      v_order.id,
      v_prod.id,
      v_prod.name,
      v_prod.unit,
      v_qty,
      v_prod.mrp,
      v_prod.selling_price,
      v_prod.selling_price * v_qty
    );
  END LOOP;

  IF p_payment_method = 'khata' THEN
    v_new_balance := v_acc.balance + v_total;
    UPDATE khata_accounts
    SET balance = v_new_balance, updated_at = NOW()
    WHERE id = v_acc.id;

    INSERT INTO khata_ledger (
      account_id,
      entry_type,
      amount,
      balance_after,
      order_id,
      note
    )
    VALUES (
      v_acc.id,
      'debit',
      v_total,
      v_new_balance,
      v_order.id,
      'Order charged to khata'
    );
  END IF;

  RETURN v_order;
END;
$$;

-- Update preview to use reorder_threshold for low stock hint (logic unchanged for qty check)
CREATE OR REPLACE FUNCTION preview_order_totals(
  p_store_id UUID,
  p_address_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID := auth.uid();
  v_store stores;
  v_addr addresses;
  v_subtotal NUMERIC(10, 2) := 0;
  v_platform_fee NUMERIC(10, 2);
  v_delivery_fee NUMERIC(10, 2);
  v_total NUMERIC(10, 2);
  v_dist DOUBLE PRECISION;
  item JSONB;
  v_pid UUID;
  v_qty NUMERIC;
  v_prod products;
BEGIN
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_cart');
  END IF;

  SELECT * INTO v_store FROM stores WHERE id = p_store_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_found');
  END IF;

  SELECT * INTO v_addr FROM addresses WHERE id = p_address_id AND user_id = v_customer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'address_not_found');
  END IF;

  v_dist := ST_Distance(v_store.location, v_addr.location);

  IF NOT v_store.is_online OR v_store.approval_status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_offline', 'distance_m', v_dist);
  END IF;

  IF v_dist > v_store.delivery_radius_m THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'address_not_serviceable',
      'distance_m', v_dist,
      'radius_m', v_store.delivery_radius_m
    );
  END IF;

  IF NOT is_store_open_at(v_store.opening_hours) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_closed');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_quantity');
    END IF;

    SELECT * INTO v_prod
    FROM products
    WHERE id = v_pid
      AND store_id = p_store_id
      AND is_active = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_product', 'product_id', v_pid);
    END IF;

    IF v_prod.stock_status = 'out_of_stock' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'out_of_stock', 'product_id', v_pid);
    END IF;

    IF v_prod.stock_qty IS NOT NULL AND v_prod.stock_qty < v_qty THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'insufficient_stock',
        'product_id', v_pid,
        'available', v_prod.stock_qty
      );
    END IF;

    v_subtotal := v_subtotal + (v_prod.selling_price * v_qty);
  END LOOP;

  v_platform_fee := calculate_platform_fee(v_subtotal);
  v_delivery_fee := calculate_delivery_fee(v_subtotal);
  v_total := v_subtotal + v_platform_fee + v_delivery_fee;

  RETURN jsonb_build_object(
    'ok', true,
    'subtotal', v_subtotal,
    'platform_fee', v_platform_fee,
    'delivery_fee', v_delivery_fee,
    'total', v_total,
    'distance_m', v_dist
  );
END;
$$;

GRANT EXECUTE ON FUNCTION owner_adjust_stock TO authenticated;
GRANT EXECUTE ON FUNCTION owner_set_stock_qty TO authenticated;
GRANT EXECUTE ON FUNCTION owner_set_stock_status TO authenticated;
GRANT EXECUTE ON FUNCTION owner_set_reorder_threshold TO authenticated;
