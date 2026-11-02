// Variantes d'un segment (story 3.10) : recherche à la demande, sans jamais toucher au tracé.
import type { AnalyzeOptions, TraceAnalysis } from "@/geo/analyzeTrace";
import {
  RouteRefused,
  type BRouterRoute,
  type FetchRoute,
} from "@/geo/brouter";
import { VARIANT_REQUESTS, VARIANT_SAME_ROUTE_GAP } from "@/geo/config";
import { StageError } from "@/geo/errors";
import { closestOnPolyline, project, type LatLon } from "@/geo/gpx";
import { computeTraceStats } from "@/geo/traceStats";
import { traceToGpx } from "./gpxExport";
import { applyRoutes, stageLength, type TraceEdit } from "./trace";
import type { EditorTrace } from "./types";

export interface RouteVariant {
  alternativeIdx: number;
  /** Le tracé complet si le joueur la choisit */
  trace: EditorTrace;
  points: LatLon[];
  /** Longueur de la spéciale avec cette variante, en mètres */
  length: number;
  turnsPerKm: number;
}

export interface VariantSearch {
  /** La plus sinueuse d'abord */
  variants: RouteVariant[];
  /** Vraies autres routes écartées : garde-fous ou longueur */
  rejected: number;
  /** Le réseau a lâché : la liste est partielle */
  failure: string | null;
}

export type AnalyzeFn = (
  gpx: string,
  options: AnalyzeOptions,
  signal: AbortSignal,
) => Promise<TraceAnalysis>;

/** Un trajet à l'écart de l'autre, de part ou d'autre, n'est pas le même. Mesuré aux sommets : BRouter en met à chaque virage. */
export const sameRoute = (a: LatLon[], b: LatLon[]): boolean => {
  const origin = a[0];
  const planeA = a.map((p) => project(p, origin));
  const planeB = b.map((p) => project(p, origin));
  const within = (from: typeof planeA, to: typeof planeA): boolean =>
    from.every(
      (p) => closestOnPolyline(p, to).distance <= VARIANT_SAME_ROUTE_GAP,
    );
  return within(planeA, planeB) && within(planeB, planeA);
};

const editSegment = (trace: EditorTrace, segmentIndex: number): TraceEdit => {
  const from = trace.anchors[segmentIndex];
  const to = trace.anchors[segmentIndex + 1];
  return {
    trace: {
      ...trace,
      segments: trace.segments.filter((_, i) => i !== segmentIndex),
    },
    pairs: [
      {
        fromAnchorId: from.id,
        toAnchorId: to.id,
        from: from.position,
        to: to.position,
      },
    ],
  };
};

/** Une requête après l'autre, les quatre au plus, jamais en parallèle sur le serveur public. */
export const findVariants = async (
  trace: EditorTrace,
  segmentIndex: number,
  fetchRoute: FetchRoute,
  analyze: AnalyzeFn,
  signal: AbortSignal,
): Promise<VariantSearch> => {
  const edit = editSegment(trace, segmentIndex);
  const { from, to } = edit.pairs[0];
  const seen = [trace.segments[segmentIndex].points];
  const variants: RouteVariant[] = [];
  let rejected = 0;
  let failure: string | null = null;

  for (
    let alternativeIdx = 0;
    alternativeIdx < VARIANT_REQUESTS;
    alternativeIdx++
  ) {
    let route: BRouterRoute;
    try {
      route = await fetchRoute(from, to, { alternativeIdx, signal });
    } catch (error) {
      if (signal.aborted) throw error;
      // « Pas d'itinéraire à cet index » n'est pas une panne : quatre index ne garantissent pas quatre routes.
      if (error instanceof RouteRefused) continue;
      failure =
        error instanceof StageError
          ? error.message
          : "La recherche d'autres routes a échoué. Réessaie dans un moment.";
      break;
    }
    if (route.points.length < 2) continue;
    if (seen.some((known) => sameRoute(known, route.points))) continue;
    seen.push(route.points);

    const applied = applyRoutes(edit, [route]);
    if (applied.refusal !== undefined) {
      rejected++;
      continue;
    }
    const candidate = applied.trace;
    const { axis, issues } = await analyze(
      traceToGpx({ ...candidate, name: "" }),
      { widthsByHighway: candidate.segments },
      signal,
    );
    if (!axis || issues.some((issue) => issue.blocking)) {
      rejected++;
      continue;
    }
    variants.push({
      alternativeIdx,
      trace: candidate,
      points: route.points,
      length: stageLength(candidate),
      turnsPerKm: computeTraceStats(axis.points, axis.runoffPoints).turnsPerKm,
    });
  }
  // `sort` est stable : à égalité, l'ordre de BRouter.
  variants.sort((a, b) => b.turnsPerKm - a.turnsPerKm);
  return { variants, rejected, failure };
};
