# Kirana — step-by-step setup (Supabase first, then Fast2SMS, then test)

Project ref used here: **`eodvrrmyqencsjdufqcd`**. Replace if you use another project.

---

## Part A — Supabase (complete this first)

### A1. Project & app `.env`

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/eodvrrmyqencsjdufqcd).
2. **Settings → API** → copy:
   - **Project URL** → `https://eodvrrmyqencsjdufqcd.supabase.co`
   - **anon public** key (starts with `eyJ…`)
3. In `~/Desktop/kirana/.env`:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://eodvrrmyqencsjdufqcd.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...paste_anon_key...
   ```

4. Do **not** put Fast2SMS or hook secrets in `.env`.

---

### A2. Database (migrations)

**If you see `type "user_role" already exists`:** `001` was already applied (or partly). **Do not run `001` again.** Run the checker below, then only run files that are still missing.

1. Dashboard → **SQL Editor** → run `scripts/check_supabase_schema.sql` (or paste its queries).
2. Run each migration file **only if needed**, in order:
   - `supabase/migrations/001_initial_schema.sql` — skip if `users` + enums already exist
   - `supabase/migrations/002_rls_policies.sql` — skip if you already ran it (errors on duplicate policies mean skip)
   - `supabase/migrations/003_storage.sql` — skip if buckets `store-photos` / `product-photos` exist
3. Optional seed: `supabase/seed/catalog_seed.sql` (safe to re-run only if catalog empty)

Or with CLI (tracks applied migrations — preferred if linked):

```bash
cd ~/Desktop/kirana
npx supabase login
npx supabase link --project-ref eodvrrmyqencsjdufqcd
npx supabase db push
```

---

### A3. Phone auth provider (no Twilio)

1. [Authentication → Providers → Phone](https://supabase.com/dashboard/project/eodvrrmyqencsjdufqcd/auth/providers)
2. **Enable Phone provider** → ON  
3. **Enable phone sign-ups** → ON  
4. Leave **Twilio / MessageBird / Vonage** fields **empty** (Fast2SMS is via hook, not this dropdown).  
5. **Save**.

---

### A4. Send SMS hook (webhook to your Edge Function)

**Where to find it:** **Authentication → Hooks** — look for a **Send SMS** / **Send SMS Hook** block (same level as **Send Email**).  
It is **not** Fast2SMS in a dropdown; it is **not** the same as “Add hook → Send Email” only.

If you **only** see Send Email when clicking “Add hook”:

1. Open the main Hooks page (not inside the email hook editor):  
   https://supabase.com/dashboard/project/eodvrrmyqencsjdufqcd/auth/hooks  
2. **Enable Phone provider first** (step A3), **Save**, refresh the Hooks page.  
3. Look for **Send SMS Hook** as its own row → **Configure** / **Enable** (HTTPS).  
4. Still missing? Try another browser or zoom out — or enable **Send SMS Hook** before turning Phone ON (see workaround below).

**Configure Send SMS (HTTPS):**

1. **Enable** Send SMS hook  
2. **Type** → **HTTPS** (not Postgres/SQL)  
3. **URL**:

   ```text
   https://eodvrrmyqencsjdufqcd.supabase.co/functions/v1/send-sms
   ```

4. **Signing secret** — Generate or:

   ```bash
   echo "v1,whsec_$(openssl rand -base64 32)"
   ```

   Copy the full `v1,whsec_…` line into the hook **Secret** field → **Save**.

5. Same secret in CLI (step A6).

**Twilio on Phone page (workaround if Save fails):**

Some dashboards require dummy Twilio **before** Phone can save, even with a hook:

1. Temporarily **disable** Send SMS hook → Save.  
2. Phone → Twilio → dummy format-valid values (`AC…`, auth token any string, `MG…` message service SID) → Phone **ON** → Save.  
3. **Re-enable** Send SMS hook (HTTPS + URL + secret). Twilio is then ignored; Fast2SMS runs via hook.

Direct link: [Auth Hooks](https://supabase.com/dashboard/project/eodvrrmyqencsjdufqcd/auth/hooks)

---

### A5. Deploy `send-sms` Edge Function

```bash
cd ~/Desktop/kirana
npx supabase login
npx supabase link --project-ref eodvrrmyqencsjdufqcd

npx supabase functions deploy send-sms --no-verify-jwt
```

Dashboard: [Edge Functions](https://supabase.com/dashboard/project/eodvrrmyqencsjdufqcd/functions) → you should see **`send-sms`**.

---

### A6. Edge Function secrets (Supabase cloud)

Use **single quotes** if the secret contains `+`:

```bash
# Same string as hook Secret in dashboard (step A4)
npx supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_paste_exact_from_dashboard'

