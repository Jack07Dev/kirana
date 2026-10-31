-- Store UPI QR image + customer "I paid" tracking

ALTER TABLE stores ADD COLUMN IF NOT EXISTS upi_qr_url TEXT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_claimed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE POLICY "Customers claim upi payment"
  ON orders FOR UPDATE
  USING (
    customer_id = auth.uid()
    AND payment_method = 'upi'
    AND payment_status = 'pending'
  )
  WITH CHECK (
    customer_id = auth.uid()
    AND payment_method = 'upi'
    AND payment_status = 'pending'
  );
