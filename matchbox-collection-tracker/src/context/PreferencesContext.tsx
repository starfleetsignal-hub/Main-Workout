import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'matchboxcollector.prefs.v1';

interface Preferences {
  focusSeries: string[];
}

const DEFAULT_PREFS: Preferences = { focusSeries: [] };

interface PreferencesContextValue {
  focusSeries: string[];
  isFocused: (series: string) => boolean;
  toggleFocusSeries: (series: string) => void;
  clearFocusSeries: () => void;
  loaded: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.focusSeries)) setPrefs(parsed);
        } catch {
          // ignore corrupt storage
        }
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleFocusSeries = useCallback((series: string) => {
    setPrefs((prev) => {
      const next: Preferences = {
        ...prev,
        focusSeries: prev.focusSeries.includes(series)
          ? prev.focusSeries.filter((s) => s !== series)
          : [...prev.focusSeries, series],
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearFocusSeries = useCallback(() => {
    const next: Preferences = { ...DEFAULT_PREFS };
    setPrefs(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const isFocused = useCallback((series: string) => prefs.focusSeries.includes(series), [prefs]);

  const value = useMemo(
    () => ({ focusSeries: prefs.focusSeries, isFocused, toggleFocusSeries, clearFocusSeries, loaded }),
    [prefs, isFocused, toggleFocusSeries, clearFocusSeries, loaded]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
