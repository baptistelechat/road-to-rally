// Aller-retour de l'éditeur (story 3.7). Seul le retournement part au réseau : le reste du retour recopie l'aller.
import { RouteRefused, type FetchRoute } from "@/geo/brouter";
import { EDITOR_RETURN_LEAD, EDITOR_RETURN_PROBE } from "@/geo/config";
import { splitRoundTrip, type LatLon } from "@/geo/gpx";
import { assembleRoad, distance } from "./trace";
import type { EditorTrace, ReturnRoute } from "./types";

export const RETURN_REFUSED =
  "Impossible de revenir par la même route depuis ce point : il n'y a ni rond-point ni boucle pour faire demi-tour. Place le dernier point au fond d'un rond-point.";

export const RETURN_LOST =
  "Le tracé a changé et le retour n'est plus possible : il repasse en aller simple. Ctrl+Z le rétablit.";

/** Index du point situé à `meters` en amont de `from`, le premier du tracé s'il est plus court. */
const pointBefore = (
  points: LatLon[],
  from: number,
  meters: number,
): number => {
  let walked = 0;
  for (let i = from; i > 0; i--) {
    walked += distance(points[i - 1], points[i]);
    if (walked >= meters) return i - 1;
  }
  return 0;
};

const reversed = (points: LatLon[]): LatLon[] => [...points].reverse();

/**
 * `go` : l'aller. `back` : la vraie route du dernier point vers `go[returnProbe(go)]`.
 * Le découpage ne porte que sur la fin de l'aller : les points d'avant restent ceux de BRouter, et sa recherche reste courte.
 * `null` : pas de boucle au bout, c'est un cul-de-sac.
 */
export const buildReturnRoute = (
  go: LatLon[],
  back: LatLon[],
): ReturnRoute | null => {
  const probe = returnProbe(go);
  const leadFrom = pointBefore(go, probe, EDITOR_RETURN_LEAD);
  const lead = go.slice(leadFrom, probe);
  const split = splitRoundTrip(
    [...go.slice(leadFrom), ...back.slice(1), ...reversed(lead)],
    go.length - 1 - leadFrom,
  );
  if (!split) return null;
  const before = go.slice(0, leadFrom);
  return {
    path: [...before, ...split.path, ...reversed(before)],
    realReturn: [...split.realReturn, ...reversed(before)],
  };
};

/** Le point de l'aller vers lequel demander le retour à BRouter. */
export const returnProbe = (go: LatLon[]): number =>
  pointBefore(go, go.length - 1, EDITOR_RETURN_PROBE);

/** Un point refusé par BRouter revient au même qu'un cul-de-sac. Une panne lève : le geste se réessaie. */
export const fetchReturnRoute = async (
  { segments }: Pick<EditorTrace, "segments">,
  fetchRoute: FetchRoute,
  signal: AbortSignal,
): Promise<ReturnRoute | null> => {
  const go = assembleRoad(segments);
  if (go.length < 2) return null;
  try {
    const { points } = await fetchRoute(
      go[go.length - 1],
      go[returnProbe(go)],
      { signal },
    );
    return buildReturnRoute(go, points);
  } catch (error) {
    if (error instanceof RouteRefused) return null;
    throw error;
  }
};
