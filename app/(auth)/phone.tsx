import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, textStyles } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';

export default function PhoneScreen() {
  const { t, i18n } = useTranslation();
  const sendOtp = useAuthStore((s) => s.sendOtp);
  const loading = useAuthStore((s) => s.loading);
  const setLanguage = useAuthStore((s) => s.setLanguage);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const onSend = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError(t('required'));
      return;
    }
    setError('');
    const res = await sendOtp(digits);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push('/(auth)/otp');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.langRow}>
          <Pressable onPress={() => setLanguage('hi')}>
            <Text style={[styles.lang, i18n.language === 'hi' && styles.langActive]}>
              {t('hindi')}
            </Text>
          </Pressable>
          <Text style={styles.langSep}>|</Text>
          <Pressable onPress={() => setLanguage('en')}>
            <Text style={[styles.lang, i18n.language === 'en' && styles.langActive]}>
              {t('english')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={textStyles.brand}>{t('appName')}</Text>
          <Text style={styles.tagline}>{t('tagline')}</Text>
        </View>

        <View style={styles.form}>
          <Input
            label={t('enterPhone')}
            placeholder={t('phonePlaceholder')}
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            error={error}
          />
          <Button title={t('sendOtp')} onPress={onSend} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: spacing.lg },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  lang: { color: colors.textMuted, fontWeight: '600', fontSize: 15 },
  langActive: { color: colors.primary },
  langSep: { color: colors.border },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
  },
  tagline: {
    marginTop: spacing.sm,
    fontSize: 18,
    color: colors.textSecondary,
    lineHeight: 26,
  },
  form: { paddingBottom: spacing.xl },
});
