import { FIXED_DT } from "./fixedStep";
import type { Pose, Track } from "./types";

const CHECKPOINT_COUNT = 16;
/** Marge autour de la route pour valider un point de passage : une sortie large compte, un raccourci non. */
const CHECKPOINT_MARGIN = 6;
const CHECKPOINT_WINDOW = 60;

export interface LapTimer {
  /** À appeler après chaque pas de simulation. Renvoie le temps en ms si un tour vient de se boucler ou si la spéciale s'achève. */
  update: (x: number, z: number) => number | null;
  reset: () => void;
  /** Temps du tour en cours en ms, calculé en pas et non à l'horloge. `null` avant le premier pas. */
  currentMs: () => number | null;
  /** Nombre de points de passage validés dans le tour en cours */
  checkpoints: () => number;
  /** Arrivée franchie sur un tracé ouvert : le chrono reste figé jusqu'à `reset`. */
  finished: () => boolean;
}

const stepsToMs = (steps: number): number =>
  Math.round(steps * FIXED_DT * 1000);

export const createLapTimer = (track: Track, start: Pose): LapTimer => {
  // Tracé ouvert : de `startS` à `finishS`, sans bouclage, et un seul passage.
  const startS = track.closed
    ? track.nearest(start.position.x, start.position.z).s
    : track.startS;
  const course = track.closed ? track.length : track.finishS - track.startS;
  const spacing = course / CHECKPOINT_COUNT;
  let steps = 0;
  let next = 1;
  let started = false;
  let finished = false;

  return {
    update: (x, z) => {
      if (finished) return null;
      const sample = track.nearest(x, z);
      const progress = track.closed
        ? (sample.s - startS + track.length) % track.length
        : sample.s - startS;
      started = true;
      steps++;

      const onRoad = sample.distance <= sample.width / 2 + CHECKPOINT_MARGIN;
      if (next < CHECKPOINT_COUNT) {
        const target = next * spacing;
        if (
          onRoad &&
          progress >= target &&
          progress < target + CHECKPOINT_WINDOW
        )
          next++;
        return null;
      }

      if (!track.closed) {
        if (!onRoad || progress < course) return null;
        finished = true;
        return stepsToMs(steps);
      }

      // Tous les points validés : le tour se boucle en repassant la ligne.
      if (onRoad && progress < CHECKPOINT_WINDOW) {
        const lapMs = stepsToMs(steps);
        steps = 0;
        next = 1;
        return lapMs;
      }
      return null;
    },
    reset: () => {
      steps = 0;
      next = 1;
      started = false;
      finished = false;
    },
    currentMs: () => (started ? stepsToMs(steps) : null),
    checkpoints: () => next - 1,
    finished: () => finished,
  };
};
