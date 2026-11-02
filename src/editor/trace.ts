// Opérations pures sur le tracé : rien n'est modifié en place, le réseau reste aux appelants.
import type { BRouterRoute } from "@/geo/brouter";
import {
  ANCHOR_JUNCTION_TOLERANCE,
  ANCHOR_MAX_SNAP,
  EDITOR_RUNOFF,
} from "@/geo/config";
import { project, type LatLon } from "@/geo/gpx";
import type { Anchor, EditorTrace, Segment, SegmentWay } from "./types";

/** Portion à demander à BRouter. `from` et `to` confondus : on cherche seulement où un point isolé accroche. */
export interface RoutePair {
  fromAnchorId: string;
  toAnchorId: string;
  from: LatLon;
  to: LatLon;
}

/** Tracé en attente de routes : `trace.segments` ne garde que les segments intacts, `pairs` dit ce qui manque. */
export interface TraceEdit {
  trace: EditorTrace;
  pairs: RoutePair[];
}

export type ApplyResult =
  | { trace: EditorTrace; refusal?: undefined }
  | { refusal: string };

export const distance = (a: LatLon, b: LatLon): number => {
  const { x, z } = project(b, a);
  return Math.hypot(x, z);
};

const pair = (from: Anchor, to: Anchor): RoutePair => ({
  fromAnchorId: from.id,
  toAnchorId: to.id,
  from: from.position,
  to: to.position,
});

const findSegment = (
  segments: Segment[],
  from: Anchor,
  to: Anchor,
): Segment | undefined =>
  segments.find((s) => s.fromAnchorId === from.id && s.toAnchorId === to.id);

/** Les paires voisines sans segment : seules elles partent au réseau. */
const edit = (
  trace: EditorTrace,
  anchors: Anchor[],
  segments: Segment[],
): TraceEdit => {
  const pairs: RoutePair[] = [];
  for (let i = 1; i < anchors.length; i++)
    if (!findSegment(segments, anchors[i - 1], anchors[i]))
      pairs.push(pair(anchors[i - 1], anchors[i]));
  return { trace: { ...trace, anchors, segments }, pairs };
};

/** Un point seul n'a pas de segment, mais il doit quand même se recaler sur une route. */
const snapAlone = (result: TraceEdit): TraceEdit => {
  const { anchors } = result.trace;
  return anchors.length === 1
    ? { ...result, pairs: [pair(anchors[0], anchors[0])] }
    : result;
};

const nextAnchorId = (anchors: Anchor[]): string => {
  const used = anchors.map((anchor) => Number(anchor.id.slice(1)) || 0);
  return `a${Math.max(0, ...used) + 1}`;
};

const hasAnchor = (trace: EditorTrace, anchorId: string): boolean =>
  trace.anchors.some((anchor) => anchor.id === anchorId);

const withoutAnchor = (segments: Segment[], anchorId: string): Segment[] =>
  segments.filter(
    (s) => s.fromAnchorId !== anchorId && s.toAnchorId !== anchorId,
  );

export const addAnchor = (trace: EditorTrace, position: LatLon): TraceEdit =>
  snapAlone(
    edit(
      trace,
      [...trace.anchors, { id: nextAnchorId(trace.anchors), position }],
      trace.segments,
    ),
  );

/** Insère un passage dans le segment `segmentIndex` : seules ses deux moitiés sont à demander. */
export const insertAnchor = (
  trace: EditorTrace,
  segmentIndex: number,
  position: LatLon,
): TraceEdit => {
  if (!trace.segments[segmentIndex]) return { trace, pairs: [] };
  const anchors = [...trace.anchors];
  anchors.splice(segmentIndex + 1, 0, {
    id: nextAnchorId(trace.anchors),
    position,
  });
  return edit(
    trace,
    anchors,
    trace.segments.filter((_, i) => i !== segmentIndex),
  );
};

export const moveAnchor = (
  trace: EditorTrace,
  anchorId: string,
  position: LatLon,
): TraceEdit =>
  hasAnchor(trace, anchorId)
    ? snapAlone(
        edit(
          trace,
          trace.anchors.map((anchor) =>
            anchor.id === anchorId ? { ...anchor, position } : anchor,
          ),
          withoutAnchor(trace.segments, anchorId),
        ),
      )
    : { trace, pairs: [] };

/** Supprimer un point du milieu demande le segment entre ses voisins ; aux extrémités, rien. */
export const removeAnchor = (
  trace: EditorTrace,
  anchorId: string,
): TraceEdit =>
  hasAnchor(trace, anchorId)
    ? edit(
        trace,
        trace.anchors.filter((anchor) => anchor.id !== anchorId),
        withoutAnchor(trace.segments, anchorId),
      )
    : { trace, pairs: [] };

const reverseWays = (ways: SegmentWay[], lastIndex: number): SegmentWay[] =>
  ways
    .map((way, i) => ({
      ...way,
      fromIndex: lastIndex - (ways[i + 1]?.fromIndex ?? lastIndex),
    }))
    .reverse();

/**
 * La géométrie suffit : aucun appel réseau. Le premier bloc d'une chicane devient le second, donc son côté s'inverse.
 * Sans effet sur un aller-retour : il repart du même endroit, et il ferait le tour d'un rond-point à contresens.
 */
