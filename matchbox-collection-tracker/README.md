# Matchbox Collector

A mobile app for Matchbox die-cast collectors: log the models you own, keep
a wish list of what you're hunting for, and browse a curated checklist that
spans Matchbox eras from the 1950s to today. Built with
[Expo](https://expo.dev) / React Native, sharing one codebase across iOS,
Android, and web.

This is a self-contained Expo project living alongside the unrelated
MuscleGuide app at the repo root — it has its own `package.json`,
`node_modules`, and config, so it's installed and run independently (see
below).

## Twofold: collecting + complete lists

- **My Garage** — your personal collection: every model you own, with
  color, condition, box status, quantity, purchase price/date, notes, and
  an optional photo.
- **Full Checklist** — a browsable master reference list grouped by series
  and year, with a live "X / Y owned" completion bar per filtered view.
  Tap **+** on anything you don't have yet to log it straight to your
  Garage or Wish List.
- **Wish List** — things you're chasing, separate from what you own, with
  a one-tap move into the Garage once you land it.
- **Personalize** — in Profile, pick the specific series you actively
  collect; the Home dashboard's "Series Tracking %" only counts those
  (or everything, if you leave it open).

## Data note

The master checklist (`src/data/catalog.ts`, ~165 entries) is a
hand-curated reference spanning well-known Matchbox eras and vehicle
types — it is **not** an official Mattel catalog, and the `#MB__` numbers
are a simple in-app browsing scheme, not real catalog numbers (those vary
by year, country, and reissue in ways that aren't practical to hand-author
accurately). Add any real item from the **Add** tab, whether or not it's
on the checklist — it's tracked as a custom entry either way. Extending
the curated list itself is a one-file change: `src/data/catalog.ts`.

## Tech stack

- Expo SDK 57 (React Native 0.86, React 19)
- [expo-router](https://docs.expo.dev/router/introduction/) for file-based
  navigation (5 tabs + modal/detail stack screens)
- TypeScript, strict mode
- `@react-native-async-storage/async-storage` for local persistence (no
  backend, no accounts)
- `expo-image-picker` / `expo-image` for attaching photos to entries

## Running it locally

```bash
cd matchbox-collection-tracker
npm install
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), or `w` (web) — or
scan the QR code with Expo Go on a physical device.

## Project structure

```
app/                      expo-router routes
  _layout.tsx              root stack (wraps Collection + Preferences contexts)
  (tabs)/
    index.tsx               Home dashboard
    collection.tsx           My Garage / Full Checklist (segmented)
    wishlist.tsx             Wish List
    profile.tsx              Personalize, stats, about, reset
    add.tsx                  intercepted — pushes the /add modal instead
  model/[id].tsx            catalog model detail (from Full Checklist)
  item/[id].tsx             personal entry detail (edit / delete / move)
  add.tsx                   add/edit form (modal)
src/
  data/catalog.ts           curated master checklist + helpers
  data/types.ts              shared TypeScript types
  context/CollectionContext.tsx   owned/wishlist CRUD (AsyncStorage)
  context/PreferencesContext.tsx  focus-series personalization (AsyncStorage)
  components/                EntryCard, ModelThumb, StatCard, SearchBar,
                              FilterChip/FilterSheet, SegmentedControl, etc.
  theme/                     colors, fonts
  utils/                     display resolution + stats helpers
assets/                    app icon, adaptive icon, splash, favicon
```

## Building for the App Store / Play Store

This project uses [EAS Build](https://docs.expo.dev/build/introduction/).

1. Install the CLI and log in:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. Update `app.json` — set your real `ios.bundleIdentifier` and
   `android.package` (currently placeholders:
   `com.matchboxcollector.app`), and swap in real branding assets in
   `assets/` (the shipped icon/splash are simple placeholders).
3. Configure and build:
   ```bash
   eas build:configure
   eas build --platform all --profile production
   ```
4. Submit with `eas submit --platform ios` / `--platform android`.