# Fast2SMS key — add in Part B first, then run this line
npx supabase secrets set FAST2SMS_API_KEY='paste_fast2sms_dev_api_key'

# Must be false for real login (only true when debugging)
npx supabase secrets set SKIP_SMS_HOOK_VERIFY=false

npx supabase functions deploy send-sms --no-verify-jwt
```

Verify names exist (digests only):

```bash
npx supabase secrets list --project-ref eodvrrmyqencsjdufqcd
```

Expect at least: `SEND_SMS_HOOK_SECRET`, `FAST2SMS_API_KEY`, `SKIP_SMS_HOOK_VERIFY`.

`SMS_PROVIDER=fast2sms` is **optional** (docs only; code always uses Fast2SMS today).

---

### A7. Supabase checklist (tick before Fast2SMS)

- [ ] Migrations `001`–`003` applied  
- [ ] Phone provider **ON**, sign-ups **ON**  
- [ ] Send SMS hook **ON**, HTTPS URL correct  
- [ ] Hook secret in dashboard **=** `SEND_SMS_HOOK_SECRET` in CLI  
- [ ] `send-sms` deployed  
- [ ] App `.env` has URL + anon key  

---

## Part B — Fast2SMS (after Supabase is done)

### B1. Account & wallet

1. Sign up / log in: [fast2sms.com](https://www.fast2sms.com)
2. **Wallet** → add **at least ₹100** once (required for Dev API — error **999** until then).
3. **Dev API** (or API section) → copy **Authorization key** (long string).

Do **not** use Fast2SMS “OTP API verify” for Kirana — Supabase generates the OTP; we only **send** the text via Quick SMS.

---

### B2. Put key on Supabase

```bash
npx supabase secrets set FAST2SMS_API_KEY='your_authorization_key'
npx supabase functions deploy send-sms --no-verify-jwt
```

---

### B3. Fast2SMS checklist

- [ ] Wallet topped up (≥ ₹100 activation)  
- [ ] Dev API authorization key copied  
- [ ] `FAST2SMS_API_KEY` set on Supabase + function redeployed  

---

## Part C — Test & verify

### C1. Test Fast2SMS only (optional, isolates wallet/key)

Temporarily skip hook signature:

```bash
npx supabase secrets set SKIP_SMS_HOOK_VERIFY=true
npx supabase functions deploy send-sms --no-verify-jwt
```

```bash
curl -sS -X POST "https://eodvrrmyqencsjdufqcd.supabase.co/functions/v1/send-sms" \
  -H "Content-Type: application/json" \
  -d '{"user":{"phone":"+91YOUR_10_DIGIT_MOBILE"},"sms":{"otp":"123456"}}'
```

- **HTTP 200** `{}` → Fast2SMS OK → turn verify back on (C2).  
- **HTTP 500** with `999` or `100 INR` → wallet not activated yet.  
- **HTTP 500** with `Invalid` / auth → wrong API key.

Turn signature back on:

```bash
npx supabase secrets set SKIP_SMS_HOOK_VERIFY=false
npx supabase functions deploy send-sms --no-verify-jwt
```

---

### C2. Test full path (app)

```bash
cd ~/Desktop/kirana
npx expo start -c
```

1. Enter **10-digit Indian mobile**  
2. **Send OTP**  
3. SMS should arrive (Fast2SMS)  
4. Enter **6-digit code** → **Verify & Continue** → role screen  

---

### C3. If something fails — where to look

| Symptom | Check |
|--------|--------|
| Unsupported phone provider | A3 Phone **ON** |
| Hook 500 / SMS could not be sent | [send-sms Logs](https://supabase.com/dashboard/project/eodvrrmyqencsjdufqcd/functions/send-sms/logs) |
| `Webhook signature invalid` | A4 secret **=** A6 `SEND_SMS_HOOK_SECRET` |
| `100 INR` / status 999 | B1 wallet ≥ ₹100 |
| OTP never arrives, hook 200 | Fast2SMS dashboard SMS logs |
| App can’t connect | `.env` URL/key, `npx expo start -c` |

Also: **Authentication → Logs** in Supabase after each Send OTP attempt.

---

## Flow (reference)

```text
Kirana app  →  Supabase Auth (signInWithOtp)
           →  Send SMS Hook (HTTPS webhook)
           →  Edge Function send-sms
           →  Fast2SMS Quick SMS
           →  SMS to phone
App         →  verifyOtp with code from SMS
```

More detail: [`PHONE_AUTH.md`](PHONE_AUTH.md)
