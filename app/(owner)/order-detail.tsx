import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button } from '../../src/components/ui';
import { colors, radii, spacing } from '../../src/constants/theme';
import { formatINR, ORDER_STATUS_LABELS } from '../../src/lib/format';
import {
  assignOrderDelivery,
  fetchDeliveryPartners,
  fetchOrder,
  updateOrderStatus,
} from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/authStore';
import type { DeliveryPartner, Order, OrderStatusHistoryEntry } from '../../src/types/database';

export default function OrderDetail() {
  const { t, i18n } = useTranslation();
  const store = useAuthStore((s) => s.store);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  const load = useCallback(() => {
    if (!id) return;
    void fetchOrder(id).then(({ data }) => setOrder(data));
    if (store) {
      void fetchDeliveryPartners(store.id).then(({ data }) => setPartners(data));
    }
  }, [id, store]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!order) return <View style={styles.screen} />;

  const st = ORDER_STATUS_LABELS[order.status];
  const setStatus = async (status: Order['status']) => {
    const { error } = await updateOrderStatus(order.id, status);
    if (error) Alert.alert(t('error'), error.message);
    else load();
  };

  const assignTo = async (partnerId: string) => {
    setAssigning(true);
    const { error } = await assignOrderDelivery(order.id, partnerId);
    setAssigning(false);
    setAssignOpen(false);
    if (error) Alert.alert(t('error'), error.message);
    else load();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.num}>{order.order_number}</Text>
        <Badge text={st?.[lang] ?? order.status} color={st?.color} />
      </View>

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
      </View>

      {(order.status_history ?? []).length > 0 ? (
        <View style={styles.timeline}>
          <Text style={styles.timelineTitle}>{t('orderTimeline')}</Text>
          {(order.status_history ?? []).map((h: OrderStatusHistoryEntry) => {
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
        <>
          <Button title={t('startPreparing')} onPress={() => setStatus('preparing')} />
          <View style={{ height: spacing.sm }} />
          <Button
            title={t('assignDelivery')}
            variant="secondary"
            onPress={() => setAssignOpen(true)}
          />
        </>
      )}
      {order.status === 'preparing' && (
        <Button title={t('markPacked')} onPress={() => setStatus('packed')} />
      )}
      {order.status === 'packed' && (
        <Button title={t('assignDelivery')} onPress={() => setAssignOpen(true)} />
      )}
      {order.status === 'out_for_delivery' && order.delivery ? (
        <View style={styles.assigned}>
          <Text style={styles.assignedLabel}>{t('deliveryAssigned')}</Text>
          <Text style={styles.assignedMeta}>
            {t('deliveryOtp')}: {order.delivery.delivery_otp}
          </Text>
        </View>
      ) : null}

      <Modal visible={assignOpen} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setAssignOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('pickDeliveryPartner')}</Text>
            {partners.length === 0 ? (
              <Text style={styles.modalEmpty}>{t('noDeliveryStaff')}</Text>
            ) : (
              partners.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.partnerPick}
                  disabled={assigning}
                  onPress={() => assignTo(p.id)}
                >
                  <Text style={styles.partnerPickName}>{p.display_name}</Text>
                  <Text style={styles.partnerPickPhone}>{p.phone}</Text>
                </Pressable>
              ))
            )}
            <Button title={t('cancel')} variant="ghost" onPress={() => setAssignOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
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
  timeline: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineTitle: { fontWeight: '800', marginBottom: spacing.sm },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  timelineStatus: { fontWeight: '600' },
  timelineTime: { color: colors.textMuted, fontSize: 12 },
  assigned: {
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
  },
  assignedLabel: { fontWeight: '700' },
  assignedMeta: { marginTop: 4, color: colors.textSecondary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
  modalEmpty: { color: colors.textMuted, marginBottom: spacing.md },
  partnerPick: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  partnerPickName: { fontWeight: '700' },
  partnerPickPhone: { color: colors.textSecondary, marginTop: 2 },
});
