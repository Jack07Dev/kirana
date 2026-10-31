import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { useOrderLiveSync } from '../../src/hooks/useOrderLiveSync';
import { formatINR, ORDER_STATUS_LABELS } from '../../src/lib/format';
import { confirmOrderPayment, fetchOrder, updateOrderStatus } from '../../src/lib/api';
import { notifyLocal } from '../../src/lib/notifications';
import type { Order } from '../../src/types/database';

export default function OrderDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [confirmingPay, setConfirmingPay] = useState(false);
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  useOrderLiveSync(id, setOrder);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void fetchOrder(id).then(({ data }) => {
        if (data) setOrder(data);
      });
    }, [id])
  );

  if (!order) return <View style={styles.screen} />;

  const st = ORDER_STATUS_LABELS[order.status];
  const setStatus = async (status: Order['status']) => {
    const { error } = await updateOrderStatus(order.id, status);
    if (error) Alert.alert(t('error'), error.message);
    else if (id) void fetchOrder(id).then(({ data }) => data && setOrder(data));
  };

  const onConfirmPayment = async () => {
    setConfirmingPay(true);
    const { data, error } = await confirmOrderPayment(order.id);
    setConfirmingPay(false);
    if (error) Alert.alert(t('error'), error.message);
    else {
      if (data) setOrder({ ...order, ...data });
      void notifyLocal(t('paymentSuccessBoth'), order.order_number);
      Alert.alert(t('paymentSuccessBoth'), order.order_number);
    }
  };

  const needsPaymentConfirm =
    order.payment_method === 'upi' && order.payment_status === 'pending';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.num}>{order.order_number}</Text>
        <Badge text={st?.[lang] ?? order.status} color={st?.color} />
      </View>

      {order.payment_method === 'upi' && order.payment_status === 'paid' ? (
        <View style={[styles.banner, styles.success]}>
          <Text style={styles.bannerTitle}>{t('paymentSuccessBoth')}</Text>
        </View>
      ) : null}

      {(order.items ?? []).map((item) => (
        <View key={item.id} style={styles.line}>
          <Text style={styles.itemName}>
            {item.product_name} × {item.quantity}
          </Text>
          <Text style={styles.itemPrice}>{formatINR(Number(item.line_total))}</Text>
        </View>
      ))}

      <View style={styles.totals}>
        <Row label={t('total')} value={formatINR(Number(order.subtotal))} />
        <Row label={t('deliveryFee')} value={t('free')} />
        <Row label={t('platformFee')} value={formatINR(Number(order.platform_fee))} />
        <Row label={t('total')} value={formatINR(Number(order.total))} bold />
        <Row label={t('payment')} value={t(order.payment_method)} />
        <Row
          label={t('paymentStatus')}
          value={order.payment_status === 'paid' ? t('paymentPaid') : t('paymentPending')}
        />
      </View>

      {needsPaymentConfirm && order.payment_claimed_at ? (
        <Text style={styles.alert}>{t('customerMarkedPaid')}</Text>
      ) : null}

      {needsPaymentConfirm ? (
        <Button
          title={t('confirmPayment')}
          variant="accent"
          onPress={onConfirmPayment}
          loading={confirmingPay}
        />
      ) : null}

      <View style={{ height: spacing.md }} />

      {order.status === 'pending' && (
        <View style={styles.actions}>
          <Button title={t('accept')} style={{ flex: 1 }} onPress={() => setStatus('accepted')} />
          <View style={{ width: 8 }} />
          <Button
            title={t('reject')}
            variant="danger"
            style={{ flex: 1 }}
            onPress={() => setStatus('rejected')}
          />
        </View>
      )}
      {order.status === 'accepted' && (
        <Button title={t('markOutForDelivery')} onPress={() => setStatus('out_for_delivery')} />
      )}
      {order.status === 'out_for_delivery' && (
        <Button title={t('markDelivered')} variant="accent" onPress={() => setStatus('delivered')} />
      )}
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
  content: { padding: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  num: { fontSize: 22, fontWeight: '800' },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { flex: 1, fontSize: 15, color: colors.text },
  itemPrice: { fontWeight: '600' },
  totals: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowLabel: { color: colors.textSecondary },
  rowValue: { color: colors.text, fontWeight: '600' },
  bold: { fontWeight: '800', fontSize: 17, color: colors.text },
  actions: { flexDirection: 'row' },
  alert: {
    color: colors.warning,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  banner: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  success: {},
  bannerTitle: { fontWeight: '800', fontSize: 17, textAlign: 'center', color: colors.text },
});
