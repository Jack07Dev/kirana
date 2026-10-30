import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../../src/components/ui';
import { OpeningHoursEditor } from '../../../src/components/OpeningHoursEditor';
import { colors, spacing } from '../../../src/constants/theme';
import { DEFAULT_OPENING_HOURS } from '../../../src/constants/openingHours';
import { RADIUS_MAX, RADIUS_MIN } from '../../../src/lib/geo';
import { updateStore } from '../../../src/lib/api';
import { storePhotoPath, uploadImageFromUri } from '../../../src/lib/storage';
import { useAuthStore } from '../../../src/stores/authStore';
import type { OpeningHours } from '../../../src/types/database';

export default function OwnerStoreSettings() {
  const { t, i18n } = useTranslation();
  const store = useAuthStore((s) => s.store);
  const setStore = useAuthStore((s) => s.setStore);
  const setLanguage = useAuthStore((s) => s.setLanguage);
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const [radius, setRadius] = useState(store?.delivery_radius_m ?? 500);
  const [upi, setUpi] = useState(store?.upi_id ?? '');
  const [hours, setHours] = useState<OpeningHours>(
    store?.opening_hours ?? DEFAULT_OPENING_HOURS
  );
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!store) return;
    setRadius(store.delivery_radius_m);
    setUpi(store.upi_id ?? '');
    setHours(store.opening_hours ?? DEFAULT_OPENING_HOURS);
  }, [store?.id, store?.delivery_radius_m, store?.upi_id, store?.opening_hours]);

  if (!store) return null;

  const toggleOnline = async (value: boolean) => {
    const { data, error } = await updateStore(store.id, { is_online: value });
    if (error) Alert.alert(t('error'), error.message);
    else if (data) setStore(data);
  };

  const save = async () => {
    if (!store || !user) return;
    setSaving(true);
    let photo_url = store.photo_url ?? undefined;
    if (photoUri) {
      const { publicUrl, error: upErr } = await uploadImageFromUri(
        photoUri,
        'store-photos',
        storePhotoPath(user.id, store.id)
      );
      if (upErr) {
        setSaving(false);
        Alert.alert(t('error'), upErr);
        return;
      }
      if (publicUrl) photo_url = publicUrl;
    }

    const { data, error } = await updateStore(store.id, {
      delivery_radius_m: radius,
      upi_id: upi,
      opening_hours: hours,
      ...(photo_url ? { photo_url } : {}),
    });
    setSaving(false);
    if (error) Alert.alert(t('error'), error.message);
    else if (data) {
      setStore(data);
      setPhotoUri(null);
      Alert.alert(t('success'));
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!res.canceled) setPhotoUri(res.assets[0].uri);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{store.name}</Text>
      <Text style={styles.addr}>{store.address_line}</Text>

      <View style={styles.onlineRow}>
        <View>
          <Text style={styles.onlineLabel}>
            {store.is_online ? t('storeOnline') : t('storeOffline')}
          </Text>
          <Text style={styles.hint}>{t('radiusHint')}</Text>
        </View>
        <Switch
          value={store.is_online}
          onValueChange={toggleOnline}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      <Text style={styles.label}>{t('deliveryRadius')}</Text>
      <View style={styles.radiusRow}>
        <Button
          title="−"
          variant="secondary"
          large={false}
          style={{ minWidth: 64 }}
          onPress={() => setRadius((r) => Math.max(RADIUS_MIN, r - 50))}
        />
        <Text style={styles.radius}>
          {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}
        </Text>
        <Button
          title="+"
          variant="secondary"
          large={false}
          style={{ minWidth: 64 }}
          onPress={() => setRadius((r) => Math.min(RADIUS_MAX, r + 50))}
        />
      </View>

      <Button
        title={photoUri ? '✓ ' + t('storePhoto') : t('storePhoto')}
        variant="ghost"
        onPress={pickPhoto}
      />

      <OpeningHoursEditor value={hours} onChange={setHours} />

      <Input label={t('upiId')} value={upi} onChangeText={setUpi} autoCapitalize="none" />
      <Button title={t('save')} onPress={save} loading={saving} />

      <View style={{ height: spacing.xl }} />
      <Text style={styles.label}>{t('language')}</Text>
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

      <View style={{ height: spacing.xl }} />
      <Button title={t('logout')} variant="danger" onPress={() => signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  addr: { color: colors.textSecondary, marginBottom: spacing.lg, marginTop: 4 },
  onlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  onlineLabel: { fontWeight: '700', fontSize: 17, color: colors.text },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 2, maxWidth: 220 },
  label: { fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  radius: { fontSize: 22, fontWeight: '800', color: colors.primary },
  langRow: { flexDirection: 'row' },
});
