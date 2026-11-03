// Placement des chicanes : fonctions pures, sans réseau ni rendu. Même axe, mêmes chicanes au bit près.
import { isNearBlock } from "../sim/track/obstacles";
import { FORK_MARGIN, roadForkReach } from "../sim/track/roadContact";
import type {
  ChicaneBlock,
  ChicaneSide,
  SharedRange,
  Vec3,
} from "../sim/types";
import {
  CHICANE_BLOCK_DEPTH,
  CHICANE_EXCLUDED_CLEARANCE,
  CHICANE_GAP,
  CHICANE_LINE_CLEARANCE,
  CHICANE_MIN_BLOCKED,
  CHICANE_MIN_PASSAGE,
  CHICANE_MIN_SEPARATION,
  EDITOR_CHICANE_MIN_GAP,
  CHICANE_MIN_STRAIGHT,
  CHICANE_PASSAGE_RATIO,
  CHICANE_SHOULDER_OVERHANG,
  CHICANE_SKIRT,
  CHICANE_SNAP_TOLERANCE,
  CHICANE_SPACING,
  CHICANE_STACK_HEIGHT,
  CHICANE_STRAIGHT_MARGIN,
  CHICANE_STRAIGHT_TOLERANCE,
} from "./config";
import { formatKm } from "./errors";
import { project, type LatLon } from "./gpx";

// Le contrat vit dans `src/sim/`, qui lit les blocs sans jamais importer `src/geo/`.
export type { ChicaneBlock, ChicaneSide };

/** Plage d'abscisses, en mètres. */
export interface ChicaneRange {
  from: number;
  to: number;
}

export interface Chicane {
  /** Abscisse du milieu de la chicane le long de l'axe */
  s: number;
  /** Côté du premier bloc rencontré dans le sens de la route */
  side: ChicaneSide;
}

export interface ChicaneOptions {
  startS: number;
  finishS: number;
  /** Ponts, jonctions d'aller-retour : aucune chicane dedans ni tout près */
  excluded: ChicaneRange[];
}

export interface ChicanePlacement {
  chicanes: Chicane[];
  /** Chicanes retirées, route trop étroite : à signaler au joueur */
  tooNarrow: Chicane[];
}

const TANGENT_REACH = 4;

/** Arrondi sans zéro négatif : une valeur égale garde la même écriture dans le JSON et l'empreinte. */
const roundTo = (value: number, factor: number): number =>
  Math.round(value * factor) / factor + 0;