export const reverseTrace = (trace: EditorTrace): EditorTrace =>
  trace.returnRoute
    ? trace
    : {
        ...trace,
        anchors: [...trace.anchors].reverse(),
        segments: [...trace.segments].reverse().map((segment) => ({
          ...segment,
          fromAnchorId: segment.toAnchorId,
          toAnchorId: segment.fromAnchorId,
          points: [...segment.points].reverse(),
          ways: reverseWays(segment.ways, segment.points.length - 1),
        })),
        chicanes: trace.chicanes.map((chicane) => ({
          ...chicane,
          side: chicane.side === "left" ? "right" : "left",
        })),
      };

/**
 * Pose les routes reçues, une par entrée de `edit.pairs`. Un point sans segment intact prend la position trouvée par
 * BRouter, et les segments sont recollés exactement sur leurs points : les jonctions n'ont ni doublon ni trou.
 */
export const applyRoutes = (
  { trace, pairs }: TraceEdit,
  routes: BRouterRoute[],
): ApplyResult => {
  const settled = new Map<string, LatLon>();
  for (const anchor of trace.anchors)
    if (withoutAnchor(trace.segments, anchor.id).length < trace.segments.length)
      settled.set(anchor.id, anchor.position);

  for (let i = 0; i < pairs.length; i++) {
    const { points } = routes[i];
    const ends: [string, LatLon, LatLon][] = [
      [pairs[i].fromAnchorId, pairs[i].from, points[0]],
      [pairs[i].toAnchorId, pairs[i].to, points[points.length - 1]],
    ];
    for (const [id, asked, found] of ends) {
      const fixed = settled.get(id);
      if (fixed) {
        if (distance(fixed, found) > ANCHOR_JUNCTION_TOLERANCE)
          return {
            refusal:
              "Ce point tombe entre deux routes : déplace-le pour qu'il soit bien sur l'une d'elles.",
          };
        continue;
      }
      const gap = distance(asked, found);
      if (gap > ANCHOR_MAX_SNAP)
        return {
          refusal: `Ce point est à ${Math.round(gap)} m de la route la plus proche : pose-le à moins de ${ANCHOR_MAX_SNAP} m.`,
        };
      settled.set(id, found);
    }
    if (pairs[i].fromAnchorId !== pairs[i].toAnchorId && points.length < 2)
      return {
        refusal: "Ces deux points tombent au même endroit de la route.",
      };
  }

  const anchors = trace.anchors.map((anchor) => ({
    ...anchor,
    position: settled.get(anchor.id) ?? anchor.position,
  }));
  const segments: Segment[] = [];
  for (let i = 1; i < anchors.length; i++) {
    const [from, to] = [anchors[i - 1], anchors[i]];
    const kept = findSegment(trace.segments, from, to);
    if (kept) {
      segments.push(kept);
      continue;
    }
    const index = pairs.findIndex(
      (p) => p.fromAnchorId === from.id && p.toAnchorId === to.id,
    );
    if (index < 0) return { refusal: "Il manque une portion de route." };
    const route = routes[index];
    const last = route.points.length - 1;
    segments.push({
      fromAnchorId: from.id,
      toAnchorId: to.id,
      points: route.points.map((point, j) =>
        j === 0 ? from.position : j === last ? to.position : point,
      ),
      ways: route.ways,
      length: route.length,
    });
  }
  return { trace: { ...trace, anchors, segments } };
};

/** Les segments d'un seul tenant : chaque jonction n'apparaît qu'une fois. L'aller seul, pour un aller-retour. */
export const assembleRoad = (segments: Segment[]): LatLon[] => {
  const points: LatLon[] = [];
  for (const segment of segments)
    for (const point of segment.points) {
      const last = points[points.length - 1];
      if (!last || last.lat !== point.lat || last.lon !== point.lon)
        points.push(point);
    }
  return points;
};

/** Le tracé complet, retour compris : ce que le GPX contient. */
export const assembleTrace = (
  trace: Pick<EditorTrace, "segments" | "returnRoute">,
): LatLon[] => trace.returnRoute?.path ?? assembleRoad(trace.segments);

/** Ce qui se roule deux fois compte deux fois. */
export const traceLength = (trace: EditorTrace): number => {
  if (!trace.returnRoute)
    return trace.segments.reduce((total, segment) => total + segment.length, 0);
  const { path } = trace.returnRoute;
  return path.reduce(
    (total, point, i) => (i > 0 ? total + distance(path[i - 1], point) : 0),
    0,
  );
};

/** Longueur roulée au chrono, hors vraie route gardée à chaque bout. */
export const stageLength = (trace: EditorTrace): number =>
  Math.max(0, traceLength(trace) - 2 * EDITOR_RUNOFF);

/** Distance de chaque point depuis le premier, pour le panneau latéral. */
export const anchorDistances = (trace: EditorTrace): number[] => {
  let total = 0;
  return trace.anchors.map((_, i) => {
    if (i > 0) total += trace.segments[i - 1]?.length ?? 0;
    return total;
  });
};
