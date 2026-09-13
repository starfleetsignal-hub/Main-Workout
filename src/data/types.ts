export type MuscleGroup = 'Upper Body' | 'Core' | 'Lower Body' | 'Neck';

export type ExerciseLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Exercise {
  name: string;
  level: ExerciseLevel;
  equipment: string;
  setsReps: string;
  instructions: string[];
  cues: string[];
  mistakes: string[];
}

export interface Stretch {
  name: string;
  type: 'Static' | 'Dynamic' | 'PNF';
  hold: string;
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
