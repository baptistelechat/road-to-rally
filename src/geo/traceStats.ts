// Mesures du tracé en plan, pures et sans réseau (story 3.6). `detectTurns` servira aussi aux notes de l'epic 4.
import {
  STEP,
  TRACE_CURVATURE_SMOOTH_RADIUS,
  TRACE_HAIRPIN_MAX_RADIUS,
  TRACE_HAIRPIN_MIN_ANGLE,
  TRACE_STRAIGHT_MIN_RADIUS,
  TRACE_TURN_MAX_RADIUS,
  TRACE_TURN_MERGE_GAP,
  TRACE_TURN_MIN_ANGLE,
  TRACE_VERDICT_ROLLING_MAX,
  TRACE_VERDICT_WINDING_MAX,
} from "./config";
import { curvatureAt, type PlanePoint } from "./gpx";
import { boxSmooth } from "./smooth";

export type TurnSide = "left" | "right";
export type TraceVerdict = "roulante" | "sinueuse" | "très sinueuse";

/** Une portion suivie tournant d'un seul côté. Abscisses horizontales sur l'axe entier, prolongement compris, en mètres. */
export interface TraceTurn {
  fromS: number;
  toS: number;
  /** Abscisse du point le plus serré */
  apexS: number;
  side: TurnSide;
  /** Rayon le plus serré, mesuré sur la courbure lissée, en mètres */
  minRadius: number;
  /** Changement de cap total, en degrés */
  angle: number;
  hairpin: boolean;
}

export interface StraightSpan {
  fromS: number;
  toS: number;
  length: number;
}

export interface TraceStats {
  /** Longueur de la spéciale, prolongement exclu, en mètres */
  length: number;
  turns: TraceTurn[];
  turnsPerKm: number;
  hairpins: number;
  longestStraight: StraightSpan;
  verdict: TraceVerdict;
}

/** Courbure signée à chaque point, moyennée le long de l'axe : le rééchantillonnage à 2 m crée de petites courbures parasites. */
export const smoothedCurvature = (axis: PlanePoint[]): number[] => {
  const raw = axis.map((_, i) =>
    i > 0 && i < axis.length - 1 ? curvatureAt(axis, i) : 0,
  );
  return boxSmooth(raw, TRACE_CURVATURE_SMOOTH_RADIUS);
};

/** Bornes de points, `to` compris, et mesures d'une portion dans le même sens. */
interface Run {
  from: number;
  to: number;
  sign: number;
  /** Plus forte courbure absolue et son point */
  peak: number;
  apex: number;
  /** Changement de cap, en radians */
  turning: number;
}

/** Virages voisins du même côté : plus proches que le seuil, ils ne font qu'un. */
const mergeSameSide = (runs: Run[]): Run[] => {
  const merged: Run[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.sign === run.sign &&
      (run.from - last.to) * STEP <= TRACE_TURN_MERGE_GAP
    ) {
      last.to = run.to;
      last.turning += run.turning;
      if (run.peak > last.peak) {
        last.peak = run.peak;
        last.apex = run.apex;
      }
    } else merged.push({ ...run });
  }
  return merged;
};

/** Virages des points `from` à `to` compris : `curvature` vient de `smoothedCurvature`. */
export const detectTurns = (
  curvature: number[],
  from: number,
  to: number,
): TraceTurn[] => {
  const threshold = 1 / TRACE_TURN_MAX_RADIUS;
  const runs: Run[] = [];
  let run: Run | null = null;
  for (let i = from; i <= to; i++) {
    const value = Math.abs(curvature[i]);
    const sign = Math.sign(curvature[i]);
    if (value < threshold || (run && run.sign !== sign)) run = null;
    if (value < threshold) continue;
    if (!run) {
      run = { from: i, to: i, sign, peak: 0, apex: i, turning: 0 };
      runs.push(run);
    }
    run.to = i;
    run.turning += value * STEP;
    if (value > run.peak) {
      run.peak = value;
      run.apex = i;
    }
  }

  // Fusion avant le filtre pour additionner deux morceaux d'un même virage, après pour enjamber un parasite retiré.
  const minTurning = (TRACE_TURN_MIN_ANGLE * Math.PI) / 180;
  const kept = mergeSameSide(
    mergeSameSide(runs).filter((r) => r.turning >= minTurning),
  );
  return kept.map((r) => {
    const angle = (r.turning * 180) / Math.PI;
    const minRadius = 1 / r.peak;
    return {
      fromS: r.from * STEP,
      toS: r.to * STEP,
      apexS: r.apex * STEP,
      side: r.sign > 0 ? "right" : "left",
      minRadius,
      angle,
      hairpin:
        angle >= TRACE_HAIRPIN_MIN_ANGLE &&
        minRadius <= TRACE_HAIRPIN_MAX_RADIUS,
    };
  });
};

/** Plus longue portion sans courbure sensible. La première en cas d'égalité : mêmes chiffres à chaque exécution. */
export const findLongestStraight = (
  curvature: number[],
  from: number,
  to: number,
): StraightSpan => {
  const threshold = 1 / TRACE_STRAIGHT_MIN_RADIUS;
  let best = { from, to: from };
  let start = -1;
  for (let i = from; i <= to + 1; i++) {
    if (i <= to && Math.abs(curvature[i]) < threshold) {
      if (start < 0) start = i;
      continue;
    }
    if (start >= 0 && i - 1 - start > best.to - best.from)
      best = { from: start, to: i - 1 };
    start = -1;
  }
  return {
    fromS: best.from * STEP,
    toS: best.to * STEP,
    length: (best.to - best.from) * STEP,
  };
};

/** `axis` : l'axe à 2 m de `traceFromGpx`, avec `runoffPoints` points de prolongement à chaque bout. */
export const computeTraceStats = (
  axis: PlanePoint[],
  runoffPoints: number,
): TraceStats => {
  const from = runoffPoints;
  const to = axis.length - 1 - runoffPoints;
  let length = 0;
  for (let i = from + 1; i <= to; i++)
    length += Math.hypot(axis[i].x - axis[i - 1].x, axis[i].z - axis[i - 1].z);

  const curvature = smoothedCurvature(axis);
  const turns = detectTurns(curvature, from, to);
  const turnsPerKm = length > 0 ? (turns.length * 1000) / length : 0;
  return {
    length,
    turns,
    turnsPerKm,
    hairpins: turns.filter((turn) => turn.hairpin).length,
    longestStraight: findLongestStraight(curvature, from, to),
    verdict:
      turnsPerKm < TRACE_VERDICT_ROLLING_MAX
        ? "roulante"
        : turnsPerKm < TRACE_VERDICT_WINDING_MAX
          ? "sinueuse"
          : "très sinueuse",
  };
};
