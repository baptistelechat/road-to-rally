import { signedCurvature } from "./scenery";
import type { Track } from "../types";

/** Sous ce rayon, la route est en virage, en mètres */
const ENTER_RADIUS = 200;
/** Deux portions de même sens plus proches que ça forment un seul virage, en mètres */
const MERGE_GAP = 20;
/** Sous cet angle total, la route ne fait que dévier, en radians */
const MIN_ANGLE = (15 * Math.PI) / 180;
/** Rayon maximal des notes 1 à 5, en mètres : au-delà, jusqu'à `ENTER_RADIUS`, c'est un 6 */
const GRADE_RADII = [20, 35, 55, 85, 130];
/** Au-delà de cette longueur, le virage est annoncé « long », en mètres */
const LONG_LENGTH = 100;
/** Rayon de l'entrée sur rayon de la fin à partir duquel le virage « se resserre », mesurés sur son premier et son dernier tiers */
const TIGHTEN_RATIO = 1.5;
/** Sous ce rayon vertical, le profil forme une crête ou un creux, en mètres */
const CREST_RADIUS = 150;
/** Demi-fenêtre de mesure du rayon vertical, en points : à 2 m de pas, une bosse de 14 m ne s'y efface pas */
const VERTICAL_SPAN = 2;
/** Plus courte que ça, la portion n'est qu'un ou deux points de bruit du profil, en mètres */
const MIN_OBSTACLE_LENGTH = 3;
/** Une bosse : une crête plus courte que ça, en mètres */
const BUMP_LENGTH = 25;
/** Une bosse : le creux commence à moins de cette distance après la crête, en mètres */
const BUMP_GAP = 10;
/** Deux virages plus proches que ça s'annoncent ensemble, en mètres */
const PAIR_GAP = 30;
/** Enfilade : au moins ce nombre de virages */
const CHAIN_MIN_TURNS = 3;
/** Enfilade : aucun virage moins serré que cette note */
const CHAIN_MAX_GRADE = 3;
/** Enfilade : écart entre deux virages sous cette distance, en mètres. 10 m, plus la marge d'un axe à 2 m de pas : 5 pas font 10,03 m. */
const CHAIN_GAP = 10.5;

export type PaceGrade = 1 | 2 | 3 | 4 | 5 | 6;

export interface PaceTurn {
  kind: "turn";
  direction: "left" | "right";
  grade: PaceGrade;
  startS: number;
  endS: number;
  long: boolean;
  tightens: boolean;
}

export interface PaceObstacle {
  kind: "crest" | "bump";
  startS: number;
  endS: number;
}

export type PaceNote = PaceTurn | PaceObstacle;

export interface PaceCall {
  type: "single" | "pair" | "chain";
  notes: PaceNote[];
  startS: number;
  endS: number;
}

export interface PaceNotes {
  notes: PaceNote[];
  calls: PaceCall[];
}

/** Portion de même signe. Sur un circuit, les indices peuvent dépasser le nombre de points : ils se lisent modulo. */
interface Portion {
  sign: number;
  from: number;
  to: number;
}

/**
 * Abscisse d'un point, indices dépassant le tracé compris. Le pas réel varie avec la pente.
 * Convention sur un circuit : `startS` reste dans le tour, et un virage à cheval sur la ligne garde `endS` au-delà de `length`.
 */
