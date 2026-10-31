import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Input } from './ui';
import { UpiPayCard } from './UpiPayCard';
import { colors, radii, spacing } from '../constants/theme';
import {
  formatPaymentCountdown,
  getUpiPaymentExpiresAt,
  isUpiPaymentWindowExpired,
  upiPaymentSecondsLeft,
} from '../lib/paymentWindow';
import type { Order, Store } from '../types/database';

type Props = {
  order: Order;
  reference: string;
  onReferenceChange: (v: string) => void;
  claiming: boolean;
  onClaimPaid: () => void;
};

export function OrderUpiPaymentBlock({
  order,
  reference,
  onReferenceChange,
  claiming,
  onClaimPaid,
}: Props) {
  const { t } = useTranslation();
  const store = order.store as Store | undefined;
  const [secondsLeft, setSecondsLeft] = useState(() => upiPaymentSecondsLeft(order));
  const expiresMs = getUpiPaymentExpiresAt(order);

  useEffect(() => {
    setSecondsLeft(upiPaymentSecondsLeft(order));
    const tick = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, [expiresMs, order.payment_claimed_at, order.payment_status]);

  if (order.payment_method !== 'upi' || !store?.upi_id) return null;

  if (order.payment_status === 'paid') {
    return (
      <View style={[styles.banner, styles.success]}>
        <Text style={styles.bannerTitle}>{t('paymentSuccessBoth')}</Text>
        <Text style={styles.bannerSub}>{order.order_number}</Text>
      </View>
    );
  }

  const expired = isUpiPaymentWindowExpired(order);
  const claimed = Boolean(order.payment_claimed_at);

  if (claimed) {
    return (
      <View style={[styles.banner, styles.waiting]}>
        <Text style={styles.bannerTitle}>{t('paymentSubmitted')}</Text>
        <Text style={styles.bannerSub}>{t('paymentClaimed')}</Text>
        {secondsLeft > 0 ? (
          <Text style={styles.timer}>{t('paymentWindowLeft', { time: formatPaymentCountdown(secondsLeft) })}</Text>
        ) : null}
      </View>
    );
  }

  if (expired) {
    return (
      <View style={[styles.banner, styles.expired]}>
        <Text style={styles.bannerTitle}>{t('paymentWindowExpired')}</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.timerBox}>
        <Text style={styles.timerLabel}>{t('payWithin')}</Text>
        <Text style={styles.timerValue}>{formatPaymentCountdown(secondsLeft)}</Text>
      </View>
      <UpiPayCard
        upiId={store.upi_id}
        amount={Number(order.total)}
        payNote={order.order_number}
        upiQrUrl={store.upi_qr_url}
      />
      <Input
        label={t('paymentReference')}
        value={reference}
        onChangeText={onReferenceChange}
        autoCapitalize="characters"
      />
      <Button title={t('iHavePaid')} onPress={onClaimPaid} loading={claiming} />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
  },
  success: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  waiting: {
    backgroundColor: '#FEF3C7',
    borderColor: colors.warning,
  },
  expired: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  bannerTitle: { fontWeight: '800', fontSize: 17, color: colors.text, textAlign: 'center' },
  bannerSub: {
    marginTop: 6,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
  },
  timer: { marginTop: 8, textAlign: 'center', fontWeight: '600', color: colors.warning },
  timerBox: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  timerLabel: { color: colors.textSecondary, fontSize: 13 },
  timerValue: { fontSize: 28, fontWeight: '800', color: colors.primary, fontVariant: ['tabular-nums'] },
});
