import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { bulkInsertProducts } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/authStore';

type CsvRow = {
  name?: string;
  mrp?: string;
  selling_price?: string;
  unit?: string;
  category?: string;
  barcode?: string;
};

export default function CsvUpload() {
  const { t } = useTranslation();
  const store = useAuthStore((s) => s.store);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(0);

  const pick = async () => {
    if (!store) return;
    const file = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
      copyToCacheDirectory: true,
    });
    if (file.canceled || !file.assets?.[0]) return;

    setLoading(true);
    try {
      const res = await fetch(file.assets[0].uri);
      const text = await res.text();
      const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });
      const rows = parsed.data
        .filter((r) => r.name && r.mrp && r.selling_price)
        .map((r) => ({
          store_id: store.id,
          name: String(r.name).trim(),
          mrp: parseFloat(String(r.mrp)),
          selling_price: parseFloat(String(r.selling_price)),
          unit: r.unit?.trim() || 'pcs',
          category: r.category?.trim() || 'other',
          barcode: r.barcode?.trim() || undefined,
          stock_status: 'in_stock' as const,
          is_active: true,
        }));

      setPreview(rows.length);
      if (!rows.length) {
        Alert.alert(t('error'), t('csvHint'));
        setLoading(false);
        return;
      }

      const { error } = await bulkInsertProducts(rows);
      if (error) Alert.alert(t('error'), error.message);
      else {
        Alert.alert(t('success'), `${rows.length} products`);
        router.back();
      }
    } catch (e) {
      Alert.alert(t('error'), String(e));
    }
    setLoading(false);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.hint}>{t('csvHint')}</Text>
      <Text style={styles.example}>
        name,mrp,selling_price,unit,category,barcode{'\n'}
        Tata Salt 1kg,28,26,kg,staples,8901262010012
      </Text>
      {preview > 0 ? <Text style={styles.preview}>{preview} rows ready</Text> : null}
      <Button title={t('uploadCsv')} onPress={pick} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  hint: { color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 22 },
  example: {
    fontFamily: 'Courier',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
    color: colors.text,
    fontSize: 12,
  },
  preview: { marginBottom: spacing.md, fontWeight: '700', color: colors.primary },
});
