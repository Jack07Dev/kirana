# Kirana — hyperlocal store ordering (MVP)

React Native (Expo SDK 58) + Supabase backend. Connects nearby kirana stores with customers inside the store’s delivery radius. **₹0 delivery fee**, **₹0 commission** (`platform_fee` defaults to 0). Store staff delivers; customers pay product price only (COD / UPI / Khata).

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
| `stores` | Location (PostGIS), radius, hours, online flag, `platform_fee` |
| `catalog` | Shared FMCG items (barcode, bilingual names) |
| `products` | Per-store inventory, MRP, price, stock |
| `addresses` | Customer delivery locations |
| `favourite_stores` | Customer favourites |
| `orders` / `order_items` | Orders with snapshots |
| `khata_accounts` / `khata_ledger` | Store credit (Digital Khata) |
| `payments` | Khata / order payments |

`store_type` enum (`kirana`, `sabzi`, `medical`, …) keeps the model extensible.

RPC: `nearby_stores(lat, lng)` — online stores whose radius covers the customer.

## UI flow (summary)

**Auth:** Phone → OTP → Choose owner/customer + name → Owner: store setup if new → respective tab home.

**Owner:** Dashboard (live pending orders + sound) → Orders → Products (catalog / manual / barcode / CSV) → Khata → Store (online toggle, radius, UPI, language).

**Customer:** Home (geo-filtered stores + favourites) → Store → Cart → Checkout (address, COD/UPI/Khata) → Order tracking → Reorder from history.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Enable **Phone** auth (SMS provider: Twilio / MessageBird / etc.).
3. SQL Editor → run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_storage.sql`
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
npx expo start
```

Use a **development build** for camera, push, and full notification behaviour (`npx expo run:ios` / `run:android` or EAS).

### 3. Verify auth + store flow

1. Sign in with phone OTP.
2. Choose **Store owner**, complete setup (location + radius required).
3. Add products from catalog or manual form; toggle **Online** on Store tab.
4. As **Customer** (second device/number), allow location — store appears if within radius.

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