// `Math.sqrt` est exact partout, contrairement à `Math.hypot` : même résultat dans tous les moteurs.
const abscissae = (axis: Vec3[]): Float64Array => {
  const s = new Float64Array(axis.length);
  for (let i = 1; i < axis.length; i++) {
    const dx = axis[i].x - axis[i - 1].x;
    const dy = axis[i].y - axis[i - 1].y;
    const dz = axis[i].z - axis[i - 1].z;
    s[i] = s[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return s;
};

/** Dernier index dont l'abscisse ne dépasse pas `value`. */
const segmentAt = (s: Float64Array, value: number): number => {
  let low = 0;
  let high = s.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (s[middle] <= value) low = middle;
    else high = middle - 1;
  }
  return low;
};

/** Vrai si aucun point entre `from` et `to` ne s'écarte de la corde au-delà de la tolérance, sur le plan horizontal. */
const isStraight = (axis: Vec3[], from: number, to: number): boolean => {
  const dx = axis[to].x - axis[from].x;
  const dz = axis[to].z - axis[from].z;
  const limit =
    CHICANE_STRAIGHT_TOLERANCE *
    CHICANE_STRAIGHT_TOLERANCE *
    (dx * dx + dz * dz);
  for (let k = from + 1; k < to; k++) {
    const cross =
      (axis[k].x - axis[from].x) * dz - (axis[k].z - axis[from].z) * dx;
    if (cross * cross > limit) return false;
  }
  return true;
};

const straightsFrom = (
  axis: Vec3[],
  s: Float64Array,
  startS: number,
  finishS: number,
): ChicaneRange[] => {
  const last = segmentAt(s, finishS);
  const straights: ChicaneRange[] = [];
  let i = Math.min(segmentAt(s, startS) + 1, last);
  while (i < last) {
    let end = i + 1;
    while (end < last && isStraight(axis, i, end + 1)) end++;
    if (s[end] - s[i] >= CHICANE_MIN_STRAIGHT) {
      straights.push({ from: s[i], to: s[end] });
      i = end;
    } else {
      i++;
    }
  }
  return straights;
};

/** Lignes droites de plus de `CHICANE_MIN_STRAIGHT` entre les deux lignes, triées par abscisse. */
export const findStraights = (
  axis: Vec3[],
  startS: number,
  finishS: number,
): ChicaneRange[] => straightsFrom(axis, abscissae(axis), startS, finishS);

/** Retire les plages exclues, élargies de leur marge, d'une plage de départ. */
const allowedRanges = (
  range: ChicaneRange,
  excluded: ChicaneRange[],
): ChicaneRange[] => {
  const sorted = [...excluded].sort((a, b) => a.from - b.from);
  const ranges: ChicaneRange[] = [];
  let from = range.from;
  for (const zone of sorted) {
    const zoneFrom = zone.from - CHICANE_EXCLUDED_CLEARANCE;
    const zoneTo = zone.to + CHICANE_EXCLUDED_CLEARANCE;
    if (zoneFrom > from)
      ranges.push({ from, to: Math.min(zoneFrom, range.to) });
    from = Math.max(from, zoneTo);
  }
  if (from <= range.to) ranges.push({ from, to: range.to });
  return ranges.filter((allowed) => allowed.from <= allowed.to);
};

/** Point permis le plus proche de `target`, au moins à `floor`. `null` : aucun. */
const nearestAllowed = (
  target: number,
  floor: number,
  ranges: ChicaneRange[],
): number | null => {
  let best: number | null = null;
  for (const range of ranges) {
    if (range.to < floor) continue;
    const from = Math.max(range.from, floor);
    const candidate = Math.min(range.to, Math.max(from, target));
    if (best === null || Math.abs(candidate - target) < Math.abs(best - target))
      best = candidate;
  }
  return best;
};

const widthOver = (
  center: number,
  s: Float64Array,
  widths: number[],
): number => {
  const half = (CHICANE_GAP + CHICANE_BLOCK_DEPTH) / 2;
  const from = segmentAt(s, center - half);
  const to = Math.min(segmentAt(s, center + half) + 1, s.length - 1);
  let width = widths[from];
  for (let i = from + 1; i <= to; i++) width = Math.min(width, widths[i]);
  return width;
};

/** Largeur à retenir pour une chicane : la plus étroite sur toute sa longueur. */
export const chicaneWidth = (
  s: number,
  axis: Vec3[],
  widths: number[],
): number => widthOver(s, abscissae(axis), widths);

/** Point et cap de route à une abscisse : tangente prise sur quelques points, le bruit de l'axe ne fait pas pivoter le bloc. */
const blockFrame = (
  axis: Vec3[],
  s: Float64Array,
  value: number,
): { point: Vec3; rightX: number; rightZ: number } => {
  const i = Math.min(segmentAt(s, value), axis.length - 2);
  const t = Math.min(1, Math.max(0, (value - s[i]) / (s[i + 1] - s[i] || 1)));
  const a = axis[Math.max(0, i - TANGENT_REACH)];
  const b = axis[Math.min(axis.length - 1, i + 1 + TANGENT_REACH)];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.sqrt(dx * dx + dz * dz) || 1;
  return {
    point: {
      x: axis[i].x + (axis[i + 1].x - axis[i].x) * t,
      y: axis[i].y + (axis[i + 1].y - axis[i].y) * t,
      z: axis[i].z + (axis[i + 1].z - axis[i].z) * t,
    },
    // Avant = -Z et droite = +X : la droite de (tx, tz) est (-tz, tx).
    rightX: -dz / length,
    rightZ: dx / length,
  };
};

/**
 * Les deux blocs en quinconce, un de chaque côté. `null` : route trop étroite pour garder un passage et forcer un écart.
 * `width` vient de `chicaneWidth`, `axis` est l'axe sur lequel `chicane.s` a été calculée.
 */
export const chicaneBlocks = (
  chicane: Chicane,
  width: number,
  axis: Vec3[],
): [ChicaneBlock, ChicaneBlock] | null => {
  // Arrondi vers le bas : c'est le bloc qui perd le millimètre, jamais le passage.
  const blocked =
    Math.floor(
      (width - Math.max(CHICANE_MIN_PASSAGE, width * CHICANE_PASSAGE_RATIO)) *
        1000,
    ) / 1000;
  if (blocked < CHICANE_MIN_BLOCKED) return null;
  const s = abscissae(axis);
  const span = blocked + CHICANE_SHOULDER_OVERHANG;
  const offset = width / 2 + CHICANE_SHOULDER_OVERHANG - span / 2;

  const block = (center: number, side: ChicaneSide): ChicaneBlock => {
    const lateral = side === "left" ? -offset : offset;
    const { point, rightX, rightZ } = blockFrame(axis, s, center);
    return {
      s: roundTo(center, 1000),
      side,
      lateral,
      span,
      passage: width - blocked,
      depth: CHICANE_BLOCK_DEPTH,
      height: CHICANE_STACK_HEIGHT,
      skirt: CHICANE_SKIRT,
      position: {
        x: roundTo(point.x + rightX * lateral, 1000),
        y: roundTo(point.y, 1000),
        z: roundTo(point.z + rightZ * lateral, 1000),
      },
      yaw: roundTo(Math.atan2(-rightZ, rightX), 1e6),
    };
  };

  return [
    block(chicane.s - CHICANE_GAP / 2, chicane.side),
    block(
      chicane.s + CHICANE_GAP / 2,
      chicane.side === "left" ? "right" : "left",
    ),
  ];
};

/**
 * Une chicane par ligne droite, plusieurs si elle dépasse le kilomètre, jamais moins de `CHICANE_SPACING` entre deux.
 * Le côté alterne d'une chicane à la suivante. Résultats triés par abscisse.
 */
export const placeChicanes = (
  axis: Vec3[],
  widths: number[],
  { startS, finishS, excluded }: ChicaneOptions,
): ChicanePlacement => {
  const s = abscissae(axis);
  const chicanes: Chicane[] = [];
  const tooNarrow: Chicane[] = [];
  // Un parcours de 2,3 km ne prend que deux chicanes, même si trois tiendraient à l'écart l'une de l'autre.
  const maxCount = Math.max(
    1,
    Math.floor((finishS - startS) / CHICANE_SPACING),
  );
  let floor = Number.NEGATIVE_INFINITY;

  for (const straight of straightsFrom(axis, s, startS, finishS)) {
    const ranges = allowedRanges(
      {
        from: Math.max(
          straight.from + CHICANE_STRAIGHT_MARGIN,
          startS + CHICANE_LINE_CLEARANCE,
        ),
        to: Math.min(
          straight.to - CHICANE_STRAIGHT_MARGIN,
          finishS - CHICANE_LINE_CLEARANCE,
        ),
      },
      excluded,
    );
    const length = straight.to - straight.from;
    const count = Math.max(1, Math.floor(length / CHICANE_SPACING));
    for (let k = 0; k < count; k++) {
      if (chicanes.length >= maxCount) break;
      const target = straight.from + (length * (k + 0.5)) / count;
      const position = nearestAllowed(target, floor, ranges);
      if (position === null) continue;
      // Arrondi vers le haut : l'écart minimal reste tenu au millimètre près.
      const center = Math.ceil(position * 1000) / 1000;
      const side: ChicaneSide = chicanes.length % 2 === 0 ? "left" : "right";
      const chicane: Chicane = { s: center, side };
      const width = widthOver(center, s, widths);
      if (chicaneBlocks(chicane, width, axis) === null) {
        tooNarrow.push(chicane);
        continue;
      }
      chicanes.push(chicane);
      floor = center + CHICANE_SPACING;
    }
  }
  return { chicanes, tooNarrow };
};

/** Chicane demandée par l'éditeur : une position géographique, recalée sur l'axe à la génération. */
export interface ChicaneRequest {
  position: { lat: number; lon: number };
  side: ChicaneSide;
}

/** Ordre stable : deux listes aux mêmes chicanes donnent la même clé de cache et la même spéciale. */
export const sortChicaneRequests = (
  requests: ChicaneRequest[],
): ChicaneRequest[] =>
  [...requests].sort(
    (a, b) =>
      a.position.lat - b.position.lat ||
      a.position.lon - b.position.lon ||
      a.side.localeCompare(b.side),
  );

/** Plages à éviter : ponts et tunnels, puis plage de retour et jonction d'un aller-retour. `axis` : tout l'axe ou sa portion unique. */
export const chicaneExclusions = (
  axis: Vec3[],
  widths: number[],
  shared?: SharedRange,
  structures: boolean[] = [],
): ChicaneRange[] => {
  const s = abscissae(axis);
  const excluded: ChicaneRange[] = [];
  let from = -1;
  for (let i = 0; i <= structures.length; i++) {
    if (structures[i] && from < 0) from = i;
    if (!structures[i] && from >= 0) {
      excluded.push({ from: s[from], to: s[i - 1] });
      from = -1;
    }
  }
  if (!shared) return excluded;
  const { armEnd, returnStart } = shared;
  const around = roadForkReach(axis, widths, armEnd, returnStart) + FORK_MARGIN;
  // La plage de retour va jusqu'au bout du tracé, quelle que soit la longueur de l'axe reçu.
  excluded.push(
    { from: s[Math.max(0, armEnd - around)], to: s[armEnd + around] },
    { from: s[returnStart - around], to: Number.POSITIVE_INFINITY },
  );
  return excluded;
};

/** Point de l'axe le plus proche de (x, z), sur le plan horizontal. À égalité, le premier. */
const snapToAxis = (
  axis: Vec3[],
  s: Float64Array,
  x: number,
  z: number,
): { s: number; distance: number } => {
  let bestS = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < axis.length; i++) {
    const a = axis[i];
    const b = axis[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz;
    const t =
      len2 > 0
        ? Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len2))
        : 0;
    const dx = a.x + abx * t - x;
    const dz = a.z + abz * t - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) {
      best = d2;
      bestS = s[i] + (s[i + 1] - s[i]) * t;
    }
  }
  return { s: Math.round(bestS * 1000) / 1000, distance: Math.sqrt(best) };
};

