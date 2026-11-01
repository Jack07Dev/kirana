import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Card, EmptyState } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { formatINR, ORDER_STATUS_LABELS } from '../../../src/lib/format';
import { fetchPartnerAssignments } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/stores/authStore';
import type { DeliveryAssignment, Order } from '../../../src/types/database';

type AssignmentRow = DeliveryAssignment & { order?: Order | null };

export default function PartnerOrders() {
  const { t, i18n } = useTranslation();
  const partner = useAuthStore((s) => s.deliveryPartner);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      void fetchPartnerAssignments().then(({ data }) =>
        setRows((data ?? []) as AssignmentRow[])
      );
    }, [refreshProfile])
  );

  if (!partner) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title={t('deliveryNotLinked')}
          subtitle={t('deliveryNotLinkedHint')}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(a) => a.id}
      ListEmptyComponent={<EmptyState title={t('noDeliveries')} />}
      renderItem={({ item }) => {
        const order = item.order;
        if (!order) return null;
        const st = ORDER_STATUS_LABELS[order.status];
        return (
          <Card
            style={styles.card}
            onPress={() => router.push(`/(delivery)/order/${order.id}`)}
          >
            <View style={styles.row}>
              <Text style={styles.num}>{order.order_number}</Text>
              <Badge text={st?.[lang] ?? order.status} color={st?.color} />
            </View>
            <Text style={styles.total}>{formatINR(Number(order.total))}</Text>
            {item.picked_up_at ? null : (
              <Text style={styles.meta}>{t('awaitingPickup')}</Text>
            )}
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, flexGrow: 1 },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  num: { fontWeight: '700', fontSize: 16 },
  total: { fontWeight: '800', color: colors.primary, marginTop: 6, fontSize: 18 },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
});
