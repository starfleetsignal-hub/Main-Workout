import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { secureGet, secureSet } from '../storage/secure';

const DEVICE_ID_KEY = 'traderunner.device.v1';

/**
 * A stable per-install identifier, used only to count seats against a license.
 *
 * It is a random value generated on this device, not a hardware identifier:
 * the app never reads an IMEI, advertising ID or anything else that would
 * identify the person behind the device. Reinstalling produces a new id, which
 * is the usual tradeoff and the reason seat limits should be generous.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await secureGet(DEVICE_ID_KEY);
  if (existing && /^[0-9a-f-]{16,64}$/i.test(existing)) return existing;
  const id = Crypto.randomUUID();
  await secureSet(DEVICE_ID_KEY, id);
  return id;
}

/** A human-readable label so the seat list in your records is legible. */
export function getDeviceName(): string {
  switch (Platform.OS) {
    case 'ios':
      return 'iOS device';
    case 'android':
      return 'Android device';
    case 'web':
      return 'Web browser';
    case 'macos':
      return 'Mac';
    case 'windows':
      return 'Windows PC';
    default:
      return 'Device';
  }
}

export function getPlatform(): string {
  return `${Platform.OS}`;
}
