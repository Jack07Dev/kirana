-- Platform fee rule tests (run in Supabase SQL editor after migration 004)
-- Expected: ₹100 and below → ₹0 fee; above ₹100 → ₹5 fee

DO $$
DECLARE
  fee NUMERIC;
BEGIN
  fee := calculate_platform_fee(99);
  IF fee <> 0 THEN
    RAISE EXCEPTION 'FAIL: subtotal 99 should have 0 fee, got %', fee;
  END IF;

  fee := calculate_platform_fee(100);
  IF fee <> 0 THEN
    RAISE EXCEPTION 'FAIL: subtotal 100 should have 0 fee, got %', fee;
  END IF;

  fee := calculate_platform_fee(100.01);
  IF fee <> 5 THEN
    RAISE EXCEPTION 'FAIL: subtotal 100.01 should have 5 fee, got %', fee;
  END IF;

  fee := calculate_platform_fee(350);
  IF fee <> 5 THEN
    RAISE EXCEPTION 'FAIL: subtotal 350 should have 5 fee, got %', fee;
  END IF;

  RAISE NOTICE 'PASS: platform fee boundary tests';
END $$;
