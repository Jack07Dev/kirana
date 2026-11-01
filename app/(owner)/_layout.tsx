import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';

export default function OwnerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="setup" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product-form" options={{ title: 'Product' }} />
      <Stack.Screen name="catalog-picker" options={{ title: 'Catalog' }} />
      <Stack.Screen name="barcode-scan" options={{ title: 'Scan' }} />
      <Stack.Screen name="csv-upload" options={{ title: 'CSV' }} />
      <Stack.Screen name="order-detail" options={{ title: 'Order' }} />
      <Stack.Screen name="khata-detail" options={{ title: 'Khata' }} />
      <Stack.Screen name="stock-history" options={{ title: 'Stock history' }} />
      <Stack.Screen name="delivery-staff" options={{ title: 'Delivery staff' }} />
    </Stack>
  );
}
