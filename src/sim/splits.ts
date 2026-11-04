import type { Track } from "./types";

/** Spéciale ou tour coupé en secteurs égaux : deux intermédiaires, quelle que soit la longueur */
const SECTORS = 3;

export interface SplitCrossing {
  /** Rang de l'intermédiaire, à partir de 0 */
  index: number;
  /** Temps de passage en ms, pénalités comprises */
  ms: number;
}

export interface SplitTracker {
  /** Abscisses des intermédiaires, croissantes, strictement entre `startS` et `finishS` de la portion chronométrée */
  gates: readonly number[];
  /**
   * À appeler après chaque pas. `routeS` : abscisse suivie (`sim.routeS()`), seule à dire quel passage d'un aller-retour.
   * `elapsedMs` : `sim.lap.currentMs()`, `null` avant le départ. Renvoie le dernier intermédiaire franchi à ce pas.
   */
  update: (routeS: number, elapsedMs: number | null) => SplitCrossing | null;
  reset: () => void;
  /** Temps de passage déjà franchis, dans l'ordre */
  times: () => readonly number[];
}

/**
 * Abscisses des intermédiaires d'une spéciale de longueur `course` dont le départ est en `startS`, croissantes.
 * Seule source de leur position : la course, l'éditeur et la frise les placent au même endroit.
 */
export const splitGates = (startS: number, course: number): number[] =>
  Array.from(
    { length: SECTORS - 1 },
    (_, i) => startS + (course * (i + 1)) / SECTORS,
  );

/** Portion chronométrée, en abscisses de la piste */
export interface RaceCourse {
  startS: number;
  finishS: number;
}

/**
 * Spéciale : de la ligne de départ à celle d'arrivée. Circuit : un tour depuis la voiture posée au départ, comme le
 * chrono (`createLapTimer`) ; `finishS` dépasse alors `length`, à ramener modulo la longueur pour placer un point.
 */
export const raceCourse = (
  track: Pick<Track, "closed" | "startS" | "finishS" | "length" | "nearest" | "startPose">,
): RaceCourse => {
  if (!track.closed) return { startS: track.startS, finishS: track.finishS };
  const { x, z } = track.startPose.position;
  const startS = track.nearest(x, z).s;
  return { startS, finishS: startS + track.length };
};

/**
 * Intermédiaires régulièrement répartis sur la portion chronométrée. Sur le circuit, `routeS` est l'avancée dans le
 * tour ramenée sur `course` (voir `useGameLoop`), et `reset` repart à chaque tour.
 */
export const createSplitTracker = (course: RaceCourse): SplitTracker => {
  const gates = splitGates(course.startS, course.finishS - course.startS);
  const times: number[] = [];

  return {
    gates,
    update: (routeS, elapsedMs) => {
      if (elapsedMs === null) return null;
      let crossed: SplitCrossing | null = null;
      // L'abscisse suivie ne recule qu'à la remise en piste : un intermédiaire franchi le reste.
      while (times.length < gates.length && routeS >= gates[times.length]) {
        crossed = { index: times.length, ms: elapsedMs };
        times.push(elapsedMs);
      }
      return crossed;
    },
    reset: () => {
      times.length = 0;
    },
    times: () => times,
  };
};

/** Écart au temps de passage du record : négatif = plus rapide. `null` sans record ou sans ce passage. */
export const splitDelta = (
  best: readonly number[] | undefined,
  crossing: SplitCrossing,
): number | null => {
  const reference = best?.[crossing.index];
  return reference === undefined ? null : crossing.ms - reference;
};
