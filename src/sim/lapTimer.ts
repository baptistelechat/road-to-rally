import { FIXED_DT } from "./fixedStep";
import type { Pose, Track } from "./types";

export const CHECKPOINT_COUNT = 16;
/** Marge autour de la route pour valider un point de passage : une sortie large compte, un raccourci non. */
const CHECKPOINT_MARGIN = 6;
const CHECKPOINT_WINDOW = 60;

export interface LapTimer {
  /**
   * À appeler après chaque pas de simulation. Renvoie le temps en ms si un tour vient de se boucler ou si la spéciale s'achève.
   * `routeS`, sur un tracé ouvert : l'abscisse suivie sur la route. Tout point de passage qu'elle a dépassé est acquis,
   * même franchi dans le décor : la voiture a bien fait le chemin, sinon l'arrivée deviendrait impossible à valider.
   */
  update: (x: number, z: number, routeS?: number) => number | null;
  reset: () => void;
  /** Temps du tour en cours en ms, pénalités comprises, calculé en pas et non à l'horloge. `null` avant le premier pas. */
  currentMs: () => number | null;
  /** Ajoute une pénalité en ms entières au tour en cours, comptée dans `currentMs` et le temps final. */
  addPenalty: (ms: number) => void;
  /** Total des pénalités du tour en cours, en ms */
  penaltyMs: () => number;
  /** Nombre de pénalités du tour en cours */
  penaltyCount: () => number;
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
  let penalty = 0;
  let penalties = 0;
  let next = 1;
  let started = false;
  let finished = false;

  return {
    update: (x, z, routeS) => {
      if (finished) return null;
      if (routeS !== undefined)
        while (next < CHECKPOINT_COUNT && routeS - startS >= next * spacing)
          next++;
      const sample = track.nearest(x, z, routeS);
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
        return stepsToMs(steps) + penalty;
      }

      // Tous les points validés : le tour se boucle en repassant la ligne.
      if (onRoad && progress < CHECKPOINT_WINDOW) {
        const lapMs = stepsToMs(steps) + penalty;
        steps = 0;
        penalty = 0;
        penalties = 0;
        next = 1;
        return lapMs;
      }
      return null;
    },
    reset: () => {
      steps = 0;
      penalty = 0;
      penalties = 0;
      next = 1;
      started = false;
      finished = false;
    },
    currentMs: () => (started ? stepsToMs(steps) + penalty : null),
    addPenalty: (ms) => {
      if (finished) return;
      penalty += Math.round(ms);
      penalties++;
    },
    penaltyMs: () => penalty,
    penaltyCount: () => penalties,
    checkpoints: () => next - 1,
    finished: () => finished,
  };
};
