import { useCallback, useState, memo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Badge, Card, EmptyState, textStyles } from '../../../src/components/ui';
import { OptimizedList } from '../../../src/components/OptimizedList';
import { colors, spacing } from '../../../src/constants/theme';
import { formatDistance } from '../../../src/lib/geo';
import { fetchFavourites, fetchNearbyStores } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/stores/authStore';
import { cartSelectors, useCartStore } from '../../../src/stores/cartStore';
import type { NearbyStore, Store } from '../../../src/types/database';

export default function CustomerHome() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const cartCount = useCartStore(cartSelectors.itemCount);
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [favs, setFavs] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission needed');
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nearby = await fetchNearbyStores(
        pos.coords.latitude,
        pos.coords.longitude
      );
      setStores(nearby);
      if (user) {
        const f = await fetchFavourites(user.id);
        setFavs(f);
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

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

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <OptimizedList
          flex
          data={stores}
          estimatedItemSize={96}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
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

const StoreCard = memo(function StoreCard({
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
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cartText: { color: colors.white, fontWeight: '800' },
  list: { padding: spacing.lg, flexGrow: 1 },
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
  error: { color: colors.danger, marginBottom: spacing.md },
});
