import { AdEventType, InterstitialAd } from 'react-native-google-mobile-ads';
import { INTERSTITIAL_AD_UNIT_ID } from './adUnits';

// Show an interstitial every Nth muscle detail view rather than every time,
// so ads stay a background revenue source instead of interrupting the
// content people came for.
const SHOW_EVERY_N_VIEWS = 4;

let ad: InterstitialAd | null = null;
let isLoaded = false;
let viewCount = 0;

function loadNextAd() {
  isLoaded = false;
  ad = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);
  ad.addAdEventListener(AdEventType.LOADED, () => {
    isLoaded = true;
  });
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    loadNextAd();
  });
  ad.addAdEventListener(AdEventType.ERROR, () => {
    isLoaded = false;
  });
  ad.load();
}

loadNextAd();

/** Call once per muscle detail view; shows an interstitial every few views. */
export function registerMuscleDetailView() {
  viewCount += 1;
  if (viewCount % SHOW_EVERY_N_VIEWS === 0 && ad && isLoaded) {
    ad.show();
  }
}
