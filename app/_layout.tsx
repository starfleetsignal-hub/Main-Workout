import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { FavoritesProvider } from '../src/context/FavoritesContext';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
  return (
    <FavoritesProvider>
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
        <Stack.Screen name="muscle/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
      </Stack>
    </FavoritesProvider>
  );
}
