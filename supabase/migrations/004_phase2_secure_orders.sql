-- Phase 2: platform fee rules, store approval, secure order placement

CREATE TYPE store_approval_status AS ENUM ('pending', 'approved', 'suspended', 'rejected');

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS approval_status store_approval_status NOT NULL DEFAULT 'approved';

COMMENT ON COLUMN stores.platform_fee IS 'Deprecated: use platform_fee_rules. Kept for legacy rows.';

-- ─── Platform fee configuration ───────────────────────────
CREATE TABLE platform_fee_rules (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label               TEXT NOT NULL DEFAULT 'default',
  threshold_subtotal  NUMERIC(10, 2) NOT NULL DEFAULT 100
                      CHECK (threshold_subtotal >= 0),
  fee_amount          NUMERIC(10, 2) NOT NULL DEFAULT 5
                      CHECK (fee_amount >= 0),
  delivery_fee        NUMERIC(10, 2) NOT NULL DEFAULT 0
                      CHECK (delivery_fee >= 0),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX platform_fee_rules_single_active
  ON platform_fee_rules ((true))
  WHERE is_active = true;

CREATE TRIGGER platform_fee_rules_updated
  BEFORE UPDATE ON platform_fee_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO platform_fee_rules (label, threshold_subtotal, fee_amount, delivery_fee, is_active)
VALUES ('default', 100, 5, 0, true);

ALTER TABLE platform_fee_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active fee rules"
  ON platform_fee_rules FOR SELECT TO authenticated
  USING (is_active = true);

-- ─── Fee calculation (subtotal after item discounts = sum of selling_price * qty) ───
CREATE OR REPLACE FUNCTION get_active_fee_rule()
RETURNS platform_fee_rules
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM platform_fee_rules
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION calculate_platform_fee(p_subtotal NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule platform_fee_rules;
BEGIN
  IF p_subtotal IS NULL OR p_subtotal < 0 THEN
    RETURN 0;
  END IF;
  rule := get_active_fee_rule();
  IF rule IS NULL THEN
    RETURN 0;
  END IF;
  IF p_subtotal > rule.threshold_subtotal THEN
    RETURN rule.fee_amount;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_delivery_fee(p_subtotal NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule platform_fee_rules;
BEGIN
  rule := get_active_fee_rule();
  IF rule IS NULL THEN
    RETURN 0;
  END IF;
  RETURN COALESCE(rule.delivery_fee, 0);
END;
$$;

-- ─── Opening hours (Asia/Kolkata) ─────────────────────────
CREATE OR REPLACE FUNCTION is_store_open_at(
  p_hours JSONB,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  day_key TEXT;
  day JSONB;
  open_t TIME;
  close_t TIME;
  local_ts TIMESTAMP;
  local_time TIME;
BEGIN
  IF p_hours IS NULL THEN
    RETURN true;
  END IF;

  local_ts := (p_at AT TIME ZONE 'Asia/Kolkata')::timestamp;
  day_key := CASE EXTRACT(ISODOW FROM local_ts)::int
    WHEN 1 THEN 'mon'
    WHEN 2 THEN 'tue'
    WHEN 3 THEN 'wed'
    WHEN 4 THEN 'thu'
    WHEN 5 THEN 'fri'
    WHEN 6 THEN 'sat'
    WHEN 7 THEN 'sun'
  END;

  day := p_hours -> day_key;
  IF day IS NULL OR COALESCE((day ->> 'closed')::boolean, false) THEN
    RETURN false;
  END IF;

  open_t := (day ->> 'open')::time;
  close_t := (day ->> 'close')::time;
  local_time := local_ts::time;

  IF open_t IS NULL OR close_t IS NULL THEN
    RETURN true;
  END IF;

  IF close_t >= open_t THEN
    RETURN local_time >= open_t AND local_time <= close_t;
  END IF;
  -- Overnight window (e.g. 22:00–02:00)
  RETURN local_time >= open_t OR local_time <= close_t;
END;
$$;

-- ─── Preview totals (checkout UI) ─────────────────────────
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

  v_dist := ST_Distance(
    v_store.location,
    v_addr.location
  );

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
      AND is_active = true
    FOR SHARE;

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

-- ─── Secure order placement ───────────────────────────────
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

    IF v_prod.stock_qty IS NOT NULL THEN
      IF v_prod.stock_qty < v_qty THEN
        RAISE EXCEPTION 'insufficient_stock';
      END IF;
      UPDATE products
      SET
        stock_qty = stock_qty - v_qty,
        stock_status = CASE
          WHEN stock_qty - v_qty <= 0 THEN 'out_of_stock'::stock_status
          WHEN stock_qty - v_qty <= 5 THEN 'low_stock'::stock_status
          ELSE stock_status
        END,
        updated_at = NOW()
      WHERE id = v_prod.id;
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
    order_number
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
    ''
  )
  RETURNING * INTO v_order;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::numeric;

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

GRANT EXECUTE ON FUNCTION preview_order_totals TO authenticated;
GRANT EXECUTE ON FUNCTION place_order_secure TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_platform_fee TO authenticated;
