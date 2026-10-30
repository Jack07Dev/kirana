import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../../../src/components/ui';
import { colors, spacing } from '../../../src/constants/theme';
import { fetchAddresses } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/stores/authStore';
import type { Address } from '../../../src/types/database';

export default function CustomerProfile() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setLanguage = useAuthStore((s) => s.setLanguage);
  const signOut = useAuthStore((s) => s.signOut);
  const [addresses, setAddresses] = useState<Address[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void fetchAddresses(user.id).then(({ data }) => setAddresses(data));
    }, [user])
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={addresses}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={
        <View>
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>

          <Text style={styles.section}>{t('language')}</Text>
          <View style={styles.langRow}>
            <Button
              title={t('hindi')}
              variant={i18n.language === 'hi' ? 'primary' : 'ghost'}
              style={{ flex: 1 }}
              large={false}
              onPress={() => setLanguage('hi')}
            />
            <View style={{ width: 8 }} />
            <Button
              title={t('english')}
              variant={i18n.language === 'en' ? 'primary' : 'ghost'}
              style={{ flex: 1 }}
              large={false}
              onPress={() => setLanguage('en')}
            />
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.section}>{t('myAddresses')}</Text>
            <Button
              title={t('addAddress')}
              variant="secondary"
              large={false}
              onPress={() => router.push('/(customer)/address-form')}
            />
          </View>
        </View>
      }
      ListFooterComponent={
        <Button
          title={t('logout')}
          variant="danger"
          style={{ marginTop: spacing.xl }}
          onPress={() => signOut()}
        />
      }
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.addr}>
            {item.house_no}, {item.address_line}
          </Text>
          {item.landmark ? (
            <Text style={styles.meta}>{item.landmark}</Text>
          ) : null}
          <Text style={styles.meta}>{item.contact_phone}</Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  name: { fontSize: 24, fontWeight: '800' },
  phone: { color: colors.textSecondary, marginBottom: spacing.lg },
  section: { fontWeight: '700', fontSize: 16, marginBottom: spacing.sm, marginTop: spacing.md },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  langRow: { flexDirection: 'row', marginBottom: spacing.md },
  card: { marginBottom: spacing.sm },
  label: { fontWeight: '700', color: colors.primary },
  addr: { marginTop: 4, color: colors.text },
  meta: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
});
