import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** EAS project UUID — required for Expo push tokens (not available in Expo Go). */
function getExpoProjectId(): string | undefined {
  const fromConfig =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  return (fromConfig || fromEnv) || undefined;
}

function canRegisterRemotePush(): boolean {
  if (!Device.isDevice) return false;
  // Remote push / Expo push tokens are not supported in Expo Go (SDK 53+).
  if (Constants.appOwnership === 'expo') return false;
  return Boolean(getExpoProjectId());
}

export async function registerForPushNotifications(userId: string) {
  if (!canRegisterRemotePush()) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Orders',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 400, 200, 400],
      });
    }

    const projectId = getExpoProjectId()!;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    await supabase.from('users').update({ push_token: token }).eq('id', userId);
    return token;
  } catch (e) {
    if (__DEV__) {
      console.warn('[Kirana] Push registration skipped:', e instanceof Error ? e.message : e);
    }
    return null;
  }
}

const ALERT_URI = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

type AlertPlayer = {
  seekTo: (seconds: number) => Promise<void>;
  play: () => void;
};

let player: AlertPlayer | null = null;

/** Play alert sound for store owners on new order. Loaded lazily so Expo Go can start without expo-av. */
export async function playOrderAlert() {
  try {
    if (!player) {
      const { createAudioPlayer } = await import('expo-audio');
      player = createAudioPlayer(ALERT_URI);
    }
    await player.seekTo(0);
    player.play();
  } catch {
    // Expo Go or the simulator may not play this tone
  }
}

export async function notifyLocal(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}
