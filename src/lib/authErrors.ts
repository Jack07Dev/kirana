/** Map Supabase Auth errors to i18n keys or short user-facing text. */
export function mapAuthErrorMessage(message: string): string {
  const msg = message.toLowerCase();

  if (msg.includes('unsupported phone provider') || msg.includes('phone_provider')) {
    return 'phoneProvider';
  }
  if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('connect')) {
    return 'network';
  }
  if (msg.includes('hook') && (msg.includes('500') || msg.includes('status code'))) {
    return 'smsHookFailed';
  }
  if (msg.includes('100 inr') || msg.includes('status_code":999') || msg.includes('wallet')) {
    return 'fast2smsWallet';
  }
  if (msg.includes('webhook signature') || msg.includes('send_sms_hook')) {
    return 'smsHookFailed';
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'authRateLimit';
  }

  return message;
}

export function resolveAuthErrorKey(t: (k: string) => string, code: string): string {
  if (code === 'missingUrl') return t('supabaseMissingUrl');
  if (code === 'missingKey') return t('supabaseMissingKey');
  if (code === 'badKey') return t('supabaseBadKey');
  if (code === 'localOnPhone') return t('supabaseLocalOnPhone');
  if (code === 'network') return t('supabaseNetwork');
  if (code === 'phoneProvider') return t('supabasePhoneProvider');
  if (code === 'smsHookFailed') return t('supabaseSmsHookFailed');
  if (code === 'fast2smsWallet') return t('fast2smsWallet');
  if (code === 'otpRateLimit') return t('otpRateLimit');
  if (code === 'authRateLimit') return t('authRateLimit');
  if (code === 'devBypassDisabled') return t('devBypassDisabled');
  if (code === 'devEmailConfirm') return t('devEmailConfirm');
  if (code === 'devBypassUseDirectLogin') return t('devBypassUseDirectLogin');
  return code;
}
