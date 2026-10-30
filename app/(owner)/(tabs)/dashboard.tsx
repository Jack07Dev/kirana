import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, SectionTitle, StatTile } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatINR } from '../../../src/lib/format';
import { fetchStoreOrders, ownerDashboard, updateOrderStatus } from '../../../src/lib/api';
import { playOrderAlert, registerForPushNotifications } from '../../../src/lib/notifications';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import type { Order } from '../../../src/types/database';

export default function OwnerDashboard() {
  const { t } = useTranslation();
  const store = useAuthStore((s) => s.store);
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState({
    todayOrders: 0,
    todaySales: 0,
    pending: 0,
    pendingKhata: 0,
  });
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    const d = await ownerDashboard(store.id);
    setStats(d);
    const { data } = await fetchStoreOrders(store.id);
    setPendingOrders((data ?? []).filter((o) => o.status === 'pending'));
  }, [store]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!store || !user) return;
    void registerForPushNotifications(user.id);

    const channel = supabase
      .channel(`orders-store-${store.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${store.id}`,
        },
        () => {
          void playOrderAlert();
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [store, user, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!store) return null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.storeName}>{store.name}</Text>
          <Badge
            text={store.is_online ? t('online') : t('offline')}
            color={store.is_online ? colors.online : colors.offline}
          />
        </View>
      </View>

      <View style={styles.stats}>
        <StatTile label={t('todayOrders')} value={String(stats.todayOrders)} />
        <View style={{ width: spacing.sm }} />
        <StatTile label={t('todaySales')} value={formatINR(stats.todaySales, true)} accent />
      </View>
      <View style={[styles.stats, { marginTop: spacing.sm }]}>
        <StatTile label={t('pendingOrders')} value={String(stats.pending)} />
        <View style={{ width: spacing.sm }} />
        <StatTile label={t('pendingKhata')} value={formatINR(stats.pendingKhata, true)} />
      </View>

      <SectionTitle
        title={t('pendingOrders')}
        action={t('viewAll')}
        onAction={() => router.push('/(owner)/(tabs)/orders')}
      />

      {pendingOrders.length === 0 ? (
        <Text style={styles.empty}>{t('noOrders')}</Text>
      ) : (
        pendingOrders.slice(0, 5).map((o) => (
          <Card key={o.id} style={styles.orderCard} onPress={() => router.push(`/(owner)/order-detail?id=${o.id}`)}>
            <View style={styles.orderRow}>
              <Text style={styles.orderNo}>{o.order_number}</Text>
              <Text style={styles.orderTotal}>{formatINR(Number(o.total))}</Text>
            </View>
            <Text style={styles.meta}>{t(o.payment_method)} · {o.items?.length ?? 0} {t('items')}</Text>
            <View style={styles.actions}>
              <Button
                title={t('accept')}
                style={{ flex: 1 }}
                large={false}
                onPress={async () => {
                  await updateOrderStatus(o.id, 'accepted');
                  void load();
                }}
              />
              <View style={{ width: 8 }} />
              <Button
                title={t('reject')}
                variant="danger"
                style={{ flex: 1 }}
                large={false}
                onPress={async () => {
                  await updateOrderStatus(o.id, 'rejected', 'Unavailable');
                  void load();
                }}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  header: { marginBottom: spacing.lg },
  storeName: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 8 },
  stats: { flexDirection: 'row' },
  empty: { color: colors.textMuted, paddingVertical: spacing.md },
  orderCard: { marginBottom: spacing.sm },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  orderNo: { fontWeight: '700', fontSize: 16, color: colors.text },
  orderTotal: { fontWeight: '800', fontSize: 16, color: colors.primary },
  meta: { color: colors.textMuted, marginTop: 4, marginBottom: spacing.sm },
  actions: { flexDirection: 'row' },
});