const abscissae = (track: Track): ((i: number) => number) => {
  const { points, length } = track;
  const n = points.length;
  const starts = [0];
  for (let i = 1; i < n; i++) {
    const a = points[i - 1];
    const b = points[i];
    starts.push(starts[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  return (i) => starts[i % n] + Math.floor(i / n) * length;
};

/** Portions où `signAt` ne s'annule pas, entre les lignes. Le parcours part d'un point neutre : aucune n'est coupée en deux par le tour. */
const portionsOf = (
  track: Track,
  sOf: (i: number) => number,
  signAt: (i: number) => number,
): Portion[] => {
  const n = track.points.length;
  const inRange = (i: number): boolean =>
    sOf(i) >= track.startS && sOf(i) <= track.finishS;
  const sign = (i: number): number => (inRange(i % n) ? signAt(i % n) : 0);
  // ponytail: tracé entièrement en virage, sans point neutre : la coupure tombe au point 0.
  const first = track.closed
    ? Math.max(
        0,
        track.points.findIndex((_, i) => sign(i) === 0),
      )
    : 0;
  const portions: Portion[] = [];
  let current: Portion | null = null;
  for (let i = first; i < first + n; i++) {
    const value = sign(i);
    if (current && value === current.sign) current.to = i;
    else {
      current = value === 0 ? null : { sign: value, from: i, to: i };
      if (current) portions.push(current);
    }
  }
  return portions;
};

/** Recolle les portions voisines de même sens, y compris la dernière et la première d'un circuit. */
const mergePortions = (
  track: Track,
  sOf: (i: number) => number,
  portions: Portion[],
): Portion[] => {
  const n = track.points.length;
  const merged: Portion[] = [];
  for (const portion of portions) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.sign === portion.sign &&
      sOf(portion.from) - sOf(last.to) < MERGE_GAP
    )
      last.to = portion.to;
    else merged.push({ ...portion });
  }
  if (track.closed && merged.length > 1) {
    const head = merged[0];
    const tail = merged[merged.length - 1];
    if (
      head.sign === tail.sign &&
      sOf(head.from + n) - sOf(tail.to) < MERGE_GAP
    ) {
      tail.to = head.to + n;
      merged.shift();
    }
  }
  return merged;
};

const gradeOf = (radius: number): PaceGrade =>
  (GRADE_RADII.filter((limit) => limit <= radius).length + 1) as PaceGrade;

const findTurns = (track: Track, sOf: (i: number) => number): PaceTurn[] => {
  const n = track.points.length;
  const curvature = signedCurvature(track);
  const raw = portionsOf(track, sOf, (i) =>
    Math.abs(curvature[i]) > 1 / ENTER_RADIUS ? Math.sign(curvature[i]) : 0,
  );
  const turns: PaceTurn[] = [];
  for (const { sign, from, to } of mergePortions(track, sOf, raw)) {
    const count = to - from + 1;
    const third = Math.max(1, Math.floor(count / 3));
    let angle = 0;
    let tightest = 0;
    let entry = 0;
    let exit = 0;
    for (let i = from; i <= to; i++) {
      const k = sign * curvature[i % n];
      // Le dernier point d'un tracé ouvert n'a pas de segment suivant, et sa courbure est nulle.
      angle += k * (i < to ? sOf(i + 1) - sOf(i) : 0);
      tightest = Math.max(tightest, k);
      if (i < from + third) entry += k / third;
      if (i > to - third) exit += k / third;
    }
    if (angle < MIN_ANGLE) continue;
    const shift = from >= n ? track.length : 0;
    const startS = sOf(from) - shift;
    const endS = sOf(to) - shift;
    turns.push({
      kind: "turn",
      direction: sign > 0 ? "right" : "left",
      grade: gradeOf(1 / tightest),
      startS,
      endS,
      long: endS - startS > LONG_LENGTH,
      // Comparés en courbure : une entrée quasi droite n'a pas de rayon utile.
      tightens: exit >= entry * TIGHTEN_RATIO,
    });
  }
  return turns.sort((a, b) => a.startS - b.startS);
};

const findObstacles = (
  track: Track,
  sOf: (i: number) => number,
): PaceObstacle[] => {
  const { points, closed } = track;
  const n = points.length;
  const threshold = 1 / CREST_RADIUS;
  const vertical = (i: number): number => {
    if (!closed && (i < VERTICAL_SPAN || i >= n - VERTICAL_SPAN)) return 0;
    const before = (i - VERTICAL_SPAN + n) % n;
    const after = (i + VERTICAL_SPAN) % n;
    const spanBefore = Math.hypot(
      points[i].x - points[before].x,
      points[i].z - points[before].z,
    );
    const spanAfter = Math.hypot(
      points[after].x - points[i].x,
      points[after].z - points[i].z,
    );
    const slopeBefore = (points[i].y - points[before].y) / spanBefore;
    const slopeAfter = (points[after].y - points[i].y) / spanAfter;
    return (2 * (slopeAfter - slopeBefore)) / (spanBefore + spanAfter);
  };
  // Négatif sur une crête, positif dans un creux.
  const profile = portionsOf(track, sOf, (i) => {
    const k = vertical(i);
    return Math.abs(k) > threshold ? Math.sign(k) : 0;
  });
  const obstacles: PaceObstacle[] = [];
  profile.forEach(({ sign, from, to }, index) => {
    if (sign > 0) return;
    const next = profile[index + 1];
    const startS = sOf(from) - (from >= n ? track.length : 0);
    const endS = startS + sOf(to) - sOf(from);
    if (endS - startS < MIN_OBSTACLE_LENGTH) return;
    const bump =
      endS - startS < BUMP_LENGTH &&
      next !== undefined &&
      next.sign > 0 &&
      sOf(next.from) - sOf(to) < BUMP_GAP;
    obstacles.push({ kind: bump ? "bump" : "crest", startS, endS });
  });
  return obstacles.sort((a, b) => a.startS - b.startS);
};

const callOf = (type: PaceCall["type"], notes: PaceNote[]): PaceCall => ({
  type,
  notes,
  startS: notes[0].startS,
  endS: notes.reduce((end, note) => Math.max(end, note.endS), -Infinity),
});

/** Enfilades d'abord, puis paires, puis virages seuls. Le tour n'est pas relié à lui-même : la voix repart de la ligne. */
const groupTurns = (turns: PaceTurn[]): PaceCall[] => {
  const calls: PaceCall[] = [];
  const isChainable = (i: number): boolean => turns[i].grade <= CHAIN_MAX_GRADE;
  let i = 0;
  while (i < turns.length) {
    let end = i;
    while (
      isChainable(i) &&
      end + 1 < turns.length &&
      isChainable(end + 1) &&
      turns[end + 1].startS - turns[end].endS < CHAIN_GAP
    )
      end++;
    if (end - i + 1 >= CHAIN_MIN_TURNS) {
      calls.push(callOf("chain", turns.slice(i, end + 1)));
      i = end + 1;
    } else if (
      i + 1 < turns.length &&
      turns[i + 1].startS - turns[i].endS < PAIR_GAP
    ) {
      calls.push(callOf("pair", [turns[i], turns[i + 1]]));
      i += 2;
    } else {
      calls.push(callOf("single", [turns[i]]));
      i++;
    }
  }
  return calls;
};

/**
 * Notes et annonces d'un tracé, triées par abscisse.
 * Un obstacle a toujours sa propre annonce, même s'il chevauche un virage : la voix les lit l'un après l'autre.
 */
export const computePaceNotes = (track: Track): PaceNotes => {
  const sOf = abscissae(track);
  const turns = findTurns(track, sOf);
  const obstacles = findObstacles(track, sOf);
  const byStart = (a: { startS: number }, b: { startS: number }): number =>
    a.startS - b.startS;
  return {
    notes: [...turns, ...obstacles].sort(byStart),
    calls: [
      ...groupTurns(turns),
      ...obstacles.map((obstacle) => callOf("single", [obstacle])),
    ].sort(byStart),
  };
};
