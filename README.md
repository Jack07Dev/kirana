# Kirana — hyperlocal store ordering (MVP)

React Native (Expo SDK 58) + Supabase backend. Connects nearby kirana stores with customers inside the store’s delivery radius. **₹0 delivery fee**, **no commission on product sales**. Platform fee: **₹5 when order subtotal exceeds ₹100** (configurable in `platform_fee_rules`, enforced server-side). Store staff delivers; customers pay product price + platform fee (COD / UPI / Khata).

## Folder structure

```
app/                    # Expo Router screens
  (auth)/               # Phone OTP, role selection
  (owner)/              # Store setup, products, orders, khata, dashboard
  (customer)/           # Home, store browse, cart, checkout, orders
src/
  components/ui.tsx     # Large-touch UI primitives
  constants/theme.ts
  i18n/                 # Hindi + English
  lib/                  # supabase, api, geo, notifications
  stores/               # auth + cart (zustand)
  types/database.ts
supabase/
  migrations/           # Schema + RLS + realtime
  seed/catalog_seed.sql # FMCG catalog
```

## Database schema

| Table | Purpose |
|-------|---------|
| `users` | Profile, role, language, push token |
| `stores` | Location (PostGIS), radius, hours, online flag, `approval_status` |
| `catalog` | Shared FMCG items (barcode, bilingual names) |
| `products` | Per-store inventory, MRP, price, stock |
| `addresses` | Customer delivery locations |
| `favourite_stores` | Customer favourites |
| `orders` / `order_items` | Orders with snapshots |
| `khata_accounts` / `khata_ledger` | Store credit (Digital Khata) |
| `payments` | Khata / order payments |
| `platform_fee_rules` | Active platform fee threshold & amount |
| `inventory_movements` | Stock audit log (sale, restock, adjustments) |

RPC: `nearby_stores`, `preview_order_totals`, `place_order_secure`, `calculate_platform_fee`.

## UI flow (summary)

**Auth:** Phone → OTP (SMS via Fast2SMS) → Choose owner/customer + name → Owner: store setup if new → respective tab home.

**Owner:** Dashboard (live pending orders + sound) → Orders → Products (catalog / manual / barcode / CSV) → Khata → Store (online toggle, radius, UPI, language).

**Customer:** Home (geo-filtered stores + favourites) → Store → Cart → Checkout (address, COD/UPI/Khata) → Order tracking → Reorder from history.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Phone auth stuck?** [`docs/FIX_NOW.md`](docs/FIX_NOW.md) — then [`docs/SETUP_STEP_BY_STEP.md`](docs/SETUP_STEP_BY_STEP.md) if needed.
3. **Push / dev build (not Expo Go):** [`docs/DEV_BUILD.md`](docs/DEV_BUILD.md)
3. SQL Editor → run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_storage.sql`
   - `supabase/migrations/004_phase2_secure_orders.sql`
   - `supabase/migrations/005_phase2_rls_hardening.sql`
   - `supabase/migrations/006_phase3_inventory.sql`
   - `supabase/migrations/007_phase3_inventory_rls.sql`
   - `supabase/migrations/008_phase5_delivery.sql`
   - `supabase/migrations/009_phase5_delivery_rls.sql`
4. Run `supabase/seed/catalog_seed.sql` for FMCG catalog data.
5. Deploy Edge Functions (push when app is in background):

```bash
npx supabase login
npx supabase link --project-ref YOUR_REF
npx supabase functions deploy notify-order
npx supabase functions deploy notify-order-status
```

6. Copy **Project URL** and **anon key** into `.env` (see `.env.example`).

### 2. Mobile app

```bash
cp .env.example .env   # fill Supabase keys
npm install
npx expo start         # then press w for web, or:
npm run web            # opens browser directly
```

**Web + local Supabase:** In the browser on your Mac, `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` works (unlike on a physical phone). Run `npx supabase start` and use the **anon** key from CLI output (`eyJ…`).

**iPhone:** Use cloud `https://….supabase.co` or your Mac’s LAN IP—not `127.0.0.1`.

Use a **development build** for camera, push, and full notification behaviour (`npx expo run:ios` / `run:android` or EAS).

### 3. Verify auth + store flow

1. `npx expo start -c` → **Send OTP** on your phone (Fast2SMS SMS).
2. Enter code → choose **Store owner**, complete setup (location + radius required).
3. Add products; toggle **Online** on Store tab.
4. As **Customer** (second number), allow location — store appears if within radius.

### 4. Deployment (optional)

- **Backend:** Supabase hosted; enable Realtime on `orders` (included in migration 002).
- **App:** `npx eas-cli build` / `eas submit` after `eas.json` profile setup.
- **Push:** Owners get Expo push on new orders (`notify-order`); customers on status changes (`notify-order-status`). In-app Realtime + sound still works on the owner dashboard.

## Scripts

```bash
npx expo start
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

## Notes

- Store and product photos upload to Supabase Storage buckets `store-photos` and `product-photos` (migration 003).
- Khata debits on order placement when payment method is `khata` and account is enabled for that customer.
- Use a physical device or dev build for push tokens; Expo Go has limitations for notifications.
