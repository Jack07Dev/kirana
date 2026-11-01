import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const store = useAuthStore((s) => s.store);

  if (!session) return <Redirect href="/(auth)/phone" />;
  if (!user?.role) return <Redirect href="/(auth)/role" />;

  if (user.role === 'store_owner') {
    if (!store) return <Redirect href="/(owner)/setup" />;
    return <Redirect href="/(owner)/(tabs)/dashboard" />;
  }

  if (user.role === 'delivery_partner') {
    return <Redirect href="/(delivery)/(tabs)/orders" />;
  }

  return <Redirect href="/(customer)/(tabs)/home" />;
}
