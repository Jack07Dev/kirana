-- Phase 5: delivery partners, assignments, OTP, extended order statuses, status history

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'delivery_partner';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'packed';

CREATE TABLE delivery_partners (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  display_name  TEXT NOT NULL,
  phone         TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, phone)
);

CREATE INDEX delivery_partners_store_idx ON delivery_partners(store_id);
CREATE INDEX delivery_partners_user_idx ON delivery_partners(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE delivery_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  partner_id      UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE RESTRICT,
  delivery_otp    TEXT NOT NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  picked_up_at    TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  otp_verified_at TIMESTAMPTZ,
  failed_reason   TEXT
);

CREATE INDEX delivery_assignments_partner_idx
  ON delivery_assignments(partner_id, assigned_at DESC);

CREATE TABLE order_status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status   order_status NOT NULL,
  note        TEXT,
  changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_status_history_order_idx
  ON order_status_history(order_id, created_at ASC);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_history_trg ON orders;
CREATE TRIGGER orders_status_history_trg
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

CREATE OR REPLACE FUNCTION assert_order_owner(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
BEGIN
  SELECT store_id INTO v_store_id FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM stores WHERE id = v_store_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN v_store_id;
END;
$$;

CREATE OR REPLACE FUNCTION owner_update_order_status(
  p_order_id UUID,
  p_status order_status,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o orders;
  v_new order_status;
BEGIN
  PERFORM assert_order_owner(p_order_id);

  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  v_new := p_status;

  IF o.status = 'pending' AND v_new IN ('accepted', 'rejected', 'cancelled') THEN
    NULL;
  ELSIF o.status = 'accepted' AND v_new IN ('preparing', 'cancelled') THEN
    NULL;
  ELSIF o.status = 'preparing' AND v_new IN ('packed', 'cancelled') THEN
    NULL;
  ELSIF o.status = 'packed' AND v_new = 'cancelled' THEN
    NULL;
  ELSIF o.status = 'out_for_delivery' AND v_new = 'delivered' THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'invalid_status_transition';
  END IF;

  UPDATE orders
  SET
    status = v_new,
    rejection_reason = CASE WHEN v_new = 'rejected' THEN COALESCE(p_rejection_reason, rejection_reason) ELSE rejection_reason END,
    accepted_at = CASE WHEN v_new = 'accepted' THEN COALESCE(accepted_at, NOW()) ELSE accepted_at END,
    preparing_at = CASE WHEN v_new = 'preparing' THEN COALESCE(preparing_at, NOW()) ELSE preparing_at END,
    packed_at = CASE WHEN v_new = 'packed' THEN COALESCE(packed_at, NOW()) ELSE packed_at END,
    out_for_delivery_at = CASE WHEN v_new = 'out_for_delivery' THEN COALESCE(out_for_delivery_at, NOW()) ELSE out_for_delivery_at END,
    delivered_at = CASE WHEN v_new = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
    payment_status = CASE
      WHEN v_new = 'delivered' AND payment_method = 'cod' THEN 'paid'::payment_status
      ELSE payment_status
    END,
    updated_at = NOW()
  WHERE id = p_order_id
  RETURNING * INTO o;

  RETURN o;
END;
$$;

CREATE OR REPLACE FUNCTION assign_order_delivery(
  p_order_id UUID,
  p_partner_id UUID
)
RETURNS delivery_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o orders;
  p delivery_partners;
  a delivery_assignments;
  v_otp TEXT;
BEGIN
  PERFORM assert_order_owner(p_order_id);

  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF o.status NOT IN ('packed', 'accepted') THEN
    RAISE EXCEPTION 'order_not_ready_for_delivery';
  END IF;

  SELECT * INTO p FROM delivery_partners
  WHERE id = p_partner_id AND store_id = o.store_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner_not_found';
  END IF;

  v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  INSERT INTO delivery_assignments (order_id, partner_id, delivery_otp)
  VALUES (p_order_id, p_partner_id, v_otp)
  ON CONFLICT (order_id) DO UPDATE
  SET partner_id = EXCLUDED.partner_id,
      delivery_otp = EXCLUDED.delivery_otp,
      assigned_at = NOW(),
      picked_up_at = NULL,
      delivered_at = NULL,
      otp_verified_at = NULL,
      failed_reason = NULL
  RETURNING * INTO a;

  UPDATE orders
  SET
    status = 'out_for_delivery',
    out_for_delivery_at = COALESCE(out_for_delivery_at, NOW()),
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN a;
END;
$$;

CREATE OR REPLACE FUNCTION partner_mark_picked_up(p_order_id UUID)
RETURNS delivery_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a delivery_assignments;
BEGIN
  SELECT da.* INTO a
  FROM delivery_assignments da
  JOIN delivery_partners dp ON dp.id = da.partner_id
  WHERE da.order_id = p_order_id
    AND dp.user_id = auth.uid()
    AND dp.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE delivery_assignments
  SET picked_up_at = COALESCE(picked_up_at, NOW())
  WHERE id = a.id
  RETURNING * INTO a;

  RETURN a;
END;
$$;

CREATE OR REPLACE FUNCTION partner_verify_delivery(
  p_order_id UUID,
  p_otp TEXT
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a delivery_assignments;
  o orders;
  v_token TEXT;
BEGIN
  v_token := regexp_replace(COALESCE(p_otp, ''), '\D', '', 'g');
  IF length(v_token) <> 6 THEN
    RAISE EXCEPTION 'invalid_otp';
  END IF;

  SELECT da.* INTO a
  FROM delivery_assignments da
  JOIN delivery_partners dp ON dp.id = da.partner_id
  WHERE da.order_id = p_order_id
    AND dp.user_id = auth.uid()
    AND dp.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF a.delivery_otp <> v_token THEN
    RAISE EXCEPTION 'invalid_otp';
  END IF;

  UPDATE delivery_assignments
  SET
    otp_verified_at = NOW(),
    delivered_at = NOW()
  WHERE id = a.id;

  UPDATE orders
  SET
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = CASE WHEN payment_method = 'cod' THEN 'paid'::payment_status ELSE payment_status END,
    updated_at = NOW()
  WHERE id = p_order_id
  RETURNING * INTO o;

  RETURN o;
END;
$$;

CREATE OR REPLACE FUNCTION owner_register_delivery_partner(
  p_phone TEXT,
  p_display_name TEXT
)
RETURNS delivery_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store stores;
  v_user users;
  v_phone TEXT;
  p delivery_partners;
BEGIN
  SELECT * INTO v_store FROM stores WHERE owner_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_found';
  END IF;

  v_phone := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_phone) = 10 THEN
    v_phone := '+91' || v_phone;
  ELSIF length(v_phone) = 12 AND v_phone LIKE '91%' THEN
    v_phone := '+' || v_phone;
  ELSIF NOT v_phone LIKE '+%' THEN
    v_phone := '+91' || v_phone;
  END IF;

  SELECT * INTO v_user FROM users WHERE phone = v_phone;

  INSERT INTO delivery_partners (store_id, user_id, display_name, phone)
  VALUES (
    v_store.id,
    v_user.id,
    trim(p_display_name),
    v_phone
  )
  ON CONFLICT (store_id, phone) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    user_id = COALESCE(EXCLUDED.user_id, delivery_partners.user_id),
    is_active = true
  RETURNING * INTO p;

  IF v_user.id IS NOT NULL THEN
    UPDATE users SET role = 'delivery_partner' WHERE id = v_user.id AND role IS NULL;
  END IF;

  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION link_delivery_partner_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE delivery_partners dp
  SET user_id = auth.uid()
  FROM users u
  WHERE u.id = auth.uid()
    AND dp.phone = u.phone
    AND dp.user_id IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION owner_update_order_status TO authenticated;
GRANT EXECUTE ON FUNCTION assign_order_delivery TO authenticated;
GRANT EXECUTE ON FUNCTION partner_mark_picked_up TO authenticated;
GRANT EXECUTE ON FUNCTION partner_verify_delivery TO authenticated;
GRANT EXECUTE ON FUNCTION owner_register_delivery_partner TO authenticated;
GRANT EXECUTE ON FUNCTION link_delivery_partner_user TO authenticated;
