import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../src/components/ui';
import { OrderUpiPaymentBlock } from '../../../src/components/OrderUpiPaymentBlock';
import { colors, spacing } from '../../../src/constants/theme';
import { useOrderLiveSync } from '../../../src/hooks/useOrderLiveSync';
import { formatINR, ORDER_STATUS_LABELS } from '../../../src/lib/format';
import { claimCustomerUpiPayment } from '../../../src/lib/api';
import { notifyLocal } from '../../../src/lib/notifications';
import type { Order } from '../../../src/types/database';

export default function CustomerOrderDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [reference, setReference] = useState('');
  const [claiming, setClaiming] = useState(false);
  const prevPaymentStatus = useRef<string | null>(null);
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  useOrderLiveSync(id, setOrder);

  useEffect(() => {
    if (!order) return;
    if (order.payment_status === 'paid' && prevPaymentStatus.current === 'pending') {
      void notifyLocal(t('paymentSuccessBoth'), order.order_number);
    }
    prevPaymentStatus.current = order.payment_status;
  }, [order, t]);

  const onClaimPaid = async () => {
    if (!order) return;
    setClaiming(true);
    const { data, error } = await claimCustomerUpiPayment(order.id, reference);
    setClaiming(false);
    if (error) {
      Alert.alert(t('error'), error.message);
      return;
    }
    if (data) {
      setOrder(data);
      Alert.alert(t('paymentSubmitted'), t('paymentClaimed'));
    }
  };

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

      <Row
        label={t('paymentStatus')}
        value={order.payment_status === 'paid' ? t('paymentPaid') : t('paymentPending')}
      />

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

      <OrderUpiPaymentBlock
        order={order}
        reference={reference}
        onReferenceChange={setReference}
        claiming={claiming}
        onClaimPaid={onClaimPaid}
      />
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
  store: { color: colors.textSecondary, marginBottom: spacing.sm },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { flex: 1, color: colors.text, fontWeight: '600' },
  itemPrice: { fontWeight: '700', color: colors.primary },
  totals: { marginTop: spacing.lg, gap: 8, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: colors.textSecondary },
  rowValue: { color: colors.text, fontWeight: '600' },
  bold: { fontWeight: '800', color: colors.text, fontSize: 17 },
});
