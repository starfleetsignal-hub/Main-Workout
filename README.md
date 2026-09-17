# MuscleGuide

A mobile reference app for strength training and stretching, covering every
major muscle group in the body. Built with [Expo](https://expo.dev) /
React Native so a single codebase ships to iOS, Android, and web.

## What's in the app

- **24 muscles** across Upper Body, Core, Lower Body, and Neck
- For each muscle:
  - **Strength** — 3 exercises (Beginner → Advanced) with equipment,
    sets/reps, step-by-step instructions, coaching cues, and common mistakes
  - **Stretch** — 2 mobility/flexibility drills with hold times and frequency
  - **Anatomy** — origin, insertion, function, and joints involved, in plain
    language
  - **Safety notes** specific to that muscle
- **Search** across muscle names, aliases, and groups
- **Favorites** (persisted on-device with AsyncStorage)
- **About/Sources** screen with a medical disclaimer and a plain statement of
  what the content is (and isn't) based on

All exercise/stretch content is written to reflect mainstream, widely
published exercise-science consensus (the kind of programming principles
taught in strength & conditioning certifications, physical-therapy training,
and standard kinesiology references) — see the in-app About screen for the
exact wording. **It does not claim personal endorsement by any named doctor,
university, athlete, or coach** — don't add such claims to marketing copy
unless they're actually true, since false endorsement claims are a real
legal/App Store-rejection risk.

## Tech stack

- Expo SDK 57 (React Native 0.86, React 19)
- [expo-router](https://docs.expo.dev/router/introduction/) for file-based
  navigation (tabs + a muscle detail stack screen)
- TypeScript, strict mode
- `@react-native-async-storage/async-storage` for local favorites persistence
- `react-native-google-mobile-ads` for AdMob banner + interstitial ads
- No backend, no accounts, no in-app purchases — it's a one-time-purchase
  reference app, so all content ships in the app bundle

## Running it locally

```bash
npm install
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), or `w` (web) — or
scan the QR code with Expo Go on a physical device.

## Project structure

```
app/                    expo-router routes
  _layout.tsx           root stack (wraps favorites context)
  (tabs)/                bottom tab navigator
    index.tsx            Muscles (grouped list)
    search.tsx           Search
    favorites.tsx         Favorites
    about.tsx            About / sources / disclaimer
  muscle/[id].tsx        Muscle detail (Strength / Stretch / Anatomy tabs)
src/
  data/muscles.ts        the full muscle database (content lives here)
  data/types.ts          shared TypeScript types
  context/FavoritesContext.tsx
  components/            MuscleCard, ExerciseCard, StretchCard, SectionHeader
  theme/colors.ts
assets/                  app icon, adaptive icon, splash, favicon (generated)
```

To edit or extend the content (add a muscle, add an exercise variation,
tweak wording), everything lives in `src/data/muscles.ts` — no other file
needs to change for a content-only update.

## Ads (AdMob)

The app shows a banner ad on the Muscles/Search/Favorites tabs and an
interstitial ad every few muscle detail views, via
[`react-native-google-mobile-ads`](https://docs.page/invertase/react-native-google-mobile-ads).

- Ads use a native SDK, so **they only work in a development or production
  build — not in Expo Go.** Run `npx expo run:ios` / `npx expo run:android`,
  or build a dev client with `eas build --profile development`, to test them.
  They're intentionally a no-op on web.
- Out of the box the app ships with Google's public **test** app/ad unit IDs,
  so it builds and runs immediately and shows real (test) ad creatives
  without an AdMob account. No revenue is earned from test ads.
- To earn real revenue before release:
  1. Create an AdMob account and register the app to get a real App ID, plus
     a Banner and an Interstitial ad unit ID (separately for iOS/Android).
  2. Replace the test `androidAppId` / `iosAppId` in the
     `react-native-google-mobile-ads` plugin config in `app.json`.
  3. Replace `PRODUCTION_BANNER_AD_UNIT_ID` / `PRODUCTION_INTERSTITIAL_AD_UNIT_ID`
     in `src/ads/adUnits.ts` with your real ad unit IDs. (Dev builds always
     use test ads regardless of these values, so you won't see your own ads
     until you build in release mode.)
  4. Rebuild — changing native app IDs requires a fresh native build, not
     just a JS reload.
- Ad frequency (how often the interstitial shows) is controlled by
  `SHOW_EVERY_N_VIEWS` in `src/ads/interstitial.ts`.

## Building for the App Store / Play Store ($1.99 release)

This project uses [EAS Build](https://docs.expo.dev/build/introduction/),
Expo's cloud build service (a local Xcode/Android Studio setup also works if
you prefer).

1. Install the CLI and log in:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. Update `app.json` — set your real `ios.bundleIdentifier` and
   `android.package` (currently placeholders: `com.muscleguide.app`), and add
   an Apple `ios.buildNumber` / Android `android.versionCode` as needed.
3. Configure the project once:
   ```bash
   eas build:configure
   ```
4. Build for both stores:
   ```bash
   eas build --platform all --profile production
   ```
5. Submit:
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```
6. In App Store Connect / Google Play Console, set the price tier to $1.99
   and fill in the listing (screenshots, description, privacy policy — this
   app collects no personal data, so a simple "no data collected" privacy
   policy is typically sufficient, but confirm current store requirements
   before submitting).

## Content disclaimer

MuscleGuide is general fitness education, not medical advice. See the
About tab in the app for the full disclaimer that ships to users.
