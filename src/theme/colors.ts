export const colors = {
  bg: '#0B0E14',
  bgElevated: '#12161F',
  card: '#161B26',
  cardBorder: '#232A38',
  text: '#E9EDF5',
  textMuted: '#9AA4B8',
  textFaint: '#5F6B80',
  accent: '#3B82F6',
  accentSoft: 'rgba(59, 130, 246, 0.14)',
  up: '#22C55E',
  upSoft: 'rgba(34, 197, 94, 0.14)',
  down: '#EF4444',
  downSoft: 'rgba(239, 68, 68, 0.14)',
  warn: '#F59E0B',
  warnSoft: 'rgba(245, 158, 11, 0.14)',
  divider: '#212836',
  shadow: 'rgba(0, 0, 0, 0.5)',
  onAccent: '#FFFFFF',
  gold: '#E2B341',
  goldSoft: 'rgba(226, 179, 65, 0.14)',
};

export function pnlColor(n: number): string {
  if (n > 0) return colors.up;
  if (n < 0) return colors.down;
  return colors.textMuted;
}

export const statusColors: Record<string, string> = {
  stopped: colors.textFaint,
  starting: colors.warn,
  running: colors.up,
  halted: colors.down,
  error: colors.down,
  off: colors.textFaint,
  connecting: colors.warn,
  connected: colors.up,
  reconnecting: colors.warn,
};
