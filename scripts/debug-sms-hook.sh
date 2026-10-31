#!/usr/bin/env bash
# Debug Send SMS hook + Fast2SMS (run from repo root).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-eodvrrmyqencsjdufqcd}"
FN_URL="https://${PROJECT_REF}.supabase.co/functions/v1/send-sms"

echo "=== Kirana SMS hook debug ==="
echo "Project: $PROJECT_REF"
echo ""

echo "1) Supabase secrets (digests only):"
npx supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null | grep -E 'FAST2SMS|SEND_SMS|SKIP_SMS' || true
echo ""

echo "2) Test Edge Function with SKIP_SMS_HOOK_VERIFY=true (no signature):"
echo "   First run:"
echo "   npx supabase secrets set SKIP_SMS_HOOK_VERIFY=true"
echo "   npx supabase functions deploy send-sms --no-verify-jwt"
echo ""
read -r -p "   Enter 10-digit Indian mobile to test (or empty to skip curl): " MOBILE
if [[ -n "${MOBILE}" ]]; then
  BODY="{\"user\":{\"phone\":\"+91${MOBILE}\"},\"sms\":{\"otp\":\"123456\"}}"
  echo "   POST $FN_URL"
  curl -sS -w "\nHTTP %{http_code}\n" -X POST "$FN_URL" \
    -H "Content-Type: application/json" \
    -d "$BODY"
  echo ""
  echo "   If HTTP 200 but no SMS: Fast2SMS dashboard + wallet."
  echo "   If HTTP 500: read message above; check Dashboard → Edge Functions → send-sms → Logs."
fi
echo ""

echo "3) Hook secret must match EXACTLY:"
echo "   Dashboard → Authentication → Hooks → Send SMS"
echo "   CLI: npx supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_...'   # use SINGLE quotes if secret has +"
echo ""

echo "4) Turn verification back on after secret is fixed:"
echo "   npx supabase secrets set SKIP_SMS_HOOK_VERIFY=false"
echo "   npx supabase functions deploy send-sms --no-verify-jwt"
echo ""
echo "Logs: https://supabase.com/dashboard/project/${PROJECT_REF}/functions/send-sms/logs"
