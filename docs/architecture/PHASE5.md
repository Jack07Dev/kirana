# Phase 5 — Delivery partners & lifecycle

## Database (`008` + `009`)

Run in Supabase SQL Editor after Phase 3 migrations:

- `supabase/migrations/008_phase5_delivery.sql` — `delivery_partners`, `delivery_assignments`, `order_status_history`, status RPCs, delivery OTP on assign
- `supabase/migrations/009_phase5_delivery_rls.sql` — RLS for new tables

## Order flow

1. **Owner:** pending → accept/reject  
2. **Owner:** accepted → **preparing** (optional) → **packed**, or assign directly from **accepted**  
3. **Owner:** assign partner → order becomes **out_for_delivery**, 6-digit OTP stored on assignment  
4. **Customer:** sees delivery code on order detail while out for delivery  
5. **Partner:** picked up → enter customer OTP → **delivered** (COD marked paid)

## App surfaces

| Role | Where |
|------|--------|
| Owner | Store tab → **Delivery staff**; order detail → status + assign |
| Partner | Role **I deliver orders** → Deliveries tab → order → OTP |
| Customer | Order detail → code + timeline |

Partners must be registered by the store owner (phone). On first login with that phone, choose delivery role; `link_delivery_partner_user` binds the auth user.

## Verify

1. Apply `008` and `009` on your project.  
2. Owner: add a partner phone, accept an order, assign partner.  
3. Customer: open order — see 6-digit code.  
4. Partner: log in as that phone → delivery role → pick up → enter code → delivered.

## Next

Phase 6 — payments, admin, production OTP/SMS.
