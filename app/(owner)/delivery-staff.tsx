import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../src/components/ui';
import { colors, radii, spacing } from '../../src/constants/theme';
import { toE164India } from '../../src/lib/format';
import { fetchDeliveryPartners, registerDeliveryPartner } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/authStore';
import type { DeliveryPartner } from '../../src/types/database';

export default function DeliveryStaffScreen() {
  const { t } = useTranslation();
  const store = useAuthStore((s) => s.store);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!store) return;
    void fetchDeliveryPartners(store.id).then(({ data }) => setPartners(data));
  }, [store]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const addPartner = async () => {
    if (!store || !name.trim() || phone.replace(/\D/g, '').length < 10) {
      Alert.alert(t('error'), t('deliveryStaffInvalid'));
      return;
    }
    setSaving(true);
    const { error } = await registerDeliveryPartner(toE164India(phone), name.trim());
    setSaving(false);
    if (error) Alert.alert(t('error'), error.message);
    else {
      setName('');
      setPhone('');
      load();
      Alert.alert(t('success'), t('deliveryStaffAdded'));
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.hint}>{t('deliveryStaffHint')}</Text>

      <Input label={t('deliveryPartnerName')} value={name} onChangeText={setName} />
      <Input
        label={t('phone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={14}
      />
      <Button title={t('addDeliveryPartner')} onPress={addPartner} loading={saving} />

      <Text style={styles.section}>{t('deliveryStaffList')}</Text>
      <FlatList
        data={partners}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={<Text style={styles.empty}>{t('noDeliveryStaff')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerName}>{item.display_name}</Text>
              <Text style={styles.partnerPhone}>{item.phone}</Text>
              {!item.user_id ? (
                <Text style={styles.pending}>{t('deliveryStaffPendingLogin')}</Text>
              ) : (
                <Text style={styles.linked}>{t('deliveryStaffLinked')}</Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  hint: { color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 22 },
  section: { fontWeight: '800', fontSize: 17, marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { color: colors.textMuted },
  row: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  partnerName: { fontWeight: '700', fontSize: 16 },
  partnerPhone: { color: colors.textSecondary, marginTop: 4 },
  pending: { color: colors.accent, marginTop: 6, fontSize: 13 },
  linked: { color: colors.primary, marginTop: 6, fontSize: 13 },
});
