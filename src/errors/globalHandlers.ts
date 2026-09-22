import { Platform, type ErrorUtils as ErrorUtilsType } from 'react-native';
import { recordCrash } from './crashLog';

let installed = false;

/**
 * Catches what a React error boundary can't: exceptions thrown outside a
 * render (timers, event handlers, native callbacks) and unhandled promise
 * rejections. Safe to call more than once; only the first call attaches
 * anything. Chains onto any existing handler rather than replacing it, so
 * React Native's own dev-mode red box still shows in development.
 */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (event) => {
      void recordCrash(event.error ?? event.message, 'window.onerror');
    });
    window.addEventListener('unhandledrejection', (event) => {
      void recordCrash(event.reason, 'unhandledrejection');
    });
    return;
  }

  const rnGlobal = globalThis as unknown as { ErrorUtils?: ErrorUtilsType };
  if (rnGlobal.ErrorUtils?.setGlobalHandler) {
    const previous = rnGlobal.ErrorUtils.getGlobalHandler?.();
    rnGlobal.ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      void recordCrash(error, isFatal ? 'fatal' : 'non-fatal');
      previous?.(error, isFatal);
    });
  }

  // Hermes supports the standard `unhandledrejection` event on recent RN versions;
  // feature-detected since older engines/builds may not have it.
  const listenable = globalThis as unknown as { addEventListener?: (type: string, listener: (event: { reason?: unknown }) => void) => void };
  if (typeof listenable.addEventListener === 'function') {
    try {
      listenable.addEventListener('unhandledrejection', (event) => {
        void recordCrash(event?.reason, 'unhandledrejection');
      });
    } catch {
      // best-effort; not every Hermes build supports this
    }
  }
}
