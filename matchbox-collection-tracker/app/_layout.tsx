import { Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, useFonts } from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { CollectionProvider } from '../src/context/CollectionContext';
import { PreferencesProvider } from '../src/context/PreferencesContext';
import { colors } from '../src/theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
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
