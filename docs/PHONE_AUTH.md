# Phone OTP — Fast2SMS (India) via Supabase Send SMS Hook

**Start here:** [`SETUP_STEP_BY_STEP.md`](SETUP_STEP_BY_STEP.md) — Supabase first, then Fast2SMS, then test.

Twilio trial limits are avoided by sending OTP through **Fast2SMS** (prepaid, Indian numbers). The app uses **Supabase phone OTP** only; SMS is delivered by the **Send SMS hook** + Edge Function `send-sms`.

---

## 1. Fast2SMS account

1. Sign up at [fast2sms.com](https://www.fast2sms.com).
2. Add **wallet balance** (small amount is enough for testing; OTP route is cheap).
3. **Dev API** / API Key → copy your **API Key** (authorization key).

No “5 verified testers only” like Twilio trial — any valid Indian mobile can receive SMS once you have balance.

### Fast2SMS looks different from “the list” — that’s normal

**Supabase (Authentication → Providers → Phone)** shows a dropdown like **Twilio, MessageBird, Vonage, Textlocal**.  
**Fast2SMS is not on that list.** For Kirana you:

- Turn **Phone** provider **ON**
- Leave Twilio / MessageBird fields **empty**
- Use **Authentication → Hooks → Send SMS** → your `send-sms` URL instead

**Fast2SMS’s own docs** list many products (DLT SMS, OTP API, WhatsApp, Quick SMS, …).  
Kirana uses only one of them:

| Fast2SMS product | Kirana uses it? |
|------------------|-----------------|
| **Dev API → Authorization key** | **Yes** — put in `FAST2SMS_API_KEY` on Supabase |
| **Quick SMS** (`route: q`, `/dev/bulkV2`) | **Yes** — Edge Function sends `Kirana OTP: …` this way |
| **OTP API** (Send OTP / Verify OTP on Fast2SMS) | **No** — Supabase generates the 6-digit code; we only *deliver* it via SMS |
| **DLT SMS** (sender ID + approved template) | **No** for MVP (Quick SMS after wallet activation) |
| **SMS Webhooks** on Fast2SMS | **No** — Supabase Auth hook calls our Edge Function, not Fast2SMS webhooks |

Your key (long string from **Dev API**) is correct even if the dashboard highlights “OTP API” or “DLT” elsewhere — we still use **Quick SMS + that same Authorization key**.

**Wallet:** Fast2SMS requires **at least one ₹100 top-up** before the Dev API route works (error `999` until then).

---

## 2. Deploy the `send-sms` Edge Function

On your Mac (Node 24, Supabase CLI logged in):

```bash
cd ~/Desktop/kirana
npx supabase login
npx supabase link --project-ref eodvrrmyqencsjdufqcd

# Set secrets (replace values)
npx supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_...."   # from step 3 below
npx supabase secrets set FAST2SMS_API_KEY="your_fast2sms_key"
npx supabase secrets set SMS_PROVIDER="fast2sms"

npx supabase functions deploy send-sms --no-verify-jwt
```

---

## 3. Enable Send SMS Hook in Supabase (dashboard)

1. Open: **Authentication** → **Hooks** (left sidebar under Auth).  
   Direct link: `https://supabase.com/dashboard/project/eodvrrmyqencsjdufqcd/auth/hooks`

2. Click **Add hook** (or **Add a new hook**).

3. Choose **Send SMS hook** (not Email hook).

4. On the form:
   - Turn **Send SMS hook** / **Enable** **ON**
   - **Hook type**: **HTTPS** (not Postgres/SQL)
   - **URL** / **Endpoint**:

     ```text
     https://eodvrrmyqencsjdufqcd.supabase.co/functions/v1/send-sms
     ```

   - **Secret / Signing secret**  
     Some projects show **Generate secret**; if you **don’t** see that button, create one on your Mac and paste the **same** value in the dashboard **and** in Supabase secrets (step below):

     ```bash
     echo "v1,whsec_$(openssl rand -base64 32)"
     ```

     Copy the full line (starts with `v1,whsec_`).

5. Click **Create hook** / **Save**.

6. Put the **same secret** on the Edge Function:

   ```bash
   npx supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_paste_exact_same_value"
   npx supabase functions deploy send-sms --no-verify-jwt
   ```

The dashboard secret and `SEND_SMS_HOOK_SECRET` **must match exactly** (including `v1,whsec_` prefix).

### Debug hook 500 (temporary)

If OTP still returns `Unexpected status code returned from hook: 500`:

1. Skip signature check **temporarily** to test Fast2SMS:

   ```bash
   npx supabase secrets set SKIP_SMS_HOOK_VERIFY=true
   npx supabase functions deploy send-sms --no-verify-jwt
   ```

2. Try **Send OTP** again.
   - **Works** → fix hook secret (dashboard + `SEND_SMS_HOOK_SECRET` must match), then:

     ```bash
     npx supabase secrets unset SKIP_SMS_HOOK_VERIFY
     npx supabase functions deploy send-sms --no-verify-jwt
     ```

   - **Still 500** → open **Edge Functions → send-sms → Logs**; error is usually **Fast2SMS balance** or **invalid API key**.

3. Read log line: `send-sms hook error: ...` or `Fast2SMS: ...`

### Local debug script

```bash
./scripts/debug-sms-hook.sh
```

Calls the deployed `send-sms` URL when `SKIP_SMS_HOOK_VERIFY=true` to isolate Fast2SMS vs hook secret.

---

## 4. Enable Phone auth (no Twilio needed)

1. **Authentication** → **Providers** → **Phone**.
2. **Enable Phone provider** ON.
3. **Enable phone sign-ups** ON.
4. You do **not** need Twilio fields when the **Send SMS Hook** is enabled (hook replaces built-in SMS).
5. **Save**.

---

## 5. Test Kirana

```bash
npx expo start -c
```

Enter **10-digit Indian mobile** → **Send OTP** → SMS from Fast2SMS → enter code in app.

Check failures:

- Supabase **Authentication → Logs**
- Fast2SMS dashboard delivery logs
- Edge Function logs: Dashboard → **Edge Functions** → `send-sms` → **Logs**

---

## Optional: MSG91 instead of Fast2SMS

1. Set secrets:

   ```bash
   npx supabase secrets set SMS_PROVIDER=msg91
   npx supabase secrets set MSG91_AUTH_KEY=...
   npx supabase secrets set MSG91_TEMPLATE_ID=...   # DLT-approved flow template
   ```

2. Redeploy `send-sms`.

---

## App `.env` (unchanged)

```env
EXPO_PUBLIC_SUPABASE_URL=https://eodvrrmyqencsjdufqcd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Fast2SMS key lives **only** in Supabase Edge Function secrets, not in the mobile app.

---

## Troubleshooting

| Issue | Fix |
|--------|-----|
| Unsupported phone provider | Enable **Phone** provider + **Send SMS Hook** + deploy function |
| Hook 500 | Check `SEND_SMS_HOOK_SECRET` matches dashboard hook secret |
| Fast2SMS “Insufficient Balance” | Top up wallet |
| Fast2SMS status **999** / “complete one transaction of **100 INR** or more” | Add **≥ ₹100** to Fast2SMS wallet (required before API route works) |
| Fast2SMS invalid number | Use real 10-digit Indian mobile |
| No SMS, hook 200 | Check Fast2SMS dashboard; verify API key is Dev API key |

References:

- [Supabase Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)
- [Fast2SMS API](https://docs.fast2sms.com/)
