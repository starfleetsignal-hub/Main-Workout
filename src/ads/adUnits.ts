import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// Replace these with the real ad unit IDs from your AdMob console before
// submitting a production build. Until then every build (including release
// builds) serves Google's test ads, which is safe but earns no revenue.
const PRODUCTION_BANNER_AD_UNIT_ID: Partial<Record<typeof Platform.OS, string>> = {
  ios: 'ca-app-pub-REPLACE_ME/REPLACE_ME',
  android: 'ca-app-pub-REPLACE_ME/REPLACE_ME',
};

const PRODUCTION_INTERSTITIAL_AD_UNIT_ID: Partial<Record<typeof Platform.OS, string>> = {
  ios: 'ca-app-pub-REPLACE_ME/REPLACE_ME',
  android: 'ca-app-pub-REPLACE_ME/REPLACE_ME',
};

function resolve(ids: Partial<Record<typeof Platform.OS, string>>, testId: string): string {
  const id = ids[Platform.OS];
  if (__DEV__ || !id || id.includes('REPLACE_ME')) {
    return testId;
  }
  return id;
}

export const BANNER_AD_UNIT_ID = resolve(PRODUCTION_BANNER_AD_UNIT_ID, TestIds.BANNER);
export const INTERSTITIAL_AD_UNIT_ID = resolve(PRODUCTION_INTERSTITIAL_AD_UNIT_ID, TestIds.INTERSTITIAL);
