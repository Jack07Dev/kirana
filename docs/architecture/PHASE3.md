# Phase 3 — Product & inventory management

## Database (migrations 006–007)

- **`inventory_movements`** — Audit trail: sale, restock, adjustment, cancellation_release, status_override.
- **`products.reorder_threshold`** — Default 5; drives `low_stock` vs `in_stock` when `stock_qty` is tracked.
- **`orders.inventory_restored`** — Idempotent flag for cancel/reject restore.
- **Trigger `products_stock_guard_trg`** — Blocks direct client updates to `stock_qty` / `stock_status`; use owner RPCs.
- **Trigger `orders_inventory_restore_trg`** — On `pending` → `cancelled` / `rejected`, restores stock via movements.
- **RPCs:** `owner_adjust_stock`, `owner_set_stock_qty`, `owner_set_stock_status`, `owner_set_reorder_threshold`.
- **`place_order_secure`** — Records **sale** movements and uses shared `apply_product_stock_delta`.

## App

- **Product form:** stock quantity, reorder threshold, quick +/- adjustment, link to movement history.
- **Owner dashboard:** low / out-of-stock count and short list.
- **Products list:** shows tracked quantity; status toggle uses `owner_set_stock_status`.
- **Customer order detail:** cancel pending order (triggers stock restore).

## Apply

Run after Phase 2 migrations:

1. `supabase/migrations/006_phase3_inventory.sql`
2. `supabase/migrations/007_phase3_inventory_rls.sql`

## Verify

1. Set product stock **10**, threshold **5** → status **in stock**.
2. Place order qty **6** → qty **4**, status **low_stock**; movement **sale −6**.
3. Cancel pending order → qty **10** again; movement **cancellation_release +6**.
4. Direct SQL/client update to `products.stock_qty` should error with `inventory_use_rpc`.

## Not in this phase

- Server-side cart reservations (checkout still uses row locks at place order).
- Bulk stock import with movement logging (CSV still inserts products only).
