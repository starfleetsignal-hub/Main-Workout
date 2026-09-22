import { Redirect } from 'expo-router';
import React from 'react';
import { useLicense } from '../src/context/LicenseContext';

/**
 * The entry route only decides where to send the user. The real gate is
 * `Stack.Protected` in `_layout.tsx`, which unmounts the trading routes
 * entirely while the app is locked.
 */
export default function Index() {
  const { isUnlocked } = useLicense();
  return <Redirect href={isUnlocked ? '/(tabs)/dashboard' : '/activate'} />;
}
