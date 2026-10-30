import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Input } from '../../src/components/ui';
import { colors, radii, spacing } from '../../src/constants/theme';
import { formatINR } from '../../src/lib/format';
import {
  fetchAddresses,
  fetchCustomerKhata,
  placeOrder,
} from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useCartStore } from '../../src/stores/cartStore';
import type { Address, PaymentMethod } from '../../src/types/database';

export default function Checkout() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const items = useCartStore((s) => s.items);
  const storeId = useCartStore((s) => s.storeId);
  const subtotal = useCartStore((s) => s.subtotal());
  const clear = useCartStore((s) => s.clear);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cod');
  const [khataOk, setKhataOk] = useState(false);
  const [platformFee, setPlatformFee] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [upiId, setUpiId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void fetchAddresses(user.id).then(({ data }) => {
        setAddresses(data);
        const def = data.find((a) => a.is_default) ?? data[0];
        if (def) setAddressId(def.id);
      });
      if (storeId) {
        void supabase
          .from('stores')
          .select('platform_fee,upi_id')
          .eq('id', storeId)
          .single()
          .then(({ data }) => {
            setPlatformFee(Number(data?.platform_fee ?? 0));
            setUpiId(data?.upi_id ?? null);
          });
        void fetchCustomerKhata(user.id).then(({ data }) => {
          const acc = data.find(
            (a) => a.store_id === storeId && a.is_enabled
          );
          setKhataOk(!!acc && Number(acc.balance) < Number(acc.credit_limit));
        });
      }
    }, [user, storeId])
  );

  const total = subtotal + platformFee; // delivery always 0

  const onPlace = async () => {
    if (!user || !storeId || !addressId || !items.length) {
      Alert.alert(t('required'));
      return;
    }
    setLoading(true);

    if (method === 'upi' && upiId) {
      const upi = `upi://pay?pa=${encodeURIComponent(upiId)}&am=${total}&cu=INR&tn=Kirana%20Order`;
      try {
        await Linking.openURL(upi);
      } catch {
        // continue — store confirms payment manually for MVP
      }
    }

    const { data, error } = await placeOrder({
      store_id: storeId,
      customer_id: user.id,
      address_id: addressId,
      payment_method: method,
      platform_fee: platformFee,
      notes: notes || undefined,
      items: items.map((i) => ({
        product_id: i.product.id,
        product_name: i.product.name,
        unit: i.product.unit,
        quantity: i.quantity,
        mrp: i.product.mrp,
        selling_price: i.product.selling_price,
      })),
    });
    setLoading(false);
    if (error || !data) {
      Alert.alert(t('error'), error?.message);
      return;
    }
    clear();
    Alert.alert(t('orderPlaced'), data.order_number);
    router.replace(`/(customer)/order/${data.id}`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.section}>{t('selectAddress')}</Text>
      {addresses.map((a) => (
        <Pressable key={a.id} onPress={() => setAddressId(a.id)}>
          <Card
            style={[
              styles.card,
              addressId === a.id ? styles.selected : undefined,
            ]}
          >
            <Text style={styles.addrTitle}>{a.label}</Text>
            <Text>
              {a.house_no}, {a.address_line}
            </Text>
          </Card>
        </Pressable>
      ))}
      <Button
        title={t('addAddress')}
        variant="ghost"
        large={false}
        onPress={() => router.push('/(customer)/address-form')}
      />

      <Text style={styles.section}>{t('paymentMethod')}</Text>
      {(['cod', 'upi', ...(khataOk ? (['khata'] as const) : [])] as PaymentMethod[]).map(
        (m) => (
          <Pressable key={m} onPress={() => setMethod(m)}>
            <Card style={[styles.card, method === m ? styles.selected : undefined]}>
              <Text style={styles.pay}>{t(m)}</Text>
            </Card>
          </Pressable>
        )
      )}

      <Input label={t('note')} value={notes} onChangeText={setNotes} />

      <View style={styles.totals}>
        <Row label={t('total')} value={formatINR(subtotal)} />
        <Row label={t('deliveryFee')} value={t('free')} />
        <Row label={t('platformFee')} value={formatINR(platformFee)} />
        <Row label={t('total')} value={formatINR(total)} bold />
      </View>

      <Button title={t('placeOrder')} onPress={onPlace} loading={loading} />
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
  content: { padding: spacing.lg, paddingBottom: 48 },
  section: { fontWeight: '700', fontSize: 16, marginVertical: spacing.sm },
  card: { marginBottom: spacing.sm },
  selected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  addrTitle: { fontWeight: '700', marginBottom: 4, color: colors.primary },
  pay: { fontWeight: '700', fontSize: 16 },
  totals: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginVertical: spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowLabel: { color: colors.textSecondary },
  rowValue: { fontWeight: '600' },
  bold: { fontWeight: '800', fontSize: 17, color: colors.text },
});
