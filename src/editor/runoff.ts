// Route au-delà des lignes : le premier point est le départ, le dernier l'arrivée, et ce prolongement reste hors du chrono.
import { RouteRefused, type FetchRoute } from "@/geo/brouter";
import {
  EDITOR_RUNOFF,
  EDITOR_RUNOFF_BEARINGS,
  EDITOR_RUNOFF_PROBE,
  EDITOR_RUNOFF_REACH,
  RUNOFF_CLEARANCE,
  RUNOFF_ROOT,
} from "@/geo/config";
import { closestOnPolyline, project, unproject, type LatLon } from "@/geo/gpx";
import type { Runoff } from "./types";

/** Pas de contrôle le long d'un prolongement, en mètres : BRouter peut laisser une longue portion sans sommet */
const CLEARANCE_STEP = 10;
/** Écart toléré sur la longueur d'un prolongement déjà calculé, en mètres */
const RUNOFF_LENGTH_TOLERANCE = 10;

const samePoint = (a: LatLon, b: LatLon): boolean =>
  a.lat === b.lat && a.lon === b.lon;

const gap = (a: LatLon, b: LatLon): number => {
  const { x, z } = project(b, a);
  return Math.hypot(x, z);
};

/** Le point à `meters` en suivant `points`, le dernier s'ils sont plus courts. */
const pointAlong = (points: LatLon[], meters: number): LatLon => {
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    walked += gap(points[i - 1], points[i]);
    if (walked >= meters) return points[i];
  }
  return points[points.length - 1];
};

export const runoffProbe = (road: LatLon[]): LatLon =>
  pointAlong(road, EDITOR_RUNOFF_PROBE);

/** Le point à `meters` de la ligne, en s'éloignant de la route avec un écart de `bearing` degrés. */
const targetFrom = (
  road: LatLon[],
  bearing: number,
  meters: number,
): LatLon => {
  const anchor = road[0];
  const { x, z } = project(runoffProbe(road), anchor);
  const norm = Math.hypot(x, z) || 1;
  const angle = (bearing * Math.PI) / 180;
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const awayX = -x / norm;
  const awayZ = -z / norm;
  return unproject(
    {
      x: (awayX * cos - awayZ * sin) * meters,
      z: (awayX * sin + awayZ * cos) * meters,
    },
    anchor,
  );
};

/** Les `meters` premiers mètres, coupés au point près. `null` : la route est plus courte. */
const cutAt = (points: LatLon[], meters: number): LatLon[] | null => {
  const cut = [points[0]];
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const step = gap(points[i - 1], points[i]);
    if (walked + step < meters) {
      walked += step;
      cut.push(points[i]);
      continue;
    }
    const t = step > 0 ? (meters - walked) / step : 0;
    cut.push({
      lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t,
      lon: points[i - 1].lon + (points[i].lon - points[i - 1].lon) * t,
    });
    return cut;
  }
  return null;
};

/** Passé la racine, le prolongement reste à l'écart de la spéciale : sinon, il repart sur la route déjà tracée. */
const clearsRoad = (run: LatLon[], road: LatLon[]): boolean => {
  const origin = road[0];
  const plane = road.map((point) => project(point, origin));
  let walked = 0;
  for (let i = 1; i < run.length; i++) {
    const step = gap(run[i - 1], run[i]);
    const samples = Math.max(1, Math.ceil(step / CLEARANCE_STEP));
    for (let k = 1; k <= samples; k++) {
      if (walked + (step * k) / samples < RUNOFF_ROOT) continue;
      const t = k / samples;
      const point = project(
        {
          lat: run[i - 1].lat + (run[i].lat - run[i - 1].lat) * t,
          lon: run[i - 1].lon + (run[i].lon - run[i - 1].lon) * t,
        },
        origin,
      );
      if (closestOnPolyline(point, plane).distance < RUNOFF_CLEARANCE)
        return false;
    }
    walked += step;
  }
  return true;
};

/**
 * Le prolongement vaut tant que la ligne et le début de la route n'ont pas bougé, et que le tracé ne l'a pas rejoint :
 * un point ajouté plus tard peut passer dessus. `road` part de la ligne.
 */
export const isFreshRunoff = (
  runoff: Runoff | null | undefined,
  road: LatLon[],
): runoff is Runoff =>
  !!runoff &&
  samePoint(runoff.points[0], road[0]) &&
  samePoint(runoff.probe, runoffProbe(road)) &&
  // Sans route trouvée, chaque geste redemande : il a pu libérer le passage.
  !runoff.invented &&
  // Un brouillon d'une autre longueur déplacerait la ligne, le GPX annonçant `EDITOR_RUNOFF`. La marge : BRouter ne s'accroche pas pile sur le point.
  Math.abs(
    runoff.points.reduce(
      (total, point, i) =>
        i > 0 ? total + gap(runoff.points[i - 1], point) : 0,
      0,
    ) - EDITOR_RUNOFF,
  ) < RUNOFF_LENGTH_TOLERANCE &&
  clearsRoad(runoff.points, road);

/**
 * Aucune route libre : une ligne droite provisoire, pour que le tracé s'analyse quand même.
 * Jamais roulée ni montrée : `missingRunoff` bloque « Rouler », car une route inventée n'a pas sa place dans le jeu.
 */
export const straightRunoff = (road: LatLon[]): Runoff => ({
  points: [road[0], targetFrom(road, 0, EDITOR_RUNOFF)],
  probe: runoffProbe(road),
  invented: true,
});

/**
 * La vraie route d'abord, droit devant puis de biais : BRouter y part parfois sur la route déjà tracée, ce qui est refusé ici.
 * `road` part de la ligne. `before` : la route se roule vers la ligne, pour respecter les sens uniques.
 */
export const fetchRunoff = async (
  road: LatLon[],
  before: boolean,
  fetchRoute: FetchRoute,
  signal: AbortSignal,
): Promise<Runoff> => {
  const anchor = road[0];
  for (const bearing of EDITOR_RUNOFF_BEARINGS) {
    const target = targetFrom(road, bearing, EDITOR_RUNOFF_REACH);
    // Le sens de la route d'abord, puis l'autre : un sens unique ferait faire le tour à BRouter, et rien ne l'impose hors du chrono.
    for (const towardsLine of [before, !before]) {
      try {
        const { points } = towardsLine
          ? await fetchRoute(target, anchor, { signal })
          : await fetchRoute(anchor, target, { signal });
        const away = towardsLine ? [...points].reverse() : points;
        const run = away.length >= 2 ? cutAt(away, EDITOR_RUNOFF) : null;
        if (run && clearsRoad(run, road)) {
          run[0] = anchor;
          return { points: run, probe: runoffProbe(road), invented: false };
        }
      } catch (error) {
        // Une panne se réessaie comme pour le reste du tracé. Seul un refus veut dire qu'il n'y a pas de route par là.
        if (signal.aborted || !(error instanceof RouteRefused)) throw error;
      }
    }
  }
  return straightRunoff(road);
};
