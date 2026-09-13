import { PoseId } from './types';

export interface PoseSpec {
  circle: { cx: number; cy: number; r: number };
  paths: string[];
}

// A small library of reusable stick-figure pictograms (64x64 viewBox).
// Every exercise/stretch points at one of these by id rather than getting
// a bespoke drawing, so the icon set stays small and visually consistent.
export const POSES: Record<PoseId, PoseSpec> = {
  standing: {
    circle: { cx: 32, cy: 12, r: 6 },
    paths: ['M32,18 L32,38', 'M32,20 L22,34', 'M32,20 L42,34', 'M32,38 L26,58', 'M32,38 L38,58'],
  },
  armsUp: {
    circle: { cx: 32, cy: 10, r: 6 },
    paths: ['M32,16 L32,38', 'M32,18 L20,6', 'M32,18 L44,6', 'M32,38 L26,58', 'M32,38 L38,58'],
  },
  armsOut: {
    circle: { cx: 32, cy: 12, r: 6 },
    paths: ['M32,18 L32,40', 'M32,20 L12,20', 'M32,20 L52,20', 'M32,40 L26,58', 'M32,40 L38,58'],
  },
  armsForward: {
    circle: { cx: 32, cy: 12, r: 6 },
    paths: ['M32,18 L32,40', 'M32,20 L16,10', 'M32,20 L48,10', 'M32,40 L26,58', 'M32,40 L38,58'],
  },
  curl: {
    circle: { cx: 32, cy: 12, r: 6 },
    paths: ['M32,18 L32,40', 'M32,20 L20,32 L26,18', 'M32,20 L44,32 L38,18', 'M32,40 L26,58', 'M32,40 L38,58'],
  },
  hinge: {
    circle: { cx: 18, cy: 22, r: 6 },
    paths: ['M18,28 L34,42', 'M22,30 L14,42', 'M26,32 L34,44', 'M34,42 L30,60', 'M34,42 L38,60'],
  },
  squat: {
    circle: { cx: 32, cy: 10, r: 6 },
    paths: ['M32,16 L32,30', 'M32,18 L18,22', 'M32,18 L46,22', 'M32,30 L22,38 L24,58', 'M32,30 L42,38 L40,58'],
  },
  lunge: {
    circle: { cx: 32, cy: 10, r: 6 },
    paths: ['M32,16 L32,32', 'M32,18 L22,26', 'M32,18 L42,26', 'M32,32 L20,42 L18,58', 'M32,32 L46,44 L52,58'],
  },
  pushUp: {
    circle: { cx: 10, cy: 30, r: 6 },
    paths: ['M16,30 L44,32', 'M22,31 L22,46', 'M44,32 L58,34'],
  },
  bench: {
    circle: { cx: 10, cy: 32, r: 6 },
    paths: ['M16,32 L36,32', 'M20,32 L14,18', 'M26,32 L26,16', 'M36,32 L44,22', 'M44,22 L54,28'],
  },
  bridge: {
    circle: { cx: 10, cy: 34, r: 6 },
    paths: ['M16,34 L30,30', 'M18,33 L18,44', 'M30,30 L40,20', 'M40,20 L52,26'],
  },
  hangPull: {
    circle: { cx: 32, cy: 16, r: 6 },
    paths: ['M14,8 L50,8', 'M32,10 L20,8', 'M32,10 L44,8', 'M32,22 L32,42', 'M32,42 L27,58', 'M32,42 L37,58'],
  },
  kneeling: {
    circle: { cx: 14, cy: 24, r: 6 },
    paths: ['M18,28 L42,34', 'M20,29 L20,46', 'M42,34 L44,48 L36,52'],
  },
  seatedReach: {
    circle: { cx: 14, cy: 18, r: 6 },
    paths: ['M16,22 L24,36', 'M20,26 L38,34', 'M24,36 L46,38', 'M46,38 L50,32'],
  },
  sideLying: {
    circle: { cx: 12, cy: 16, r: 6 },
    paths: ['M16,20 L34,30', 'M18,21 L26,30', 'M34,30 L48,26', 'M34,30 L50,36'],
  },
  standingReach: {
    circle: { cx: 32, cy: 12, r: 6 },
    paths: ['M32,18 L32,40', 'M32,20 L46,14', 'M32,20 L22,32', 'M32,40 L26,58', 'M32,40 L38,58'],
  },
};
