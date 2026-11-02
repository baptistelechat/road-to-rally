// Chicanes automatiques sur l'axe analysé, pures et sans réseau : le pipeline recalcule le placement final avec les vraies largeurs.
import type { AnalyzedAxis, HighwaySegment } from "@/geo/analyzeTrace";
import { placeChicanes } from "@/geo/chicanes";
import { deduceRoadAttributes, type OsmWay } from "@/geo/osm";
import type { AutoChicanes } from "./types";

/**
 * Les portions de BRouter vues comme des voies OSM, comme dans `analyzeTrace`.
 */
// ponytail: copie de `toOsmWays`, privé dans `analyzeTrace.ts` ; à exporter de là-bas pour n'en garder qu'un.
const toOsmWays = (segments: HighwaySegment[]): OsmWay[] =>
  segments.flatMap(({ points, ways }) =>
    ways.flatMap((way, i) => {
      const geometry = points.slice(
        way.fromIndex,
        (ways[i + 1]?.fromIndex ?? points.length - 1) + 1,
      );
      if (geometry.length < 2) return [];
      const tags: Record<string, string> = way.highway
        ? { highway: way.highway }
        : {};
      return [{ id: i, tags, geometry }];
    }),
  );

/**
 * Sur un aller-retour, seul le bras en reçoit : arrêter la recherche à la jonction écarte la boucle, le retour et la fourche,
 * et le dégagement de la ligne s'applique à la jonction. Une chicane du bras se franchit dans les deux sens.
 */
export const computeAutoChicanes = (
  axis: AnalyzedAxis,
  segments?: HighwaySegment[],
): AutoChicanes => {
  const { points, latLon, runoffPoints, roundTrip } = axis;
  const { widths } = deduceRoadAttributes(
    axis,
    segments ? toOsmWays(segments) : null,
  );
  const flat = points.map(({ x, z }) => ({ x, y: 0, z }));
  const abscissae = [0];
  for (let i = 1; i < points.length; i++)
    abscissae.push(
      abscissae[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].z - points[i - 1].z,
        ),
    );
  const last = roundTrip ? roundTrip.armEnd : points.length - 1 - runoffPoints;
  // Le premier point à cette abscisse : l'aperçu n'a pas besoin de mieux qu'un point de l'axe.
  const pointAt = (s: number): number =>
    abscissae.findIndex((value) => value >= s);
  const { chicanes, tooNarrow } = placeChicanes(flat, widths, {
    startS: abscissae[runoffPoints],
    finishS: abscissae[Math.max(runoffPoints, last)],
    excluded: [],
  });
  return {
    chicanes: chicanes.map(({ s, side }) => ({
      position: latLon[pointAt(s)],
      side,
    })),
    tooNarrow: tooNarrow.length,
  };
};
