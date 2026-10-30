import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { formatINR } from '../../src/lib/format';
import { useCartStore } from '../../src/stores/cartStore';

export default function CartScreen() {
  const { t } = useTranslation();
  const items = useCartStore((s) => s.items);
  const setQty = useCartStore((s) => s.setQty);
  const subtotal = useCartStore((s) => s.subtotal());

  if (!items.length) {
    return (
      <View style={styles.screen}>
        <EmptyState title={t('emptyCart')} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.product.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.product.name}</Text>
              <Text style={styles.price}>
                {formatINR(item.product.selling_price * item.quantity)}
              </Text>
            </View>
            <View style={styles.qty}>
              <Button
                title="−"
                variant="secondary"
                large={false}
                style={{ minWidth: 48, minHeight: 48 }}
                onPress={() => setQty(item.product.id, item.quantity - 1)}
              />
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <Button
                title="+"
                variant="secondary"
                large={false}
                style={{ minWidth: 48, minHeight: 48 }}
                onPress={() => setQty(item.product.id, item.quantity + 1)}
              />
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('total')}</Text>
              <Text style={styles.totalValue}>{formatINR(subtotal)}</Text>
            </View>
            <Text style={styles.free}>{t('deliveryFee')}: {t('free')}</Text>
            <Button title={t('checkout')} onPress={() => router.push('/(customer)/checkout')} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontWeight: '700', fontSize: 16 },
  price: { color: colors.primary, fontWeight: '700', marginTop: 4 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyText: { fontSize: 18, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  footer: { marginTop: spacing.lg },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { fontSize: 18, fontWeight: '700' },
  totalValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  free: { color: colors.success, fontWeight: '600', marginBottom: spacing.md },
});
