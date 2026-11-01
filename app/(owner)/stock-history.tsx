import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { fetchInventoryMovements } from '../../src/lib/api';
import type { InventoryMovement } from '../../src/types/database';

const TYPE_LABELS: Record<string, { en: string; hi: string }> = {
  sale: { en: 'Sale', hi: 'बिक्री' },
  restock: { en: 'Restock', hi: 'स्टॉक जोड़ा' },
  adjustment: { en: 'Adjustment', hi: 'समायोजन' },
  cancellation_release: { en: 'Order cancelled', hi: 'ऑर्डर रद्द' },
  status_override: { en: 'Status change', hi: 'स्टेटस बदला' },
};

export default function StockHistoryScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lang = i18n.language === 'hi' ? 'hi' : 'en';
  const [rows, setRows] = useState<InventoryMovement[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void fetchInventoryMovements(id).then(({ data }) => setRows(data));
    }, [id])
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title={t('noStockHistory')} />}
        renderItem={({ item }) => {
          const label = TYPE_LABELS[item.movement_type]?.[lang] ?? item.movement_type;
          const delta = Number(item.quantity_delta);
          const sign = delta > 0 ? '+' : '';
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.type}>{label}</Text>
                {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                <Text style={styles.date}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
              <Text style={[styles.delta, delta < 0 && styles.neg]}>
                {sign}
                {delta}
                {item.quantity_after != null ? (
                  <Text style={styles.after}> → {item.quantity_after}</Text>
                ) : null}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  type: { fontWeight: '700', color: colors.text },
  note: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  date: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  delta: { fontWeight: '800', fontSize: 16, color: colors.primary },
  neg: { color: colors.danger },
  after: { fontWeight: '600', color: colors.textMuted, fontSize: 14 },
});
