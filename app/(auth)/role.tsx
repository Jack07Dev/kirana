import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, textStyles } from '../../src/components/ui';
import { colors, radii, spacing } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import type { UserRole } from '../../src/types/database';

export default function RoleScreen() {
  const { t } = useTranslation();
  const setRole = useAuthStore((s) => s.setRole);
  const loading = useAuthStore((s) => s.loading);
  const [role, setLocalRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const onContinue = async () => {
    if (!role || !name.trim()) {
      setError(t('required'));
      return;
    }
    const res = await setRole(role, name.trim());
    if (res.error) {
      setError(res.error);
      return;
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={textStyles.h1}>{t('chooseRole')}</Text>
        <View style={styles.cards}>
          <RoleCard
            selected={role === 'store_owner'}
            title={t('iamStoreOwner')}
            desc={t('storeOwnerDesc')}
            onPress={() => setLocalRole('store_owner')}
          />
          <RoleCard
            selected={role === 'customer'}
            title={t('iamCustomer')}
            desc={t('customerDesc')}
            onPress={() => setLocalRole('customer')}
          />
          <RoleCard
            selected={role === 'delivery_partner'}
            title={t('iamDeliveryPartner')}
            desc={t('deliveryPartnerDesc')}
            onPress={() => setLocalRole('delivery_partner')}
          />
        </View>
        <Input
          label={t('yourName')}
          value={name}
          onChangeText={setName}
          error={error}
        />
        <Button title={t('continue')} onPress={onContinue} loading={loading} />
      </View>
    </SafeAreaView>
  );
}

function RoleCard({
  selected,
  title,
  desc,
  onPress,
}: {
  selected: boolean;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.roleCard,
        selected && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
      ]}
    >
      <Text style={styles.roleTitle}>{title}</Text>
      <Text style={styles.roleDesc}>{desc}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  cards: { marginVertical: spacing.lg, gap: spacing.md },
  roleCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 100,
  },
  roleTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  roleDesc: { marginTop: 6, color: colors.textSecondary, fontSize: 15 },
});
