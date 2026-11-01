import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatINR, ORDER_STATUS_LABELS } from '../../../src/lib/format';
import { cancelCustomerOrder, fetchOrder } from '../../../src/lib/api';
import { notifyLocal } from '../../../src/lib/notifications';
import { supabase } from '../../../src/lib/supabase';
import type { Order } from '../../../src/types/database';

export default function CustomerOrderDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  const load = useCallback(() => {
    if (!id) return;
    void fetchOrder(id).then(({ data }) => setOrder(data));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`order-customer-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const next = payload.new as Order;
          void load();
          const st = ORDER_STATUS_LABELS[next.status];
          void notifyLocal(t('orderUpdate'), st?.[lang] ?? next.status);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, lang, t, load]);

  if (!order) return <View style={styles.screen} />;

  const st = ORDER_STATUS_LABELS[order.status];
  const store = order.store as { name?: string } | undefined;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.num}>{order.order_number}</Text>
        <Badge text={st?.[lang] ?? order.status} color={st?.color} />
      </View>
      {store?.name ? <Text style={styles.store}>{store.name}</Text> : null}

      {(order.items ?? []).map((item) => (
        <View key={item.id} style={styles.line}>
          <Text style={styles.itemName}>
            {item.product_name} × {item.quantity}
          </Text>
          <Text style={styles.itemPrice}>{formatINR(Number(item.line_total))}</Text>
        </View>
      ))}

      <View style={styles.totals}>
        <Row label={t('subtotal')} value={formatINR(Number(order.subtotal))} />
        <Row label={t('deliveryFee')} value={t('free')} />
        <Row label={t('platformFee')} value={formatINR(Number(order.platform_fee))} />
        <Row label={t('total')} value={formatINR(Number(order.total))} bold />
        <Row label={t('payment')} value={t(order.payment_method)} />
      </View>

      {order.status === 'out_for_delivery' && order.delivery?.delivery_otp ? (
        <View style={styles.otpBox}>
          <Text style={styles.otpTitle}>{t('deliveryOtp')}</Text>
          <Text style={styles.otpCode}>{order.delivery.delivery_otp}</Text>
          <Text style={styles.otpHint}>{t('deliveryOtpHint')}</Text>
        </View>
      ) : null}

      {(order.status_history ?? []).length > 0 ? (
        <View style={styles.timeline}>
          <Text style={styles.timelineTitle}>{t('orderTimeline')}</Text>
          {(order.status_history ?? []).map((h) => {
            const lbl = ORDER_STATUS_LABELS[h.to_status];
            return (
              <View key={h.id} style={styles.timelineRow}>
                <Text style={styles.timelineStatus}>{lbl?.[lang] ?? h.to_status}</Text>
                <Text style={styles.timelineTime}>
                  {new Date(h.created_at).toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {order.status === 'pending' ? (
        <Button
          title={t('cancelOrder')}
          variant="danger"
          onPress={() => {
            Alert.alert(t('cancelOrder'), t('cancelOrderConfirm'), [
              { text: t('cancel'), style: 'cancel' },
              {
                text: t('confirm'),
                style: 'destructive',
                onPress: async () => {
                  const { error } = await cancelCustomerOrder(order.id);
                  if (error) Alert.alert(t('error'), error.message);
                  else load();
                },
              },
            ]);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  num: { fontSize: 20, fontWeight: '800', color: colors.text },
  store: { color: colors.textSecondary, marginBottom: spacing.lg },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { flex: 1, color: colors.text, fontWeight: '600' },
  itemPrice: { fontWeight: '700', color: colors.primary },
  totals: { marginTop: spacing.lg, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: colors.textSecondary },
  rowValue: { color: colors.text, fontWeight: '600' },
  bold: { fontWeight: '800', color: colors.text, fontSize: 17 },
  otpBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    alignItems: 'center',
  },
  otpTitle: { fontWeight: '700', color: colors.textSecondary },
  otpCode: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 8,
    color: colors.primary,
    marginVertical: spacing.sm,
  },
  otpHint: { textAlign: 'center', color: colors.textSecondary, lineHeight: 20 },
  timeline: { marginTop: spacing.lg, gap: 8 },
  timelineTitle: { fontWeight: '800', color: colors.text },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineStatus: { fontWeight: '600', color: colors.text },
  timelineTime: { color: colors.textMuted, fontSize: 12 },
});
