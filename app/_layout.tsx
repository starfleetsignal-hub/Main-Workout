import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CredentialsProvider } from '../src/context/CredentialsContext';
import { EngineProvider } from '../src/context/EngineContext';
import { LicenseProvider, useLicense } from '../src/context/LicenseContext';
import { colors } from '../src/theme/colors';

/**
 * The license gate lives here, at the root of the navigation tree.
 *
 * `Stack.Protected` unmounts every screen inside it while `guard` is false,
 * so an unlicensed copy cannot reach the trading UI by deep link, by
 * `router.push`, or by restoring a saved navigation state — the routes do
 * not exist. When a license lapses mid-session the guard flips and the user
 * is dropped back on the activation screen automatically.
 */
function RootNavigator() {
  const { isUnlocked, loaded } = useLicense();

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!isUnlocked}>
        <Stack.Screen name="activate" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={isUnlocked}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connect" options={{ title: 'Connect broker', presentation: 'modal' }} />
        <Stack.Screen name="symbol/[id]" options={{ title: '' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LicenseProvider>
        <CredentialsProvider>
          <EngineProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </EngineProvider>
        </CredentialsProvider>
      </LicenseProvider>
    </SafeAreaProvider>
  );
}
