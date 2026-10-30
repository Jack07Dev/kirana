import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { createAddress } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/authStore';

export default function AddressForm() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [label, setLabel] = useState('Home');
  const [house, setHouse] = useState('');
  const [landmark, setLandmark] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(user?.phone?.replace('+91', '') ?? '');
  const [isDefault, setIsDefault] = useState(true);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const useLoc = async () => {
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

  const onSave = async () => {
    if (!user || !house || !address || lat == null || lng == null) {
      Alert.alert(t('required'));
      return;
    }
    setLoading(true);
    const { error } = await createAddress({
      user_id: user.id,
      label,
      house_no: house,
      landmark: landmark || undefined,
      address_line: address,
      contact_phone: phone,
      lat,
      lng,
      is_default: isDefault,
    });
    setLoading(false);
    if (error) Alert.alert(t('error'), error.message);
    else router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Input label={t('addressLabel')} value={label} onChangeText={setLabel} />
      <Input label={t('houseNo')} value={house} onChangeText={setHouse} />
      <Input label={t('landmark')} value={landmark} onChangeText={setLandmark} />
      <Input
        label={t('storeAddress')}
        value={address}
        onChangeText={setAddress}
        multiline
      />
      <Input
        label={t('contactNumber')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <Button
        title={
          lat != null
            ? `${t('pinLocation')}: ${lat.toFixed(4)}, ${lng!.toFixed(4)}`
            : t('useCurrentLocation')
        }
        variant="secondary"
        onPress={useLoc}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('setAsDefault')}</Text>
        <Switch
          value={isDefault}
          onValueChange={setIsDefault}
          trackColor={{ true: colors.primary }}
        />
      </View>
      <Button title={t('save')} onPress={onSave} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  switchLabel: { fontWeight: '600', color: colors.text },
});
