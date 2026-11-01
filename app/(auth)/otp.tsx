import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, textStyles } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { resolveAuthErrorKey } from '../../src/lib/authErrors';
import { isDevBypassEnabled } from '../../src/lib/devAuth';
import { formatPhone } from '../../src/lib/format';
import { useAuthStore } from '../../src/stores/authStore';

export default function OtpScreen() {
  const { t } = useTranslation();
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const sendOtp = useAuthStore((s) => s.sendOtp);
  const phone = useAuthStore((s) => s.phone);
  const loading = useAuthStore((s) => s.loading);
  const devBypass = isDevBypassEnabled();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const onVerify = async () => {
    if (otp.replace(/\D/g, '').length < 6) {
      setError(t('required'));
      return;
    }
    setError('');
    const res = await verifyOtp(otp);
    if (res.error) {
      setError(resolveAuthErrorKey(t, res.error));
      return;
    }
    router.replace('/');
  };

  const onResend = async () => {
    if (devBypass) return;
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) return;
    setError('');
    const res = await sendOtp(digits);
    if (res.error) setError(resolveAuthErrorKey(t, res.error));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={textStyles.h1}>{t('enterOtp')}</Text>
        <Text style={styles.sub}>
          {devBypass
            ? t('devOtpHint', { phone: formatPhone(phone) })
            : t('otpSent', { phone: formatPhone(phone) })}
        </Text>
        <Input
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={setOtp}
          error={error}
          placeholder="••••••"
          style={{ letterSpacing: 8, fontSize: 24, textAlign: 'center' }}
        />
        <Button title={t('verifyOtp')} onPress={onVerify} loading={loading} />
        {!devBypass ? (
          <>
            <View style={{ height: spacing.md }} />
            <Button title={t('resendOtp')} variant="ghost" onPress={onResend} loading={loading} />
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  sub: { color: colors.textSecondary, marginVertical: spacing.md, fontSize: 15 },
});
