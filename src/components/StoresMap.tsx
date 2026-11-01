import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors } from '../constants/theme';
import type { NearbyStore } from '../types/database';

type Props = {
  customerLat: number;
  customerLng: number;
  stores: NearbyStore[];
  onStorePress: (storeId: string) => void;
};

export function StoresMap({ customerLat, customerLng, stores, onStorePress }: Props) {
  if (Platform.OS === 'web') {
    return null;
  }

  const withCoords = stores.filter((s) => s.lat != null && s.lng != null);

  return (
    <View style={styles.wrap}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: customerLat,
          longitude: customerLng,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        <Marker
          coordinate={{ latitude: customerLat, longitude: customerLng }}
          title="You"
          pinColor={colors.accent}
        />
        {withCoords.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            title={s.name}
            description={s.address_line}
            pinColor={s.is_online ? colors.primary : colors.offline}
            onCalloutPress={() => onStorePress(s.id)}
            onPress={() => onStorePress(s.id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 220, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  map: { flex: 1 },
});
