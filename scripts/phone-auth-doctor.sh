#!/usr/bin/env bash
# Diagnose phone OTP pipeline (Supabase hook + send-sms + Fast2SMS).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-eodvrrmyqencsjdufqcd}"
FN_URL="https://${PROJECT_REF}.supabase.co/functions/v1/send-sms"

echo "=== Kirana phone auth doctor ==="
echo "Project: $PROJECT_REF"
echo ""

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a && source .env && set +a
fi

if [[ -z "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo "ERROR: EXPO_PUBLIC_SUPABASE_ANON_KEY missing in .env"
  exit 1
fi

echo "1) Edge secrets present (names only):"
npx supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null \
  | grep -E '"name":"(FAST2SMS|SEND_SMS|SKIP_SMS)' || true
echo ""

echo "2) Deploy latest send-sms..."
npx supabase functions deploy send-sms --no-verify-jwt --project-ref "$PROJECT_REF"
echo ""

read -r -p "3) Enter YOUR real 10-digit Indian mobile (not 9876543210): " MOBILE
if [[ -z "${MOBILE}" ]]; then
  echo "Skipped live test."
  exit 0
fi

if [[ "${MOBILE}" == "9876543210" ]]; then
  echo "WARNING: 9876543210 is often Fast2SMS DND/blocked — use the phone you hold in your hand."
fi

BODY="{\"user\":{\"phone\":\"+91${MOBILE}\"},\"sms\":{\"otp\":\"123456\"}}"
echo "   POST send-sms (skip-verify must be true for this curl-only test)"
HTTP=$(curl -sS -o /tmp/kirana-sms-test.json -w "%{http_code}" -X POST "$FN_URL" \
  -H "Content-Type: application/json" \
  -d "$BODY")
echo "   HTTP $HTTP"
cat /tmp/kirana-sms-test.json
echo ""

if [[ "$HTTP" == "200" ]]; then
  echo "OK: Fast2SMS accepted the message. Check SMS on +91${MOBILE}."
else
  echo "Fix the error above, then:"
  echo "  Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/hooks"
  echo "  Logs:      https://supabase.com/dashboard/project/${PROJECT_REF}/functions/send-sms/logs"
fi

echo ""
echo "4) Full OTP test (uses Supabase Auth + hook):"
curl -sS -X POST "https://${PROJECT_REF}.supabase.co/auth/v1/otp" \
  -H "apikey: ${EXPO_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${EXPO_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"+91${MOBILE}\"}"
echo ""
echo ""
echo "If Auth returns hook 500 but step 3 was 200, sync hook secret:"
echo "  Dashboard Send SMS secret = same as: npx supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_...'"
echo "  Then: npx supabase secrets set SKIP_SMS_HOOK_VERIFY=false"
