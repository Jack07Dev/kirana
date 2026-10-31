# Fix phone OTP now (exhausted? read this only)

Your app code is fine. OTP fails when **Supabase → hook → Fast2SMS** breaks. You already have the **Send SMS hook** (otherwise you would see “unsupported phone provider”, not “hook 500”).

## Do these in order (≈15 min)

### 1. Deploy function (Mac, in repo)

```bash
cd ~/Desktop/kirana
npx supabase functions deploy send-sms --no-verify-jwt --project-ref eodvrrmyqencsjdufqcd
```

### 2. Match hook secret (most common fix)

1. Open [Auth → Hooks → Send SMS](https://supabase.com/dashboard/project/eodvrrmyqencsjdufqcd/auth/hooks) (not the Email hook).
2. Copy the **Signing secret** exactly (`v1,whsec_…`, only one `v1,`).
3. On Mac:

```bash
npx supabase secrets set SEND_SMS_HOOK_SECRET='paste_exact_secret_here' --project-ref eodvrrmyqencsjdufqcd
npx supabase secrets set SKIP_SMS_HOOK_VERIFY=false --project-ref eodvrrmyqencsjdufqcd
npx supabase functions deploy send-sms --no-verify-jwt --project-ref eodvrrmyqencsjdufqcd
```

### 3. Fast2SMS

- Wallet: **≥ ₹100** once (fixes error 999).
- In the app, use **your real +91 number**. Do **not** use fake `9876543210` (Fast2SMS error 427 / DND).

### 4. Test

```bash
chmod +x scripts/phone-auth-doctor.sh
./scripts/phone-auth-doctor.sh
```

Enter your real mobile when asked. If step 3 returns HTTP 200, open the app → Send OTP → same number.

### 5. Phone provider ON

[Providers → Phone](https://supabase.com/dashboard/project/eodvrrmyqencsjdufqcd/auth/providers): **Enable Phone** + **phone sign-ups**. Twilio fields can stay empty if Send SMS hook is ON. If Save fails, use dummy Twilio SIDs — see `SETUP_STEP_BY_STEP.md` A4.

---

**Logs when it still fails:** [send-sms logs](https://supabase.com/dashboard/project/eodvrrmyqencsjdufqcd/functions/send-sms/logs)

**`.env` on phone:** only `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (cloud URL, not `127.0.0.1`).
