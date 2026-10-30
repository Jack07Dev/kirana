import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Input } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { formatINR } from '../../src/lib/format';
import { fetchCatalog } from '../../src/lib/api';
import type { CatalogItem } from '../../src/types/database';

export default function CatalogPicker() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    void fetchCatalog(q || undefined).then(({ data }) => setItems(data));
  }, [q]);

  return (
    <View style={styles.screen}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Input placeholder={t('search')} value={q} onChangeText={setQ} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const name = i18n.language === 'hi' ? item.name_hi : item.name_en;
          return (
            <Card
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/(owner)/product-form',
                  params: {
                    catalogId: item.id,
                    catalogName: name,
                    catalogMrp: String(item.default_mrp ?? ''),
                    catalogUnit: item.unit,
                    barcode: item.barcode ?? '',
                  },
                })
              }
            >
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.meta}>
                {item.brand ? `${item.brand} · ` : ''}
                {item.category}
                {item.default_mrp != null
                  ? ` · MRP ${formatINR(item.default_mrp)}`
                  : ''}
              </Text>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg },
  card: { marginBottom: spacing.sm },
  name: { fontWeight: '700', fontSize: 16 },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
});
