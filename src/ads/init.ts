import mobileAds from 'react-native-google-mobile-ads';

export function initializeAds() {
  mobileAds().initialize().catch(() => {});
}
