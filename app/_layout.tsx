import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { FavoritesProvider } from '../src/context/FavoritesContext';
import { RoutineProvider } from '../src/context/RoutineContext';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
  return (
    <FavoritesProvider>
      <RoutineProvider>
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
          <Stack.Screen name="routine/[id]" options={{ title: 'Routine' }} />
          <Stack.Screen name="routine/[id]/add" options={{ title: 'Add Exercises', presentation: 'modal' }} />
        </Stack>
      </RoutineProvider>
    </FavoritesProvider>
  );
}
