import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OptimizedList } from '../../../src/components/OptimizedList';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, EmptyState } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatINR, formatPhone } from '../../../src/lib/format';
import { fetchStoreKhata } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/stores/authStore';
import type { KhataAccount } from '../../../src/types/database';

export default function OwnerKhata() {
  const { t } = useTranslation();
  const store = useAuthStore((s) => s.store);
  const [accounts, setAccounts] = useState<KhataAccount[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!store) return;
      void fetchStoreKhata(store.id).then(({ data }) => setAccounts(data));
    }, [store])
  );

  return (
    <OptimizedList
      flex
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={accounts}
      estimatedItemSize={100}
      keyExtractor={(a) => a.id}
      ListEmptyComponent={<EmptyState title={t('noKhataAccounts')} />}
      ListHeaderComponent={
        <Text style={styles.title}>{t('khataTitle')}</Text>
      }
      renderItem={({ item }) => {
        const customer = item.customer as { full_name?: string; phone?: string } | undefined;
        return (
          <Card
            style={styles.card}
            onPress={() => router.push(`/(owner)/khata-detail?id=${item.id}`)}
          >
            <Text style={styles.name}>
              {customer?.full_name || formatPhone(customer?.phone || '')}
            </Text>
            <View style={styles.row}>
              <View>
                <Text style={styles.label}>{t('creditBalance')}</Text>
                <Text style={styles.balance}>{formatINR(Number(item.balance))}</Text>
              </View>
              <View>
                <Text style={styles.label}>{t('creditLimit')}</Text>
                <Text style={styles.limit}>{formatINR(Number(item.credit_limit))}</Text>
              </View>
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: spacing.md, color: colors.text },
  card: { marginBottom: spacing.sm },
  name: { fontWeight: '700', fontSize: 17, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.textMuted, fontSize: 12 },
  balance: { fontSize: 20, fontWeight: '800', color: colors.accent },
  limit: { fontSize: 16, fontWeight: '600', color: colors.text },
});
