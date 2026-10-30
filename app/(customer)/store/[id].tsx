import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, EmptyState, Input } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatINR } from '../../../src/lib/format';
import {
  fetchStoreProducts,
  toggleFavourite,
} from '../../../src/lib/api';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useCartStore } from '../../../src/stores/cartStore';
import type { Product, Store } from '../../../src/types/database';

export default function StoreBrowse() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const addItem = useCartStore((s) => s.addItem);
  const itemCount = useCartStore((s) => s.itemCount());
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [isFav, setIsFav] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data }) => setStore(data as Store));
      void fetchStoreProducts(id).then(({ data }) => setProducts(data));
      if (user) {
        void supabase
          .from('favourite_stores')
          .select('*')
          .eq('user_id', user.id)
          .eq('store_id', id)
          .maybeSingle()
          .then(({ data }) => setIsFav(!!data));
      }
    }, [id, user])
  );

  const filtered = products.filter(
    (p) =>
      p.stock_status !== 'out_of_stock' &&
      (!q || p.name.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.name}>{store?.name}</Text>
            <Text style={styles.addr}>{store?.address_line}</Text>
            <View style={styles.favRow}>
              <Button
                title={isFav ? t('unfavourite') : t('favourite')}
                variant="ghost"
                large={false}
                onPress={async () => {
                  if (!user || !id) return;
                  await toggleFavourite(user.id, id, !isFav);
                  setIsFav(!isFav);
                }}
              />
            </View>
            <Input placeholder={t('search')} value={q} onChangeText={setQ} />
          </View>
        }
        ListEmptyComponent={<EmptyState title={t('noProducts')} />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pname}>{item.name}</Text>
                <Text style={styles.price}>
                  {formatINR(Number(item.selling_price))}
                  {item.discount_pct > 0 ? (
                    <Text style={styles.mrp}> {formatINR(Number(item.mrp))}</Text>
                  ) : null}
                  {item.discount_pct > 0 ? (
                    <Text style={styles.offer}> {item.discount_pct}% off</Text>
                  ) : null}
                </Text>
              </View>
              <Pressable
                style={styles.addBtn}
                onPress={() => {
                  const res = addItem(item);
                  if (res.error) Alert.alert(t('cart'), res.error);
                }}
              >
                <Text style={styles.addText}>{t('addToCart')}</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />
      {itemCount > 0 ? (
        <View style={styles.footer}>
          <Button
            title={`${t('cart')} (${itemCount}) →`}
            variant="accent"
            onPress={() => router.push('/(customer)/cart')}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: 100 },
  name: { fontSize: 24, fontWeight: '800' },
  addr: { color: colors.textSecondary, marginBottom: spacing.sm },
  favRow: { marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pname: { fontWeight: '700', fontSize: 16 },
  price: { marginTop: 4, fontWeight: '700', color: colors.primary },
  mrp: { textDecorationLine: 'line-through', color: colors.textMuted, fontWeight: '400' },
  offer: { color: colors.accent, fontWeight: '700' },
  addBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  addText: { color: colors.primary, fontWeight: '800' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
