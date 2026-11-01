/**
 * Temporary dev login — bypasses SMS OTP when Fast2SMS / hook is unavailable.
 * Set EXPO_PUBLIC_DEV_BYPASS_OTP=true and EXPO_PUBLIC_DEV_BYPASS_OTP_PASSWORD in .env
 * Disable both before production.
 *
 * Uses one shared Supabase email user (avoids signup rate limits per phone number).
 */
import { mapAuthErrorMessage } from './authErrors';
import { toE164India } from './format';
import { supabase } from './supabase';

const SHARED_DEV_EMAIL = 'kirana-shared-dev@example.com';

function devPassword(): string | undefined {
  const p = process.env.EXPO_PUBLIC_DEV_BYPASS_OTP_PASSWORD?.trim();
  return p || undefined;
}

export function isDevBypassEnabled(): boolean {
  return (
    process.env.EXPO_PUBLIC_DEV_BYPASS_OTP === 'true' && Boolean(devPassword())
  );
}

/** Sign in with shared dev account — real session, no SMS. Phone is stored on profile only. */
export async function devBypassPhoneLogin(
  phoneDigits: string
): Promise<{ error?: string; e164?: string }> {
  if (!isDevBypassEnabled()) {
    return { error: 'devBypassDisabled' };
  }

  const digits = phoneDigits.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) {
    return { error: 'required' };
  }

  const password = devPassword()!;
  const e164 = toE164India(digits);

  let signIn = await supabase.auth.signInWithPassword({
    email: SHARED_DEV_EMAIL,
    password,
  });

  if (signIn.error) {
    const msg = signIn.error.message.toLowerCase();
    const invalidCreds =
      msg.includes('invalid login') ||
      msg.includes('invalid credentials') ||
      msg.includes('email not confirmed');

    if (invalidCreds) {
      const signUp = await supabase.auth.signUp({
        email: SHARED_DEV_EMAIL,
        password,
        options: { data: { phone: e164 } },
      });
      if (signUp.error) {
        return { error: mapAuthErrorMessage(signUp.error.message) };
      }
      signIn = await supabase.auth.signInWithPassword({
        email: SHARED_DEV_EMAIL,
        password,
      });
    }
  }

  if (signIn.error || !signIn.data.session) {
    if (signIn.error) {
      return { error: mapAuthErrorMessage(signIn.error.message) };
    }
    return { error: 'devEmailConfirm' };
  }

  await syncDevUserPhone(e164);
  return { e164 };
}

async function syncDevUserPhone(e164: string) {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) return;

  await supabase.from('users').update({ phone: e164 }).eq('id', uid);
}
