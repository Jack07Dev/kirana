import { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, EmptyState } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatINR } from '../../../src/lib/format';
import { fetchCustomerKhata, recordKhataPayment } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/stores/authStore';
import type { KhataAccount } from '../../../src/types/database';

export default function CustomerKhata() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [accounts, setAccounts] = useState<KhataAccount[]>([]);

  const load = useCallback(() => {
    if (!user) return;
    void fetchCustomerKhata(user.id).then(({ data }) => setAccounts(data));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={accounts}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={<Text style={styles.title}>{t('tabMyKhata')}</Text>}
      ListEmptyComponent={<EmptyState title={t('noKhataAccounts')} />}
      renderItem={({ item }) => {
        const store = item.store as { name?: string; upi_id?: string } | undefined;
        return (
          <Card style={styles.card}>
            <Text style={styles.name}>{store?.name}</Text>
            <Text style={styles.label}>{t('owedTo')}</Text>
            <Text style={styles.balance}>{formatINR(Number(item.balance))}</Text>
            <Text style={styles.cycle}>
              {item.reminder_cycle === 'weekly' ? t('weekly') : t('monthly')}
            </Text>
            {Number(item.balance) > 0 && store?.upi_id ? (
              <Button
                title={t('payViaUpi')}
                large={false}
                style={{ marginTop: 12 }}
                onPress={async () => {
                  if (!user) return;
                  const amt = Number(item.balance);
                  const upi = `upi://pay?pa=${encodeURIComponent(store.upi_id!)}&am=${amt}&cu=INR&tn=${encodeURIComponent('Khata payment')}`;
                  const can = await Linking.canOpenURL(upi);
                  if (can) await Linking.openURL(upi);
                  else Alert.alert('UPI', store.upi_id);

                  await recordKhataPayment({
                    account_id: item.id,
                    store_id: item.store_id,
                    customer_id: user.id,
                    amount: amt,
                    method: 'upi',
                    note: 'Customer UPI payment',
                    created_by: user.id,
                  });
                  load();
                }}
              />
            ) : null}
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: spacing.md },
  card: { marginBottom: spacing.sm },
  name: { fontWeight: '700', fontSize: 17 },
  label: { color: colors.textMuted, marginTop: 8, fontSize: 12 },
  balance: { fontSize: 24, fontWeight: '800', color: colors.accent },
  cycle: { color: colors.textSecondary, marginTop: 4 },
});
