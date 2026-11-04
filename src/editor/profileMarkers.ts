// Ce que le profil d'altitude repère : points, chicanes et ronds-points, ramenés à une abscisse de l'axe. Pur.
import type { LatLon } from "@/geo/gpx";
import { STEP } from "@/geo/config";
import { isRock } from "@/geo/roundabouts";
import { nearestIndex } from "./hover";
import type { ChicaneSide } from "./types";

export type ProfileMarkerKind = "point" | "chicane";

export interface ProfileMarker {
  kind: ProfileMarkerKind;
  /** Abscisse sur l'axe entier, prolongement compris, en mètres */
  s: number;
  label: string;
  position: LatLon;
  /** Chicane : côté du premier bloc, pour dessiner son panneau dans le bon sens */
  side?: ChicaneSide;
  /** Chicane placée par le joueur */
  player?: boolean;
}

/** Au-delà du bord de l'îlot, en mètres : une demi-chaussée large, la marge, et un peu des bras */
const RING_REACH = 6;

export type ProfileBandKind =
  | "roundabout"
  | "rock"
  | "chicane"
  | "straight"
  | "median";

export interface ProfileBand {
  fromS: number;
  toS: number;
  kind: ProfileBandKind;
  label: string;
  position: LatLon;
}

/**
 * Chaque point est cherché après le précédent : un aller-retour repasse au même endroit.
 * ponytail: plus proche point en avançant, sans tolérance ; suffit tant que les points suivent l'ordre du tracé.
 */
export const anchorMarkers = (
  axis: LatLon[],
  anchors: LatLon[],
): ProfileMarker[] => {
  let from = 0;
  return anchors.map((position, i) => {
    from += nearestIndex(axis.slice(from), position);
    return { kind: "point", s: from * STEP, label: `Point ${i + 1}`, position };
  });
};

/** Le rond-point couvre les points de l'axe à moins de `RING_REACH` du bord de l'îlot : la route roulée passe à une demi-chaussée de lui. */
export const roundaboutBands = (
  axis: LatLon[],
  roundabouts: { position: LatLon; radius: number }[],
): ProfileBand[] =>
  roundabouts.flatMap(({ position, radius }, i) => {
    const cosLat = Math.cos((position.lat * Math.PI) / 180);
    // Mètres par degré de latitude
    const reach = ((radius + RING_REACH) / 111_320) ** 2;
    const inside = axis.flatMap(({ lat, lon }, j) =>
      (lat - position.lat) ** 2 + ((lon - position.lon) * cosLat) ** 2 <= reach
        ? [j]
        : [],
    );
    // Un aller-retour y passe deux fois : une bande par passage.
    const runs: [number, number][] = [];
    inside.forEach((j) => {
      const last = runs[runs.length - 1];
      if (last && j - last[1] <= 1) last[1] = j;
      else runs.push([j, j]);
    });
    return runs.map(([from, to]) => ({
      fromS: from * STEP,
      toS: to * STEP,
      kind: isRock(radius) ? "rock" : "roundabout",
      label: `${isRock(radius) ? "Rocher" : "Rond-point"} ${i + 1}`,
      position,
    }));
  });

/** Au-delà de la glissière, en mètres : la chaussée qui la longe, de chaque côté */
const MEDIAN_REACH = 5;

/** Une bande par passage le long de chaque glissière : l'aller puis le retour, chacun sur sa chaussée. */
export const medianBands = (
  axis: LatLon[],
  medians: LatLon[][],
): ProfileBand[] =>
  medians.flatMap((barrier, i) => {
    const cosLat = Math.cos((barrier[0].lat * Math.PI) / 180);
    const reach = (MEDIAN_REACH / 111_320) ** 2;
    const inside = axis.flatMap(({ lat, lon }, j) =>
      barrier.some(
        (b) => (lat - b.lat) ** 2 + ((lon - b.lon) * cosLat) ** 2 <= reach,
      )
        ? [j]
        : [],
    );
    const runs: [number, number][] = [];
    inside.forEach((j) => {
      const last = runs[runs.length - 1];
      if (last && j - last[1] <= 2) last[1] = j;
      else runs.push([j, j]);
    });
    const middle = barrier[Math.floor(barrier.length / 2)];
    return runs.map(([from, to]) => ({
      fromS: from * STEP,
      toS: to * STEP,
      kind: "median" as const,
      label: `Glissière ${i + 1}`,
      position: middle,
    }));
  });
