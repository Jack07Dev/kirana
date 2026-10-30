-- Kirana Store Ordering Platform — Initial Schema
-- Extensible store_type for future sabzi / medical / restaurant

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enums
CREATE TYPE user_role AS ENUM ('customer', 'store_owner');
CREATE TYPE store_type AS ENUM ('kirana', 'sabzi', 'medical', 'restaurant', 'other');
CREATE TYPE stock_status AS ENUM ('in_stock', 'out_of_stock', 'low_stock');
CREATE TYPE order_status AS ENUM (
  'pending', 'accepted', 'rejected',
  'out_for_delivery', 'delivered', 'cancelled'
);
CREATE TYPE payment_method AS ENUM ('cod', 'upi', 'khata');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE khata_entry_type AS ENUM ('debit', 'credit', 'adjustment');
CREATE TYPE reminder_cycle AS ENUM ('weekly', 'monthly', 'none');

-- ─── USERS ───────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone         TEXT UNIQUE NOT NULL,
  full_name     TEXT,
  role          user_role,
  avatar_url    TEXT,
  preferred_lang TEXT NOT NULL DEFAULT 'hi', -- 'hi' | 'en'
  push_token    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── STORES ──────────────────────────────────────────────
CREATE TABLE stores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  store_type      store_type NOT NULL DEFAULT 'kirana',
  description     TEXT,
  address_line    TEXT NOT NULL,
  city            TEXT,
  pincode         TEXT,
  location        GEOGRAPHY(POINT, 4326) NOT NULL,
  photo_url       TEXT,
  opening_hours   JSONB NOT NULL DEFAULT '{
    "mon":{"open":"08:00","close":"21:00"},
    "tue":{"open":"08:00","close":"21:00"},
    "wed":{"open":"08:00","close":"21:00"},
    "thu":{"open":"08:00","close":"21:00"},
    "fri":{"open":"08:00","close":"21:00"},
    "sat":{"open":"08:00","close":"21:00"},
    "sun":{"open":"09:00","close":"20:00"}
  }'::jsonb,
  delivery_radius_m INTEGER NOT NULL DEFAULT 500
                      CHECK (delivery_radius_m BETWEEN 50 AND 2000),
  is_online       BOOLEAN NOT NULL DEFAULT false,
  upi_id          TEXT,
  platform_fee    NUMERIC(10,2) NOT NULL DEFAULT 0, -- future use
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stores_location_idx ON stores USING GIST (location);
CREATE INDEX stores_owner_idx ON stores(owner_id);
CREATE INDEX stores_online_idx ON stores(is_online) WHERE is_online = true;

-- ─── CATALOG (pre-built FMCG items) ──────────────────────
CREATE TABLE catalog (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en       TEXT NOT NULL,
  name_hi       TEXT NOT NULL,
  brand         TEXT,
  category      TEXT NOT NULL, -- e.g. dairy, snacks, staples
  unit          TEXT NOT NULL DEFAULT 'pcs', -- pcs, kg, g, L, ml, pack
  default_mrp   NUMERIC(10,2),
  barcode       TEXT,
  image_url     TEXT,
  store_types   store_type[] NOT NULL DEFAULT ARRAY['kirana']::store_type[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX catalog_barcode_idx ON catalog(barcode);
CREATE INDEX catalog_category_idx ON catalog(category);
CREATE INDEX catalog_name_en_idx ON catalog USING GIN (to_tsvector('english', name_en));

-- ─── PRODUCTS (store inventory) ──────────────────────────
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  catalog_id      UUID REFERENCES catalog(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  name_hi         TEXT,
  brand           TEXT,
  category        TEXT,
  photo_url       TEXT,
  barcode         TEXT,
  unit            TEXT NOT NULL DEFAULT 'pcs',
  mrp             NUMERIC(10,2) NOT NULL,
  selling_price   NUMERIC(10,2) NOT NULL,
  discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  stock_status    stock_status NOT NULL DEFAULT 'in_stock',
  stock_qty       INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (selling_price <= mrp OR discount_pct = 0)
);

CREATE INDEX products_store_idx ON products(store_id);
CREATE INDEX products_barcode_idx ON products(barcode);
CREATE INDEX products_active_idx ON products(store_id, is_active) WHERE is_active = true;

-- ─── ADDRESSES (customer) ────────────────────────────────
CREATE TABLE addresses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           TEXT NOT NULL DEFAULT 'Home', -- Home, Work, Other
  house_no        TEXT NOT NULL,
  landmark        TEXT,
  address_line    TEXT NOT NULL,
  contact_phone   TEXT NOT NULL,
  location        GEOGRAPHY(POINT, 4326) NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX addresses_user_idx ON addresses(user_id);
CREATE INDEX addresses_location_idx ON addresses USING GIST (location);

-- ─── FAVOURITE STORES ────────────────────────────────────
CREATE TABLE favourite_stores (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id  UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, store_id)
);

-- ─── ORDERS ──────────────────────────────────────────────
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number      TEXT UNIQUE NOT NULL,
  store_id          UUID NOT NULL REFERENCES stores(id),
  customer_id       UUID NOT NULL REFERENCES users(id),
  address_id        UUID NOT NULL REFERENCES addresses(id),
  status            order_status NOT NULL DEFAULT 'pending',
  payment_method    payment_method NOT NULL,
  payment_status    payment_status NOT NULL DEFAULT 'pending',
  subtotal          NUMERIC(10,2) NOT NULL,
  delivery_fee      NUMERIC(10,2) NOT NULL DEFAULT 0, -- always 0 for MVP
  platform_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_total    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL,
  notes             TEXT,
  rejection_reason  TEXT,
  accepted_at       TIMESTAMPTZ,
  out_for_delivery_at TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_store_idx ON orders(store_id, created_at DESC);
CREATE INDEX orders_customer_idx ON orders(customer_id, created_at DESC);
CREATE INDEX orders_status_idx ON orders(store_id, status);

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name    TEXT NOT NULL, -- snapshot
  unit            TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL,
  mrp             NUMERIC(10,2) NOT NULL,
  selling_price   NUMERIC(10,2) NOT NULL,
  line_total      NUMERIC(10,2) NOT NULL
);

