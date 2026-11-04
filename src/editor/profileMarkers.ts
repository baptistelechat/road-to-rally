// Ce que le profil d'altitude repère : points, chicanes et ronds-points, ramenés à une abscisse de l'axe. Pur.
import type { LatLon } from "@/geo/gpx";
import { STEP } from "@/geo/config";
import { isRock } from "@/geo/roundabouts";
import { splitGates } from "@/sim/splits";
import { nearestIndex } from "./hover";
import type { ChicaneSide } from "./types";

export type ProfileMarkerKind = "point" | "chicane" | "split";

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
  /** Intermédiaire : cap de la route en degrés, depuis le nord dans le sens horaire */
  bearing?: number;
}

/** Cap en degrés, depuis le nord dans le sens horaire. */
export const bearing = (a: LatLon, b: LatLon): number => {
  const east = (b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180);
  return (Math.atan2(east, b.lat - a.lat) * 180) / Math.PI;
};

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

/**
 * Intermédiaires de la course, ramenés à l'axe de l'éditeur. Le jeu mesure la spéciale en 3D (`createTrack`) : avec les
 * altitudes du profil, la même longueur, donc le même nombre d'intermédiaires au même endroit. Sans elles, à plat.
 * ponytail: profil IGN à 20 m contre altitudes du pipeline : quelques centimètres d'écart, assez pour basculer le
 * nombre seulement si la spéciale tombe à quelques mètres d'un multiple de 1 500 m.
 */
export const splitMarkers = (
  axis: LatLon[],
  runoffPoints: number,
  altitudes: number[] | null,
): ProfileMarker[] => {
  const first = runoffPoints;
  const last = axis.length - 1 - runoffPoints;
  if (last <= first) return [];
  const z = altitudes?.length === axis.length ? altitudes : null;
  const walked = [0];
  for (let i = first + 1; i <= last; i++)
    walked.push(
      walked[walked.length - 1] +
        (z ? Math.hypot(STEP, z[i] - z[i - 1]) : STEP),
    );
  let k = 0;
  return splitGates(0, walked[walked.length - 1]).map((gate, n) => {
    while (walked[k + 1] < gate) k++;
    const t = (gate - walked[k]) / (walked[k + 1] - walked[k]);
    const at = first + k + Math.round(t);
    return {
      kind: "split" as const,
      s: (first + k + t) * STEP,
      label: `Intermédiaire ${n + 1}`,
      position: axis[at],
      bearing: bearing(axis[Math.max(0, at - 1)], axis[Math.min(axis.length - 1, at + 1)]),
    };
  });
};
