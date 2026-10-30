-- Row Level Security policies

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE favourite_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE khata_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE khata_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Store owners can read their customers"
  ON users FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.customer_id = users.id
        AND o.store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM khata_accounts k
      WHERE k.customer_id = users.id
        AND k.store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    )
  );

-- STORES
CREATE POLICY "Anyone authenticated can view online stores"
  ON stores FOR SELECT USING (
    is_online = true OR owner_id = auth.uid()
  );

CREATE POLICY "Owners can insert their store"
  ON stores FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their store"
  ON stores FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their store"
  ON stores FOR DELETE USING (owner_id = auth.uid());

-- CATALOG (public read for authenticated)
CREATE POLICY "Authenticated can read catalog"
  ON catalog FOR SELECT TO authenticated USING (true);

-- PRODUCTS
CREATE POLICY "Anyone can view active products of visible stores"
  ON products FOR SELECT USING (
    is_active = true
    OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners can manage products"
  ON products FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- ADDRESSES
CREATE POLICY "Users manage own addresses"
  ON addresses FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Store owners can read order addresses"
  ON addresses FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.address_id = addresses.id
        AND o.store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    )
  );

-- FAVOURITES
CREATE POLICY "Users manage own favourites"
  ON favourite_stores FOR ALL USING (user_id = auth.uid());

-- ORDERS
CREATE POLICY "Customers see own orders"
  ON orders FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Store owners see store orders"
  ON orders FOR SELECT USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "Customers can create orders"
  ON orders FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can cancel pending orders"
  ON orders FOR UPDATE USING (
    customer_id = auth.uid() AND status = 'pending'
  );

CREATE POLICY "Owners can update order status"
  ON orders FOR UPDATE USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- ORDER ITEMS
CREATE POLICY "Order items visible with parent order"
  ON order_items FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders
      WHERE customer_id = auth.uid()
         OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "Customers insert order items"
  ON order_items FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );

-- KHATA ACCOUNTS
CREATE POLICY "Customers see own khata"
  ON khata_accounts FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Owners manage store khata"
  ON khata_accounts FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- KHATA LEDGER
CREATE POLICY "Khata ledger via account access"
  ON khata_ledger FOR SELECT USING (
    account_id IN (
      SELECT id FROM khata_accounts
      WHERE customer_id = auth.uid()
         OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "Owners insert ledger entries"
  ON khata_ledger FOR INSERT WITH CHECK (
    account_id IN (
      SELECT id FROM khata_accounts
      WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    )
  );

-- PAYMENTS
CREATE POLICY "Users see own payments"
  ON payments FOR SELECT USING (
    customer_id = auth.uid()
    OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "Customers create payments"
  ON payments FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Owners create/update payments"
  ON payments FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- Realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
