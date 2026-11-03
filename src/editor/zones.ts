// Ce qu'on pose sur la carte occupe une zone le long de la route, pas un point. Pure et sans type d'élément : les chicanes en sont le premier usage.
import { STEP } from "@/geo/config";

export interface AxisZone {
  id: string;
  /** Centre, en point de l'axe */
  index: number;
  /** Distance couverte de chaque côté du centre, le long de la route, en mètres */
  reach: number;
}

/** Deux zones ne se recouvrent pas : c'est la règle d'écart entre deux éléments. */
export const zonesOverlap = (a: AxisZone, b: AxisZone): boolean =>
  Math.abs(a.index - b.index) * STEP < a.reach + b.reach;

/** Les zones qui en recouvrent une autre. */
export const overlappingZones = (zones: AxisZone[]): Set<string> =>
  new Set(
    zones
      .filter((zone) =>
        zones.some((other) => other !== zone && zonesOverlap(zone, other)),
      )
      .map(({ id }) => id),
  );

/** Les points de l'axe couverts, bornes comprises et sans sortir de l'axe. */
export const zoneSpan = (
  { index, reach }: AxisZone,
  pointCount: number,
): [number, number] => {
  const points = Math.round(reach / STEP);
  return [
    Math.max(0, index - points),
    Math.min(pointCount - 1, index + points),
  ];
};
