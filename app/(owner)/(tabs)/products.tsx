import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, EmptyState, Input } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatINR } from '../../../src/lib/format';
import { fetchStoreProducts, setStockStatus } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/stores/authStore';
import type { Product } from '../../../src/types/database';

export default function OwnerProducts() {
  const { t } = useTranslation();
  const store = useAuthStore((s) => s.store);
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    if (!store) return;
    void fetchStoreProducts(store.id).then(({ data }) => setProducts(data));
  }, [store]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = products.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.barcode?.includes(q)
  );

  return (
    <View style={styles.screen}>
      <View style={styles.actions}>
        <Button
          title={t('fromCatalog')}
          style={{ flex: 1 }}
          large={false}
          onPress={() => router.push('/(owner)/catalog-picker')}
        />
        <View style={{ width: 8 }} />
        <Button
          title={t('addManually')}
          variant="secondary"
          style={{ flex: 1 }}
          large={false}
          onPress={() => router.push('/(owner)/product-form')}
        />
      </View>
      <View style={styles.actions}>
        <Button
          title={t('scanBarcode')}
          variant="ghost"
          style={{ flex: 1 }}
          large={false}
          onPress={() => router.push('/(owner)/barcode-scan')}
        />
        <View style={{ width: 8 }} />
        <Button
          title={t('bulkUpload')}
          variant="ghost"
          style={{ flex: 1 }}
          large={false}
          onPress={() => router.push('/(owner)/csv-upload')}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <Input placeholder={t('search')} value={q} onChangeText={setQ} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title={t('noProducts')} />}
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() =>
              router.push(`/(owner)/product-form?id=${item.id}`)
            }
          >
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>
                  {formatINR(Number(item.selling_price))}
                  {item.discount_pct > 0 ? (
                    <Text style={styles.mrp}>  MRP {formatINR(Number(item.mrp))}</Text>
                  ) : null}
                </Text>
                {item.stock_qty != null ? (
                  <Text style={styles.stockMeta}>
                    {t('stockQtyLabel', { qty: item.stock_qty })}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={async () => {
                  const next =
                    item.stock_status === 'in_stock' ? 'out_of_stock' : 'in_stock';
                  await setStockStatus(item.id, next);
                  load();
                }}
              >
                <Badge
                  text={
                    item.stock_status === 'in_stock'
                      ? t('inStock')
                      : item.stock_status === 'low_stock'
                        ? t('lowStock')
                        : t('outOfStock')
                  }
                  color={
                    item.stock_status === 'in_stock'
                      ? colors.success
                      : item.stock_status === 'low_stock'
                        ? colors.warning
                        : colors.danger
                  }
                />
              </Pressable>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  list: { padding: spacing.lg, paddingTop: 0, flexGrow: 1 },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontWeight: '700', fontSize: 16, color: colors.text },
  price: { marginTop: 4, fontWeight: '700', color: colors.primary, fontSize: 15 },
  mrp: { color: colors.textMuted, textDecorationLine: 'line-through', fontWeight: '400' },
  stockMeta: { marginTop: 4, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});
