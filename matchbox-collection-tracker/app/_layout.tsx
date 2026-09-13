import { Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, useFonts } from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { CollectionProvider } from '../src/context/CollectionContext';
import { PreferencesProvider } from '../src/context/PreferencesContext';
import { colors } from '../src/theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

// A slow or blocked network (e.g. a sandboxed preview host) can leave the
// font fetch neither resolved nor rejected — never gate the whole app on it.
const FONT_LOAD_TIMEOUT_MS = 3000;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });
  const [timedOut, setTimedOut] = useState(false);
  const ready = fontsLoaded || !!fontError || timedOut;

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setTimedOut(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <PreferencesProvider>
      <CollectionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="model/[id]" options={{ title: 'Model Detail', headerBackTitle: 'Back' }} />
          <Stack.Screen name="item/[id]" options={{ title: 'My Entry', headerBackTitle: 'Back' }} />
          <Stack.Screen
            name="add"
            options={{ title: 'Add to Collection', presentation: 'modal' }}
          />
        </Stack>
      </CollectionProvider>
    </PreferencesProvider>
  );
}
