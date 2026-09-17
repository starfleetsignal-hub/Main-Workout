import { Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, useFonts } from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { initializeAds } from '../src/ads/init';
import { FavoritesProvider } from '../src/context/FavoritesContext';
import { RoutineProvider } from '../src/context/RoutineContext';
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

  useEffect(() => {
    initializeAds();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <FavoritesProvider>
      <RoutineProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="muscle/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
          <Stack.Screen name="routine/[id]" options={{ title: 'Routine' }} />
          <Stack.Screen name="routine/[id]/add" options={{ title: 'Add Exercises', presentation: 'modal' }} />
        </Stack>
      </RoutineProvider>
    </FavoritesProvider>
  );
}