/** Le bloc mordrait sur une autre portion de route, celle d'une épingle voisine par exemple. */
const touchesOtherRoad = (
  block: ChicaneBlock,
  axis: Vec3[],
  s: Float64Array,
  widths: number[],
): boolean =>
  axis.some(
    (point, i) =>
      Math.abs(s[i] - block.s) > block.span + CHICANE_GAP &&
      isNearBlock(block, point.x, point.z, widths[i] / 2),
  );

export interface ChicaneRemoval {
  message: string;
  /** La raison seule : l'éditeur la remet avec son propre kilomètre, celui de sa liste */
  reason: string;
  position: LatLon;
}

export interface ChicaneResolution {
  /** Blocs prêts à rouler, triés par abscisse */
  blocks: ChicaneBlock[];
  /** Une phrase par chicane retirée, à montrer au joueur */
  warnings: string[];
  /** Les mêmes, avec l'endroit demandé : l'éditeur y amène le joueur */
  removals: ChicaneRemoval[];
}

/**
 * Recale chaque chicane demandée sur l'axe, en perpendiculaire. Une position que ce recalage ne suffit pas à rendre possible
 * n'est jamais déplacée le long de la route : la chicane est retirée, et le joueur en est averti. Pure : mêmes entrées, mêmes bits.
 */
