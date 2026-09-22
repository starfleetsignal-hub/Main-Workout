import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import { Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Starfield } from '../src/components/Starfield';
import { CredentialsProvider } from '../src/context/CredentialsContext';
import { EngineProvider } from '../src/context/EngineContext';
import { LicenseProvider, useLicense } from '../src/context/LicenseContext';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * React Navigation's own screen container paints `theme.colors.background`
 * underneath every screen, independent of `contentStyle`. Left at its
 * built-in default that is an opaque light gray that sits above the
 * starfield and blanks it out. Setting it to `transparent` here is what
 * actually lets the starfield show through — `contentStyle: transparent` on
 * the Stack alone is not enough.
 */
const cosmicNavigationTheme: Theme = {
  dark: true,
  colors: {
    primary: colors.gold,
    background: 'transparent',
    card: colors.card,
    text: colors.text,
    border: colors.cardLine,
    notification: colors.down,
  },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: '400' },
    medium: { fontFamily: fonts.medium, fontWeight: '500' },
    bold: { fontFamily: fonts.bold, fontWeight: '700' },
    heavy: { fontFamily: fonts.bold, fontWeight: '700' },
  },
};

/**
 * The license gate lives here, at the root of the navigation tree.
 *
 * `Stack.Protected` unmounts every screen inside it while `guard` is false,
 * so an unlicensed copy cannot reach the trading UI by deep link, by
 * `router.push`, or by restoring a saved navigation state — the routes do
 * not exist. When a license lapses, is revoked, or exceeds its device
 * allowance mid-session, the guard flips and the user lands back on the
 * activation screen automatically.
 */
function RootNavigator() {
  const { isUnlocked, loaded } = useLicense();

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerTransparent: true,
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Protected guard={!isUnlocked}>
        <Stack.Screen name="activate" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={isUnlocked}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="venues" options={{ title: 'Choose a venue', presentation: 'modal' }} />
        <Stack.Screen name="connect" options={{ title: 'Connect', presentation: 'modal' }} />
        <Stack.Screen name="symbol/[id]" options={{ title: '' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.bgBottom }}>
        <Starfield />
        <ThemeProvider value={cosmicNavigationTheme}>
          <LicenseProvider>
            <CredentialsProvider>
              <EngineProvider>
                <StatusBar style="light" />
                <RootNavigator />
              </EngineProvider>
            </CredentialsProvider>
          </LicenseProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}
