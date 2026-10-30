import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
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

export async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) return null;

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

  const token = (
    await Notifications.getExpoPushTokenAsync()
  ).data;

  await supabase.from('users').update({ push_token: token }).eq('id', userId);
  return token;
}

let sound: Audio.Sound | null = null;

/** Play alert sound for store owners on new order */
export async function playOrderAlert() {
  try {
    if (sound) {
      await sound.replayAsync();
      return;
    }
    const { sound: s } = await Audio.Sound.createAsync(
      // bundled system-like beep via remote short tone; replace with local asset in production
      { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
      { shouldPlay: true, volume: 1 }
    );
    sound = s;
  } catch {
    // ignore audio failures on simulator
  }
}

export async function notifyLocal(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}
