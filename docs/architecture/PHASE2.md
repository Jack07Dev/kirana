# Phase 2 — Core foundation (secure orders & platform fees)

## What changed

### Database (migrations 004–005)

- **`platform_fee_rules`** — Active rule defaults to **₹5 fee when product subtotal > ₹100**, **₹0 delivery fee**.
- **`stores.approval_status`** — `pending | approved | suspended | rejected` (existing stores default **approved**).
- **`calculate_platform_fee(subtotal)`** — Server-side fee from active rule.
- **`preview_order_totals(store, address, items)`** — Validates serviceability, hours, stock; returns subtotal/fees (no write).
- **`place_order_secure(...)`** — Single transaction: validate → lock products → decrement optional `stock_qty` → insert order/lines → khata debit if needed.
- **RLS** — Customers can no longer `INSERT` into `orders` / `order_items` directly; only `place_order_secure`.
- **Products** — Active catalog visible only for **online + approved** stores (owners still see their own).

### App

- Checkout uses **`preview_order_totals`** for displayed totals and **`place_order_secure`** on place order.
- Platform fee is **not** read from `stores.platform_fee` (column kept for legacy).

## Apply migrations

In Supabase SQL Editor (in order):

1. `supabase/migrations/004_phase2_secure_orders.sql`
2. `supabase/migrations/005_phase2_rls_hardening.sql`

Or via CLI: `npx supabase db push` (linked project).

## Verify

1. Run `supabase/tests/platform_fee_rules.sql` in SQL editor → `PASS: platform fee boundary tests`.
2. Owner: store **online**, products in stock, customer address within radius.
3. Customer checkout: cart **₹99** → platform fee **₹0**; **₹101** → **₹5**; total includes fee.
4. Attempt order with address outside radius → blocked with serviceability error.
5. Direct insert (SQL as authenticated user) into `orders` should **fail** RLS.

## Security notes

- Order prices and fees are computed in Postgres; client sends only `product_id` + `quantity`.
- Khata limit enforced on server (`balance + total <= credit_limit`).
- Fee rule writes require service role (future admin panel).

## Pending (later phases)

- Paise integers, payment webhooks, admin UI for fee rules & store approval.
- Owner status updates via secured RPC (delivered → paid still client-side for MVP).
