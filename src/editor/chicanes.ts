// Édition des chicanes (story 3.9), pure. Le document ne garde que les choix du joueur : les automatiques viennent de l'analyse.
import type { AnalyzedAxis } from "@/geo/analyzeTrace";
import type { ChicaneRequest } from "@/geo/chicanes";
import {
  CHICANE_LINE_CLEARANCE,
  EDITOR_CHICANE_MIN_GAP,
  EDITOR_CHICANE_NUDGE,
  EDITOR_CHICANE_REMOVED_REACH,
  EDITOR_CHICANE_SETTLE_REACH,
  STEP,
} from "@/geo/config";
import { formatKm } from "@/geo/errors";
import { closestOnPolyline, project, unproject, type LatLon } from "@/geo/gpx";
import { nearestIndex } from "./hover";
import { assembleRoad, distance, type ApplyResult } from "./trace";
import type {
  AutoChicane,
  ChicaneElement,
  ChicaneSide,
  EditorTrace,
} from "./types";

export type ChicaneAxis = Pick<
  AnalyzedAxis,
  "latLon" | "runoffPoints" | "roundTrip"
>;

export interface ChicaneContext {
  trace: EditorTrace;
  auto: AutoChicane[];
  /** `null` : le tracé n'est pas encore analysé */
  axis: ChicaneAxis | null;
}

/** Une chicane telle qu'on la montre. `index` : son point sur l'axe, pour la situer et les trier. */
export interface ListedChicane extends ChicaneElement {
  index: number;
}

const NOT_READY = "Attends la fin de la vérification du tracé.";
const TOO_CLOSE = `Trop près d'une autre chicane : il faut au moins ${EDITOR_CHICANE_MIN_GAP} m entre deux.`;
const NO_ROOM = "Ce tracé n'a pas la place pour une chicane de plus.";

/** Les points de l'axe où une chicane a le droit d'être : à l'écart des lignes et, sur un aller-retour, de la jonction. */
export const chicaneBand = ({
  latLon,
  runoffPoints,
  roundTrip,
}: ChicaneAxis): { from: number; to: number } => {
  // Un point de marge : tout juste à la limite, le pipeline la voit au millimètre près du mauvais côté et retire la chicane.
  const clearance = Math.ceil(CHICANE_LINE_CLEARANCE / STEP) + 1;
  const last = roundTrip ? roundTrip.armEnd : latLon.length - 1 - runoffPoints;
  return { from: runoffPoints + clearance, to: last - clearance };
};

/** Ce que le pilote fait, pas où est le bloc : un premier bloc à gauche se contourne par la droite. */
export const chicaneBends = (side: ChicaneSide): string =>
  side === "left" ? "droite puis gauche" : "gauche puis droite";

/** Le même texte partout : la liste et les alertes ne doivent jamais donner deux kilomètres différents. */
export const chicaneKm = (index: number, runoffPoints: number): string =>
  formatKm((index - runoffPoints) * STEP);

/** Une phrase par paire trop proche, avec ce qu'il manque : une chicane d'avant la règle n'est refusée qu'à la génération sinon. */
export const chicaneSpacingWarnings = (
  chicanes: ListedChicane[],
  runoffPoints: number,
): string[] =>
  chicanes.flatMap((chicane, i) => {
    const previous = chicanes[i - 1];
    if (!previous) return [];
    const spacing = (chicane.index - previous.index) * STEP;
    return spacing >= EDITOR_CHICANE_MIN_GAP
      ? []
      : [
          `Du ${chicaneKm(previous.index, runoffPoints)} au ${chicaneKm(chicane.index, runoffPoints)} : ${spacing} m entre les deux, il en faut ${EDITOR_CHICANE_MIN_GAP}. Décale-en une de ${EDITOR_CHICANE_MIN_GAP - spacing} m.`,
        ];
  });

/** Le point permis le plus proche. Sur toute la bande : c'est le joueur qui vise, pas une ancienne position. `null` : aucune place. */
const bandIndex = (axis: ChicaneAxis, position: LatLon): number | null => {
  const { from, to } = chicaneBand(axis);
  return from > to
    ? null
    : from + nearestIndex(axis.latLon.slice(from, to + 1), position);
};

