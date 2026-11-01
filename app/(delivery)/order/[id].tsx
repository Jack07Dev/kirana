import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Input } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatINR, ORDER_STATUS_LABELS, formatPhone } from '../../../src/lib/format';
import {
  fetchPartnerAssignments,
  partnerMarkPickedUp,
  partnerVerifyDelivery,
} from '../../../src/lib/api';
import type { Address, DeliveryAssignment, Order } from '../../../src/types/database';

type AssignmentRow = DeliveryAssignment & {
  order?: Order & { address?: Address | null; items?: Order['items'] };
};

export default function PartnerOrderDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  const load = useCallback(() => {
    if (!id) return;
    void fetchPartnerAssignments().then(({ data }) => {
      const row = (data as AssignmentRow[] | null)?.find((a) => a.order_id === id) ?? null;
      setAssignment(row);
    });
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const order = assignment?.order;
  if (!order) return <View style={styles.screen} />;

  const st = ORDER_STATUS_LABELS[order.status];
  const addr = order.address;

  const openMaps = () => {
    if (addr?.lat == null || addr?.lng == null) return;
    const q = `${addr.lat},${addr.lng}`;
    void Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  const onPickup = async () => {
    setBusy(true);
    const { error } = await partnerMarkPickedUp(order.id);
    setBusy(false);
    if (error) Alert.alert(t('error'), error.message);
    else load();
  };

  const onVerify = async () => {
    const code = otp.replace(/\D/g, '');
    if (code.length !== 6) {
      Alert.alert(t('error'), t('deliveryOtpInvalid'));
      return;
    }
    setBusy(true);
    const { error } = await partnerVerifyDelivery(order.id, code);
    setBusy(false);
    if (error) Alert.alert(t('error'), error.message);
    else {
      Alert.alert(t('success'), t('deliveryComplete'));
      load();
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.num}>{order.order_number}</Text>
        <Badge text={st?.[lang] ?? order.status} color={st?.color} />
      </View>

      {addr ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t('deliverTo')}</Text>
          <Text style={styles.addrText}>
            {addr.house_no}, {addr.address_line}
          </Text>
          {addr.landmark ? <Text style={styles.addrText}>{addr.landmark}</Text> : null}
          <Text style={styles.addrText}>{formatPhone(addr.contact_phone)}</Text>
          {addr.lat != null && addr.lng != null ? (
            <Button title={t('openInMaps')} variant="ghost" onPress={openMaps} />
          ) : null}
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
        <Text style={styles.cod}>
          {t('payment')}: {t(order.payment_method)} · {formatINR(Number(order.total))}
        </Text>
      </View>

      {order.status === 'out_for_delivery' && !assignment.picked_up_at ? (
        <Button title={t('markPickedUp')} onPress={onPickup} loading={busy} />
      ) : null}

      {order.status === 'out_for_delivery' && assignment.picked_up_at ? (
        <View style={styles.otpBlock}>
          <Text style={styles.otpHint}>{t('enterCustomerOtp')}</Text>
          <Input
            label={t('deliveryOtp')}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button title={t('confirmDelivery')} onPress={onVerify} loading={busy} />
        </View>
      ) : null}

      {order.status === 'delivered' ? (
        <Text style={styles.done}>{t('deliveryComplete')}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  num: { fontSize: 22, fontWeight: '800' },
  block: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockTitle: { fontWeight: '700', marginBottom: 6, color: colors.text },
  addrText: { color: colors.textSecondary, lineHeight: 22 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { flex: 1, fontSize: 15, color: colors.text },
  itemPrice: { fontWeight: '600' },
  totals: { marginVertical: spacing.lg },
  cod: { fontWeight: '700', fontSize: 16 },
  otpBlock: { marginTop: spacing.md, gap: spacing.sm },
  otpHint: { color: colors.textSecondary, marginBottom: spacing.sm },
  done: { textAlign: 'center', color: colors.primary, fontWeight: '800', marginTop: spacing.lg },
});
