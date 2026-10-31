import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OptimizedList } from '../../../src/components/OptimizedList';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Card, EmptyState } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatINR, ORDER_STATUS_LABELS } from '../../../src/lib/format';
import { fetchStoreOrders } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/stores/authStore';
import type { Order } from '../../../src/types/database';

export default function OwnerOrders() {
  const { t, i18n } = useTranslation();
  const store = useAuthStore((s) => s.store);
  const [orders, setOrders] = useState<Order[]>([]);
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  useFocusEffect(
    useCallback(() => {
      if (!store) return;
      void fetchStoreOrders(store.id).then(({ data }) => setOrders(data));
    }, [store])
  );

  return (
    <OptimizedList
      flex
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={orders}
      estimatedItemSize={110}
      keyExtractor={(o) => o.id}
      ListEmptyComponent={<EmptyState title={t('noOrders')} />}
      renderItem={({ item }) => {
        const st = ORDER_STATUS_LABELS[item.status];
        return (
          <Card
            style={styles.card}
            onPress={() => router.push(`/(owner)/order-detail?id=${item.id}`)}
          >
            <View style={styles.row}>
              <Text style={styles.num}>{item.order_number}</Text>
              <Badge text={st?.[lang] ?? item.status} color={st?.color} />
            </View>
            <Text style={styles.total}>{formatINR(Number(item.total))}</Text>
            <Text style={styles.meta}>
              {t(item.payment_method)} · {new Date(item.created_at).toLocaleString()}
            </Text>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, flexGrow: 1 },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  num: { fontWeight: '700', fontSize: 16 },
  total: { fontWeight: '800', color: colors.primary, marginTop: 6, fontSize: 18 },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
});
