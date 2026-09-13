export type MuscleGroup = 'Upper Body' | 'Core' | 'Lower Body' | 'Neck';

export type ExerciseLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type PoseId =
  | 'standing'
  | 'armsUp'
  | 'armsOut'
  | 'armsForward'
  | 'curl'
  | 'hinge'
  | 'squat'
  | 'lunge'
  | 'pushUp'
  | 'bench'
  | 'bridge'
  | 'hangPull'
  | 'kneeling'
  | 'seatedReach'
  | 'sideLying'
  | 'standingReach';

export interface Exercise {
  name: string;
  level: ExerciseLevel;
  equipment: string;
  setsReps: string;
  pose: PoseId;
  instructions: string[];
  cues: string[];
  mistakes: string[];
}

export interface Stretch {
  name: string;
  type: 'Static' | 'Dynamic' | 'PNF';
  hold: string;
  pose: PoseId;
  instructions: string[];
  frequency: string;
}

export interface Anatomy {
  origin: string;
  insertion: string;
  function: string;
  joints: string;
}

export interface DiagramHighlight {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface Diagram {
  view: 'Front' | 'Back';
  highlights: DiagramHighlight[];
}

export interface Muscle {
  id: string;
  name: string;
  aliases: string[];
  group: MuscleGroup;
  short: string;
  diagram: Diagram;
  anatomy: Anatomy;
  strength: Exercise[];
  stretches: Stretch[];
  safety: string[];
}

// A single exercise or stretch, flattened out of the muscle database and
// tagged with where it came from — used by the routine builder's picker.
export interface CatalogEntry {
  entryId: string; // stable id: `${muscleId}:${kind}:${name}`
  kind: 'strength' | 'stretch';
  muscleId: string;
  muscleName: string;
  name: string;
  pose: PoseId;
  level?: ExerciseLevel;
  type?: 'Static' | 'Dynamic' | 'PNF';
  detail: string; // setsReps for strength, hold for stretch
  equipment?: string;
}

export interface RoutineItem extends CatalogEntry {
  id: string; // unique per-instance id (entryId + timestamp), since the same
  // exercise could theoretically be added twice
}

export interface Routine {
  id: string;
  name: string;
  createdAt: number;
  items: RoutineItem[];
}
