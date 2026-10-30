import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Button, Input, textStyles } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { RADIUS_MAX, RADIUS_MIN } from '../../src/lib/geo';
import { createStore, updateStore } from '../../src/lib/api';
import { DEFAULT_OPENING_HOURS } from '../../src/constants/openingHours';
import { OpeningHoursEditor } from '../../src/components/OpeningHoursEditor';
import { storePhotoPath, uploadImageFromUri } from '../../src/lib/storage';
import { useAuthStore } from '../../src/stores/authStore';
import type { OpeningHours } from '../../src/types/database';

/** Fallback slider if community slider missing — use simple buttons */
function RadiusControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View>
      <View style={styles.radiusRow}>
        <Button
          title="−"
          variant="secondary"
          style={{ flex: 0, minWidth: 64, minHeight: 48 }}
          large={false}
          onPress={() => onChange(Math.max(RADIUS_MIN, value - 50))}
        />
        <Text style={styles.radiusValue}>
          {value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value} m`}
        </Text>
        <Button
          title="+"
          variant="secondary"
          style={{ flex: 0, minWidth: 64, minHeight: 48 }}
          large={false}
          onPress={() => onChange(Math.min(RADIUS_MAX, value + 50))}
        />
      </View>
      {typeof Slider !== 'undefined' ? (
        <Slider
          minimumValue={RADIUS_MIN}
          maximumValue={RADIUS_MAX}
          step={50}
          value={value}
          onValueChange={onChange}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
      ) : null}
    </View>
  );
}

export default function StoreSetupScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setStore = useAuthStore((s) => s.setStore);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [upi, setUpi] = useState('');
  const [radius, setRadius] = useState(500);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_OPENING_HOURS);
  const [loading, setLoading] = useState(false);

  const useLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location permission needed');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setLat(pos.coords.latitude);
    setLng(pos.coords.longitude);
    const [geo] = await Location.reverseGeocodeAsync(pos.coords);
    if (geo && !address) {
      setAddress(
        [geo.name, geo.street, geo.district, geo.city, geo.postalCode]
          .filter(Boolean)
          .join(', ')
      );
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!res.canceled) setPhotoUri(res.assets[0].uri);
  };

  const onSave = async () => {
    if (!user || !name.trim() || !address.trim() || lat == null || lng == null) {
      Alert.alert(t('required'));
      return;
    }
    setLoading(true);
    const { data, error } = await createStore({
      owner_id: user.id,
      name: name.trim(),
      address_line: address.trim(),
      lat,
      lng,
      delivery_radius_m: radius,
      upi_id: upi || undefined,
      opening_hours: hours,
    });
    if (error || !data) {
      setLoading(false);
      Alert.alert(t('error'), error?.message);
      return;
    }

    let saved = data;
    if (photoUri) {
      const { publicUrl, error: upErr } = await uploadImageFromUri(
        photoUri,
        'store-photos',
        storePhotoPath(user.id, data.id)
      );
      if (upErr) Alert.alert(t('error'), upErr);
      else if (publicUrl) {
        const { data: withPhoto } = await updateStore(data.id, { photo_url: publicUrl });
        if (withPhoto) saved = withPhoto;
      }
    }

    setLoading(false);
    setStore(saved);
    router.replace('/(owner)/(tabs)/dashboard');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={textStyles.brand}>{t('appName')}</Text>
        <Text style={[textStyles.h1, { marginTop: spacing.md }]}>
          {t('createStore')}
        </Text>

        <Input label={t('storeName')} value={name} onChangeText={setName} />
        <Input
          label={t('storeAddress')}
          value={address}
          onChangeText={setAddress}
          multiline
        />
        <Input label={t('upiId')} value={upi} onChangeText={setUpi} autoCapitalize="none" />

        <Text style={styles.label}>{t('deliveryRadius')}</Text>
        <Text style={styles.hint}>{t('radiusHint')}</Text>
        <RadiusControl value={radius} onChange={setRadius} />

        <OpeningHoursEditor value={hours} onChange={setHours} />

        <View style={{ height: spacing.md }} />
        <Button
          title={
            lat != null
              ? `${t('pinLocation')}: ${lat.toFixed(4)}, ${lng!.toFixed(4)}`
              : t('useCurrentLocation')
          }
          variant="secondary"
          onPress={useLocation}
        />
        <View style={{ height: spacing.sm }} />
        <Button
          title={photoUri ? '✓ ' + t('storePhoto') : t('storePhoto')}
          variant="ghost"
          onPress={pickPhoto}
        />
        <View style={{ height: spacing.lg }} />
        <Button title={t('save')} onPress={onSave} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: 48 },
  label: { fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  hint: { color: colors.textMuted, marginBottom: spacing.sm, fontSize: 13 },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  radiusValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
});
