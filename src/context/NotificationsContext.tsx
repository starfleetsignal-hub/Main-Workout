import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  configureNotifications,
  hasNotificationPermission,
  requestNotificationPermission,
  SUPPORTS_LOCAL_NOTIFICATIONS,
} from '../notifications/notifications';
import { prefGet, prefSet } from '../storage/secure';

const ENABLED_KEY = 'traderunner.alertsEnabled.v1';

interface NotificationsContextValue {
  loaded: boolean;
  /** The user's own preference, independent of OS permission. */
  enabled: boolean;
  /** Whether the OS has actually granted permission; null until checked. */
  permissionGranted: boolean | null;
  supported: boolean;
  /** Turns alerts on (prompting for permission if needed) or off. Resolves to whether alerts ended up enabled. */
  setEnabled: (next: boolean) => Promise<boolean>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  useEffect(() => {
    configureNotifications();
    (async () => {
      const [storedEnabled, granted] = await Promise.all([
        prefGet<boolean>(ENABLED_KEY, false),
        hasNotificationPermission(),
      ]);
      setPermissionGranted(granted);
      // A prior "on" preference is honored only if the OS permission still holds;
      // if it was revoked in system settings, the toggle reflects that truthfully.
      setEnabledState(storedEnabled && granted);
      setLoaded(true);
    })();
  }, []);

  const setEnabled = useCallback(async (next: boolean): Promise<boolean> => {
    if (!SUPPORTS_LOCAL_NOTIFICATIONS || !next) {
      setEnabledState(false);
      await prefSet(ENABLED_KEY, false);
      return false;
    }
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    setEnabledState(granted);
    await prefSet(ENABLED_KEY, granted);
    return granted;
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ loaded, enabled, permissionGranted, supported: SUPPORTS_LOCAL_NOTIFICATIONS, setEnabled }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside a NotificationsProvider');
  return ctx;
}