/** Pendant un glissement : le marqueur ne quitte jamais la route. */
export const snapToBand = (
  axis: ChicaneAxis,
  position: LatLon,
): LatLon | null => {
  const index = bandIndex(axis, position);
  return index === null ? null : axis.latLon[index];
};

/** Celles du joueur, plus les automatiques qu'il n'a ni supprimées ni recouvertes. */
export const listChicanes = ({
  trace,
  auto,
  axis,
}: ChicaneContext): ListedChicane[] => {
  if (!trace.chicanesEnabled) return [];
  const indexOf = (position: LatLon): number =>
    axis ? nearestIndex(axis.latLon, position) : 0;
  const player = trace.chicanes.map((chicane) => ({
    ...chicane,
    index: indexOf(chicane.position),
  }));
  const automatic = auto.flatMap(({ position, side }): ListedChicane[] => {
    const index = indexOf(position);
    const hidden =
      trace.removedChicanes.some(
        (removed) =>
          distance(removed, position) <= EDITOR_CHICANE_REMOVED_REACH,
      ) ||
      player.some(
        (other) =>
          Math.abs(other.index - index) * STEP < EDITOR_CHICANE_MIN_GAP,
      );
    return hidden
      ? []
      : [{ id: `auto-${index}`, position, side, origin: "auto", index }];
  });
  return [...player, ...automatic].sort((a, b) => a.index - b.index);
};

export const chicaneRequests = (chicanes: ListedChicane[]): ChicaneRequest[] =>
  chicanes.map(({ position, side }) => ({ position, side }));

const nextId = (trace: EditorTrace): string => {
  const used = trace.chicanes.map(({ id }) => Number(id.slice(1)) || 0);
  return `c${Math.max(0, ...used) + 1}`;
};

/** Un élément touché est marqué comme celui du joueur : son ancienne place ne reçoit plus de chicane automatique. */
const touch = (
  trace: EditorTrace,
  chicane: ListedChicane,
  changes: Partial<Pick<ChicaneElement, "position" | "side">>,
): EditorTrace =>
  chicane.origin === "player"
    ? {
        ...trace,
        chicanes: trace.chicanes.map((other) =>
          other.id === chicane.id ? { ...other, ...changes } : other,
        ),
      }
    : {
        ...trace,
        removedChicanes: [...trace.removedChicanes, chicane.position],
        chicanes: [
          ...trace.chicanes,
          {
            id: nextId(trace),
            position: chicane.position,
            side: chicane.side,
            origin: "player",
            ...changes,
          },
        ],
      };

const tooClose = (others: ListedChicane[], index: number): boolean =>
  others.some(
    (other) => Math.abs(other.index - index) * STEP < EDITOR_CHICANE_MIN_GAP,
  );

const moveTo = (
  context: ChicaneContext,
  axis: ChicaneAxis,
  chicane: ListedChicane,
  index: number,
): ApplyResult => {
  const others = listChicanes(context).filter(({ id }) => id !== chicane.id);
  return tooClose(others, index)
    ? { refusal: TOO_CLOSE }
    : {
        trace: touch(context.trace, chicane, {
          position: axis.latLon[index],
        }),
      };
};

const withChicane = (
  context: ChicaneContext,
  id: string,
  run: (chicane: ListedChicane) => ApplyResult,
): ApplyResult => {
  const chicane = listChicanes(context).find((other) => other.id === id);
  return chicane ? run(chicane) : { trace: context.trace };
};

/** Le milieu du plus grand espace libre : ce qu'il faut au clavier, sans pointer d'endroit. */
const freestIndex = (axis: ChicaneAxis, chicanes: ListedChicane[]): number => {
  const { from, to } = chicaneBand(axis);
  const stops = [
    from,
    ...chicanes
      .map(({ index }) => index)
      .filter((index) => index > from && index < to),
    to,
  ];
  let best = from;
  let widest = -1;
  stops.slice(1).forEach((stop, i) => {
    if (stop - stops[i] > widest) {
      widest = stop - stops[i];
      best = Math.round((stop + stops[i]) / 2);
    }
  });
  return best;
};

