import { Redirect } from 'expo-router';
import React from 'react';
import { useLicense } from '../src/context/LicenseContext';
import { useRisk } from '../src/context/RiskContext';

/**
 * The entry route only decides where to send the user. The real gates are
 * the two `Stack.Protected` blocks in `_layout.tsx`, which unmount the
 * trading routes (and the risk-acknowledgment route) entirely while the
 * corresponding condition is not met.
 */
export default function Index() {
  const { isUnlocked } = useLicense();
  const { acknowledged } = useRisk();

  if (!isUnlocked) return <Redirect href="/activate" />;
  if (!acknowledged) return <Redirect href="/risk-ack" />;
  return <Redirect href="/(tabs)/dashboard" />;
}
