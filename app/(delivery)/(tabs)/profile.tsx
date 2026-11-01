import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatPhone } from '../../../src/lib/format';
import { useAuthStore } from '../../../src/stores/authStore';

export default function PartnerProfile() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.deliveryPartner);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{user?.full_name ?? t('tabProfile')}</Text>
      {partner ? (
        <>
          <Text style={styles.label}>{t('deliveryPartnerName')}</Text>
          <Text style={styles.value}>{partner.display_name}</Text>
          <Text style={styles.label}>{t('phone')}</Text>
          <Text style={styles.value}>{formatPhone(partner.phone)}</Text>
        </>
      ) : (
        <Text style={styles.hint}>{t('deliveryNotLinkedHint')}</Text>
      )}
      <View style={{ flex: 1 }} />
      <Button title={t('logout')} variant="danger" onPress={() => signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  label: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md },
  value: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 4 },
  hint: { color: colors.textSecondary, lineHeight: 22 },
});