export const resolveChicanes = (
  requests: ChicaneRequest[],
  axis: Vec3[],
  widths: number[],
  origin: LatLon,
  { startS, finishS, excluded }: ChicaneOptions,
): ChicaneResolution => {
  const s = abscissae(axis);
  const allowed = allowedRanges(
    {
      from: startS + CHICANE_LINE_CLEARANCE,
      to: finishS - CHICANE_LINE_CLEARANCE,
    },
    excluded,
  );
  const warnings: string[] = [];
  const removals: ChicaneRemoval[] = [];
  const snapped = sortChicaneRequests(requests)
    .map(({ position, side }) => {
      const { x, z } = project(position, origin);
      return { side, position, ...snapToAxis(axis, s, x, z) };
    })
    .sort((a, b) => a.s - b.s || a.side.localeCompare(b.side));

  const blocks: ChicaneBlock[] = [];
  let previous = Number.NEGATIVE_INFINITY;
  for (const { s: center, side, distance, position } of snapped) {
    const at = formatKm(center - startS);
    const remove = (why: string): void => {
      const message = `La chicane du ${at} a été retirée : ${why}.`;
      warnings.push(message);
      removals.push({ message, reason: why, position });
    };
    if (distance > CHICANE_SNAP_TOLERANCE) {
      remove(`elle est à ${Math.round(distance)} m de la route`);
      continue;
    }
    if (!allowed.some(({ from, to }) => center >= from && center <= to)) {
      remove(
        center < startS + CHICANE_LINE_CLEARANCE
          ? `elle tombe trop près du départ (il faut ${CHICANE_LINE_CLEARANCE} m)`
          : center > finishS - CHICANE_LINE_CLEARANCE
            ? `elle tombe trop près de l'arrivée (il faut ${CHICANE_LINE_CLEARANCE} m)`
            : `elle tombe trop près d'une jonction (il faut ${CHICANE_EXCLUDED_CLEARANCE} m)`,
      );
      continue;
    }
    if (center - previous < CHICANE_MIN_SEPARATION) {
      remove(
        `elle est à ${Math.round(center - previous)} m de la précédente, il en faut au moins ${EDITOR_CHICANE_MIN_GAP}`,
      );
      continue;
    }
    const width = widthOver(center, s, widths);
    const pair = chicaneBlocks({ s: center, side }, width, axis);
    if (pair === null) {
      remove(
        `la route y est trop étroite (${width.toFixed(1).replace(".", ",")} m)`,
      );
      continue;
    }
    if (pair.some((block) => touchesOtherRoad(block, axis, s, widths))) {
      remove("elle mordrait sur une autre portion de la route");
      continue;
    }
    blocks.push(...pair);
    previous = center;
  }
  return { blocks, warnings, removals };
};