CREATE INDEX order_items_order_idx ON order_items(order_id);

-- ─── KHATA (credit ledger) ───────────────────────────────
CREATE TABLE khata_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credit_limit    NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance         NUMERIC(10,2) NOT NULL DEFAULT 0, -- positive = customer owes
  is_enabled      BOOLEAN NOT NULL DEFAULT false,
  reminder_cycle  reminder_cycle NOT NULL DEFAULT 'monthly',
  last_reminder_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, customer_id)
);

CREATE INDEX khata_store_idx ON khata_accounts(store_id);
CREATE INDEX khata_customer_idx ON khata_accounts(customer_id);

CREATE TABLE khata_ledger (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      UUID NOT NULL REFERENCES khata_accounts(id) ON DELETE CASCADE,
  entry_type      khata_entry_type NOT NULL,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  balance_after   NUMERIC(10,2) NOT NULL,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  payment_id      UUID, -- filled after payments table
  note            TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX khata_ledger_account_idx ON khata_ledger(account_id, created_at DESC);

-- ─── PAYMENTS ────────────────────────────────────────────
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  khata_account_id UUID REFERENCES khata_accounts(id) ON DELETE SET NULL,
  store_id        UUID NOT NULL REFERENCES stores(id),
  customer_id     UUID NOT NULL REFERENCES users(id),
  amount          NUMERIC(10,2) NOT NULL,
  method          payment_method NOT NULL,
  status          payment_status NOT NULL DEFAULT 'pending',
  upi_txn_id      TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payments_store_idx ON payments(store_id, created_at DESC);
CREATE INDEX payments_customer_idx ON payments(customer_id, created_at DESC);

-- Back-fill FK on khata_ledger.payment_id
ALTER TABLE khata_ledger
  ADD CONSTRAINT khata_ledger_payment_fk
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- ─── HELPER: haversine / nearby stores ───────────────────
CREATE OR REPLACE FUNCTION nearby_stores(
  customer_lat DOUBLE PRECISION,
  customer_lng DOUBLE PRECISION,
  max_results  INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  store_type store_type,
  address_line TEXT,
  photo_url TEXT,
  is_online BOOLEAN,
  delivery_radius_m INTEGER,
  distance_m DOUBLE PRECISION,
  opening_hours JSONB
) AS $$
  SELECT
    s.id,
    s.name,
    s.store_type,
    s.address_line,
    s.photo_url,
    s.is_online,
    s.delivery_radius_m,
    ST_Distance(
      s.location,
      ST_SetSRID(ST_MakePoint(customer_lng, customer_lat), 4326)::geography
    ) AS distance_m,
    s.opening_hours
  FROM stores s
  WHERE s.is_online = true
    AND ST_DWithin(
      s.location,
      ST_SetSRID(ST_MakePoint(customer_lng, customer_lat), 4326)::geography,
      s.delivery_radius_m
    )
  ORDER BY distance_m
  LIMIT max_results;
$$ LANGUAGE sql STABLE;

-- Order number generator
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'KR' || TO_CHAR(NOW(), 'YYMMDD') ||
                      LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_number_trg
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_order_number();

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER stores_updated BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER khata_accounts_updated BEFORE UPDATE ON khata_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
