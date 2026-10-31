-- UPI payment window (5 minutes from order time)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;

-- Backfill: UPI orders still pending get 5 min from created_at (or now if already old)
UPDATE orders
SET payment_expires_at = created_at + interval '5 minutes'
WHERE payment_method = 'upi'
  AND payment_expires_at IS NULL;
