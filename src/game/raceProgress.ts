// Frise, écarts aux intermédiaires et libellés de pénalité : ce que le HUD montre de l'avancée dans la spéciale.
import { CHECKPOINT_COUNT } from "@/sim/lapTimer";
import type { PenaltyEvent } from "@/sim/simulation";
import type { RaceCourse } from "@/sim/splits";
import type { Track } from "@/sim/types";
import type { HudStrip } from "./hudStore";
import type { StageRecord } from "./stageRecords";

type Course = Pick<Track, "startS" | "finishS">;

/** Sur le circuit, abscisse ramenée dans le tour en cours : de `course.startS` à `course.finishS`. */
export const lapS = (
  track: Pick<Track, "length">,
  course: RaceCourse,
  s: number,
): number =>
  course.startS + (((s - course.startS) % track.length) + track.length) % track.length;

/**
 * Avancée dans le tour du circuit, pour les intermédiaires. Bornée par les points de passage validés : reculer derrière
 * la ligne donnerait sinon un tour presque fini et franchirait tous les intermédiaires d'un coup.
 */
export const createCircuitProgress = (
  track: Pick<Track, "length" | "nearest">,
  course: RaceCourse,
) => {
  let last = course.startS;
  return {
    update: (x: number, z: number, checkpoints: number): number => {
      const s = lapS(track, course, track.nearest(x, z).s);
      if (s - course.startS <= ((checkpoints + 1) * track.length) / CHECKPOINT_COUNT)
        last = s;
      return last;
    },
    reset: (): void => {
      last = course.startS;
    },
  };
};

export const PENALTY_REASONS: Record<PenaltyEvent["reason"], string> = {
  hold: "Remise en piste",
  offroad: "Hors piste",
  wrongway: "Contresens",
};

/**
 * Temps de passage de référence. Un record sans temps de passage (repris de l'ancienne clé) donne une estimation
 * à allure constante, la même que celle du fantôme de secours : l'écart reste lisible dès la première course.
 */
export const referenceSplits = (
  record: StageRecord | null,
  gates: readonly number[],
  course: Course,
): readonly number[] | null => {
  if (!record) return null;
  if (record.splitsMs.length === gates.length) return record.splitsMs;
  const length = course.finishS - course.startS;
  return gates.map((s) => (record.totalMs * (s - course.startS)) / length);
};

/**
 * Écart de chaque secteur au même secteur du record : son temps propre, pas le cumul.
 * `times` : temps de passage déjà franchis, plus le temps d'arrivée s'il est connu.
 */
export const sectorDeltas = (
  sectors: number,
  times: readonly number[],
  reference: readonly number[] | null,
  referenceTotal: number | null,
): (number | null | undefined)[] =>
  Array.from({ length: sectors }, (_, i) => {
    if (i >= times.length) return undefined;
    const ref = i < sectors - 1 ? reference?.[i] : referenceTotal;
    if (ref === undefined || ref === null) return null;
    const refStart = i === 0 ? 0 : (reference?.[i - 1] ?? 0);
    return times[i] - (i === 0 ? 0 : times[i - 1]) - (ref - refStart);
  });

const fraction = (s: number, course: Course): number =>
  Math.min(1, Math.max(0, (s - course.startS) / (course.finishS - course.startS)));

export const buildStrip = (
  course: Course,
  gates: readonly number[],
  deltas: readonly (number | null | undefined)[],
  carS: number,
  ghostS: number | null,
): HudStrip => ({
  gates: gates.map((s) => fraction(s, course)),
  sectorDeltas: deltas,
  carFraction: fraction(carS, course),
  ghostFraction: ghostS === null ? null : fraction(ghostS, course),
});
