/**
 * Phone OTP via Supabase Auth → Send SMS hook → send-sms → Fast2SMS.
 * When EXPO_PUBLIC_DEV_BYPASS_OTP=true, use devBypassPhoneLogin instead (no SMS).
 */
import { mapAuthErrorMessage } from './authErrors';
import { devBypassPhoneLogin, isDevBypassEnabled } from './devAuth';
import { toE164India } from './format';
import { getSupabaseConfigIssue, supabase } from './supabase';

export { isDevBypassEnabled };

export async function requestPhoneOtp(phoneDigits: string): Promise<{ error?: string; e164?: string }> {
  if (isDevBypassEnabled()) {
    return { error: 'devBypassUseDirectLogin' };
  }

  const configIssue = getSupabaseConfigIssue();
  if (configIssue) return { error: configIssue };

  const e164 = toE164India(phoneDigits);
  // SMS path — requires Fast2SMS + Send SMS hook (see docs/FIX_NOW.md)
  const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
  if (error) {
    return { error: mapAuthErrorMessage(error.message) };
  }
  return { e164 };
}

export async function devDirectLogin(phoneDigits: string) {
  return devBypassPhoneLogin(phoneDigits);
}

export async function verifyPhoneOtp(
  phoneE164: string,
  otp: string
): Promise<{ error?: string }> {
  const token = otp.replace(/\D/g, '');
  if (token.length < 6) return { error: 'required' };

  const { error } = await supabase.auth.verifyOtp({
    phone: phoneE164,
    token,
    type: 'sms',
  });
  if (error) return { error: mapAuthErrorMessage(error.message) };
  return {};
}
