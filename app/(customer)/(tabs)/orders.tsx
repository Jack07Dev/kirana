import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, EmptyState } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatINR, ORDER_STATUS_LABELS } from '../../../src/lib/format';
import { fetchCustomerOrders, fetchStoreProducts } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/stores/authStore';
import { useCartStore } from '../../../src/stores/cartStore';
import type { Order } from '../../../src/types/database';

export default function CustomerOrders() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  const load = useCallback(() => {
    if (!user) return;
    void fetchCustomerOrders(user.id).then(({ data }) => setOrders(data));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const reorder = async (order: Order) => {
    const { data: products } = await fetchStoreProducts(order.store_id);
    const cart = useCartStore.getState();
    cart.clear();
    for (const item of order.items ?? []) {
      const product = products.find((p) => p.id === item.product_id);
      if (product && product.stock_status === 'in_stock') {
        cart.addItem(product, Number(item.quantity));
      }
    }
    if (cart.itemCount() === 0) {
      Alert.alert(t('error'), 'Products unavailable');
      return;
    }
    router.push('/(customer)/cart');
  };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={orders}
      keyExtractor={(o) => o.id}
      ListEmptyComponent={<EmptyState title={t('noOrders')} />}
      renderItem={({ item }) => {
        const st = ORDER_STATUS_LABELS[item.status];
        const store = item.store as { name?: string } | undefined;
        return (
          <Card
            style={styles.card}
            onPress={() => router.push(`/(customer)/order/${item.id}`)}
          >
            <View style={styles.row}>
              <Text style={styles.num}>{item.order_number}</Text>
              <Badge text={st?.[lang] ?? item.status} color={st?.color} />
            </View>
            <Text style={styles.store}>{store?.name}</Text>
            <Text style={styles.total}>{formatINR(Number(item.total))}</Text>
            {item.status === 'delivered' ? (
              <Button
                title={t('reorder')}
                variant="secondary"
                large={false}
                style={{ marginTop: 10 }}
                onPress={() => reorder(item)}
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
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  num: { fontWeight: '700', fontSize: 16 },
  store: { color: colors.textSecondary, marginTop: 4 },
  total: { fontWeight: '800', color: colors.primary, marginTop: 6, fontSize: 18 },
});
