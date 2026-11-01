import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Badge, Button, Card, EmptyState, textStyles } from '../../../src/components/ui';
import { StoresMap } from '../../../src/components/StoresMap';
import { colors, spacing } from '../../../src/constants/theme';
import { resolveCustomerLocation, refreshGpsLocation } from '../../../src/lib/customerLocation';
import { formatDistance } from '../../../src/lib/geo';
import { fetchFavourites, fetchNearbyStores } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/stores/authStore';
import { useCartStore } from '../../../src/stores/cartStore';
import type { NearbyStore, Store } from '../../../src/types/database';

export default function CustomerHome() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const cartCount = useCartStore((s) => s.itemCount());
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [favs, setFavs] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);
    try {
      const loc = await resolveCustomerLocation(user?.id);
      if (!loc.data) {
        setErrorKey(loc.error === 'no_location' ? 'locationSetupNeeded' : 'locationDenied');
        setStores([]);
        setCoords(null);
        setLoading(false);
        return;
      }

      setCoords({ lat: loc.data.lat, lng: loc.data.lng });
      setLocationLabel(loc.data.label ?? loc.data.source);

      const nearby = await fetchNearbyStores(loc.data.lat, loc.data.lng);
      setStores(nearby);
      if (user) {
        const f = await fetchFavourites(user.id);
        setFavs(f);
      }
    } catch (e) {
      setErrorKey(String(e));
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefreshGps = async () => {
    setLoading(true);
    const gps = await refreshGpsLocation();
    if (!gps) {
      setErrorKey('locationDenied');
      setLoading(false);
      return;
    }
    setCoords({ lat: gps.lat, lng: gps.lng });
    setLocationLabel('GPS');
    const nearby = await fetchNearbyStores(gps.lat, gps.lng);
    setStores(nearby);
    setLoading(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Text style={textStyles.brand}>{t('appName')}</Text>
        {cartCount > 0 ? (
          <Pressable style={styles.cartBtn} onPress={() => router.push('/(customer)/cart')}>
            <Text style={styles.cartText}>
              {t('cart')} ({cartCount})
            </Text>
          </Pressable>
        ) : null}
      </View>

      {locationLabel ? (
        <Text style={styles.locHint}>
          {t('deliveringNear')}: {locationLabel}
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : errorKey ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.error}>{t(errorKey)}</Text>
          <Button title={t('useCurrentLocation')} onPress={onRefreshGps} style={{ marginTop: 12 }} />
          <View style={{ height: 8 }} />
          <Button
            title={t('addAddress')}
            variant="secondary"
            onPress={() => router.push('/(customer)/address-form')}
          />
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              {coords ? (
                <StoresMap
                  customerLat={coords.lat}
                  customerLng={coords.lng}
                  stores={stores}
                  onStorePress={(id) => router.push(`/(customer)/store/${id}`)}
                />
              ) : null}
              <View style={styles.locActions}>
                <Button title={t('refreshLocation')} variant="ghost" large={false} onPress={onRefreshGps} />
              </View>
              {favs.length > 0 ? (
                <>
                  <Text style={styles.section}>{t('favourites')}</Text>
                  {favs.map((s) => (
                    <StoreCard
                      key={`f-${s.id}`}
                      store={{ ...s, distance_m: 0 }}
                      onPress={() => router.push(`/(customer)/store/${s.id}`)}
                      lang={lang}
                      t={t}
                      hideDistance
                    />
                  ))}
                </>
              ) : null}
              <Text style={styles.section}>{t('nearbyStores')}</Text>
            </>
          }
          ListEmptyComponent={<EmptyState title={t('noStoresNearby')} />}
          renderItem={({ item }) => (
            <StoreCard
              store={item}
              onPress={() => router.push(`/(customer)/store/${item.id}`)}
              lang={lang}
              t={t}
            />
          )}
          refreshing={loading}
          onRefresh={load}
        />
      )}
    </View>
  );
}

function StoreCard({
  store,
  onPress,
  lang,
  t,
  hideDistance,
}: {
  store: NearbyStore;
  onPress: () => void;
  lang: 'hi' | 'en';
  t: TFunction;
  hideDistance?: boolean;
}) {
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{store.name}</Text>
          <Text style={styles.addr} numberOfLines={1}>
            {store.address_line}
          </Text>
          {!hideDistance && store.distance_m != null ? (
            <Text style={styles.dist}>
              {t('away', { distance: formatDistance(store.distance_m, lang) })}
            </Text>
          ) : null}
        </View>
        <Badge
          text={store.is_online ? t('openNow') : t('closedNow')}
          color={store.is_online ? colors.success : colors.offline}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locHint: {
    paddingHorizontal: spacing.lg,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  cartBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cartText: { color: colors.white, fontWeight: '800' },
  list: { padding: spacing.lg, flexGrow: 1 },
  locActions: { marginBottom: spacing.sm },
  emptyWrap: { padding: spacing.lg, flex: 1 },
  section: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    color: colors.text,
  },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  addr: { color: colors.textSecondary, marginTop: 4 },
  dist: { color: colors.primary, fontWeight: '600', marginTop: 4, fontSize: 13 },
  error: { color: colors.danger, marginBottom: spacing.md, lineHeight: 22 },
});