/** À `position`, ou sans elle dans le plus grand espace libre. Le plafond d'une par km ne vaut pas pour le joueur. */
export const addChicane = (
  context: ChicaneContext,
  position?: LatLon,
): ApplyResult => {
  const { trace, axis } = context;
  if (!axis) return { refusal: NOT_READY };
  const { from, to } = chicaneBand(axis);
  if (from > to) return { refusal: NO_ROOM };
  const chicanes = listChicanes(context);
  const index = position
    ? (bandIndex(axis, position) ?? from)
    : freestIndex(axis, chicanes);
  if (tooClose(chicanes, index))
    return { refusal: position ? TOO_CLOSE : NO_ROOM };
  return {
    trace: {
      ...trace,
      chicanesEnabled: true,
      chicanes: [
        ...trace.chicanes,
        {
          id: nextId(trace),
          position: axis.latLon[index],
          side: "left",
          origin: "player",
        },
      ],
    },
  };
};

export const moveChicane = (
  context: ChicaneContext,
  id: string,
  position: LatLon,
): ApplyResult => {
  const { axis } = context;
  if (!axis) return { refusal: NOT_READY };
  const index = bandIndex(axis, position);
  if (index === null) return { refusal: NO_ROOM };
  return withChicane(context, id, (chicane) =>
    moveTo(context, axis, chicane, index),
  );
};

/** Le déplacement au clavier : un cran le long du tracé, sans sortir de la bande. */
export const nudgeChicane = (
  context: ChicaneContext,
  id: string,
  direction: 1 | -1,
): ApplyResult => {
  const { axis } = context;
  if (!axis) return { refusal: NOT_READY };
  const { from, to } = chicaneBand(axis);
  return withChicane(context, id, (chicane) => {
    const target = chicane.index + direction * (EDITOR_CHICANE_NUDGE / STEP);
    return from > to
      ? { refusal: NO_ROOM }
      : moveTo(context, axis, chicane, Math.max(from, Math.min(to, target)));
  });
};

export const flipChicane = (context: ChicaneContext, id: string): ApplyResult =>
  withChicane(context, id, (chicane) => {
    const side: ChicaneSide = chicane.side === "left" ? "right" : "left";
    return { trace: touch(context.trace, chicane, { side }) };
  });

export const removeChicane = (
  context: ChicaneContext,
  id: string,
): ApplyResult =>
  withChicane(context, id, (chicane) => ({
    trace: {
      ...context.trace,
      chicanes: context.trace.chicanes.filter((other) => other.id !== id),
      removedChicanes: [...context.trace.removedChicanes, chicane.position],
    },
  }));

export const resetChicanes = (trace: EditorTrace): EditorTrace => ({
  ...trace,
  chicanes: [],
  removedChicanes: [],
  chicanesEnabled: true,
});

export interface SettledChicanes {
  trace: EditorTrace;
  /** Chicanes du joueur qui ne sont plus sur le tracé */
  lost: number;
}

/**
 * Le tracé a changé : celles du joueur se recalent depuis leur position géographique, et ne vont jamais chercher plus loin
 * que `EDITOR_CHICANE_SETTLE_REACH` : une route qui repasse à côté ne les récupère pas. Même objet si rien ne bouge.
 */
// ponytail: mesuré sur la route réelle ; une chicane à plus de 10 m d'elle, sur un virage très élargi, serait retirée (avec le message).
export const settleChicanes = (trace: EditorTrace): SettledChicanes => {
  if (trace.chicanes.length === 0) return { trace, lost: 0 };
  const road = assembleRoad(trace.segments);
  let changed = false;
  const chicanes: ChicaneElement[] = [];
  for (const chicane of trace.chicanes) {
    const origin = chicane.position;
    const { distance: gap, point } = closestOnPolyline(
      { x: 0, z: 0 },
      road.map((p) => project(p, origin)),
    );
    if (gap > EDITOR_CHICANE_SETTLE_REACH) continue;
    if (gap < 0.01) chicanes.push(chicane);
    else {
      changed = true;
      chicanes.push({ ...chicane, position: unproject(point, origin) });
    }
  }
  const lost = trace.chicanes.length - chicanes.length;
  return { trace: changed || lost ? { ...trace, chicanes } : trace, lost };
};

export const lostChicanesNotice = (lost: number): string | null =>
  lost === 0
    ? null
    : lost === 1
      ? "Une de tes chicanes n'est plus sur le tracé : elle a été retirée. Ctrl+Z la rétablit."
      : `${lost} de tes chicanes ne sont plus sur le tracé : elles ont été retirées. Ctrl+Z les rétablit.`;
