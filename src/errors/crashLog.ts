import { prefGet, prefSet } from '../storage/secure';

const CRASH_LOG_KEY = 'traderunner.crashLog.v1';
const MAX_ENTRIES = 20;

export interface CrashEntry {
  id: string;
  at: number;
  message: string;
  stack?: string;
  /** Where it was caught: a component stack, "window.onerror", "unhandledrejection", etc. */
  context?: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

/**
 * Appends one crash to a small on-device log (no third-party crash reporting
 * service is wired up — this stays local, like the rest of the app's data).
 * Never throws: recording a crash must not itself become an unhandled error.
 */
export async function recordCrash(error: unknown, context?: string): Promise<void> {
  try {
    const entry: CrashEntry = {
      id: `crash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      message: errorMessage(error),
      stack: errorStack(error),
      context,
    };
    const existing = await prefGet<CrashEntry[]>(CRASH_LOG_KEY, []);
    await prefSet(CRASH_LOG_KEY, [entry, ...existing].slice(0, MAX_ENTRIES));
  } catch {
    // best-effort only
  }
}

export async function getCrashLog(): Promise<CrashEntry[]> {
  return prefGet<CrashEntry[]>(CRASH_LOG_KEY, []);
}

export async function clearCrashLog(): Promise<void> {
  await prefSet(CRASH_LOG_KEY, []);
}
