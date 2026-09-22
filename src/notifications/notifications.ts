import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { colors } from '../theme/colors';

const ALERTS_CHANNEL_ID = 'alerts';

/**
 * expo-notifications has no web implementation for scheduling or channels
 * (only permissions fall back to the browser Notification API), so alerts
 * are a native-only feature. Gating on this up front means the rest of the
 * app never has to guess why a call silently did nothing on web.
 */
export const SUPPORTS_LOCAL_NOTIFICATIONS = Platform.OS === 'ios' || Platform.OS === 'android';

let configured = false;

/** Sets the foreground presentation behavior and creates the Android channel. Safe to call more than once. */
export function configureNotifications(): void {
  if (configured || !SUPPORTS_LOCAL_NOTIFICATIONS) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(ALERTS_CHANNEL_ID, {
      name: 'Trading alerts',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: colors.gold,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

function isGranted(settings: Notifications.NotificationPermissionsStatus): boolean {
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Checks the current permission without prompting. */
export async function hasNotificationPermission(): Promise<boolean> {
  if (!SUPPORTS_LOCAL_NOTIFICATIONS) return false;
  try {
    return isGranted(await Notifications.getPermissionsAsync());
  } catch {
    return false;
  }
}

/** Prompts the user, if the OS hasn't already decided. Returns whether alerts can fire. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!SUPPORTS_LOCAL_NOTIFICATIONS) return false;
  try {
    configureNotifications();
    const settings = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
    return isGranted(settings);
  } catch {
    return false;
  }
}

/** Fires a local notification immediately. Best-effort — a failure here must never affect trading. */
export async function notify(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  if (!SUPPORTS_LOCAL_NOTIFICATIONS) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: 'default' },
      trigger: Platform.OS === 'android' ? { channelId: ALERTS_CHANNEL_ID } : null,
    });
  } catch {
    // Local notifications are a convenience; swallow failures rather than surface them to a trading session.
  }
}
