import { Linking, StyleSheet, Text, View } from 'react-native';
import { CachedImage } from './CachedImage';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { Button } from './ui';
import { colors, radii, spacing } from '../constants/theme';
import { formatINR } from '../lib/format';
import { buildUpiPayUri } from '../lib/upi';

type Props = {
  upiId: string;
  amount: number;
  payNote: string;
  upiQrUrl?: string | null;
  compact?: boolean;
};

export function UpiPayCard({ upiId, amount, payNote, upiQrUrl, compact }: Props) {
  const { t } = useTranslation();
  const uri = buildUpiPayUri(upiId, amount, payNote);

  const openUpi = async () => {
    try {
      await Linking.openURL(uri);
    } catch {
      // fallback shown via upiId text
    }
  };

  return (
    <View style={[styles.card, compact && styles.compact]}>
      <Text style={styles.title}>{t('payViaUpi')}</Text>
      <Text style={styles.amount}>{formatINR(amount)}</Text>
      <Text style={styles.vpa}>{upiId}</Text>

      {upiQrUrl ? (
        <CachedImage uri={upiQrUrl} style={styles.uploadedQr} contentFit="contain" />
      ) : (
        <View style={styles.qrWrap}>
          <QRCode value={uri} size={compact ? 160 : 200} backgroundColor="#fff" />
        </View>
      )}

      <Text style={styles.hint}>{t('scanQrOrOpenUpi')}</Text>
      <Button title={t('openUpiApp')} onPress={openUpi} variant="secondary" large={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compact: { padding: spacing.sm },
  title: { fontWeight: '700', fontSize: 16, color: colors.text, marginBottom: 4 },
  amount: { fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  vpa: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  qrWrap: {
    padding: spacing.sm,
    backgroundColor: '#fff',
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  uploadedQr: {
    width: 200,
    height: 200,
    marginBottom: spacing.sm,
    borderRadius: radii.sm,
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
