// Ponts de la spéciale : découpe le long de l'axe et choix du style (règle mixte validée au labo, onglet Ponts).
import type { BridgeStyle, StageBridge, Vec3 } from "../sim/types";

export interface BridgeContext {
  /** Longueur de l'ouvrage, en mètres */
  length: number;
  /** Hauteur de la chaussée au-dessus du point le plus bas dessous (eau ou sol), en mètres */
  height: number;
  /** L'ouvrage franchit de l'eau */
  overWater: boolean;
  /** Petite route (tertiaire et en dessous) : là où survivent les vieux ponts métalliques */
  minorRoad: boolean;
  /** En agglomération : les ponts de bourg sont presque tous anciens et en pierre */
  urban: boolean;
}

/** Hauteur à partir de laquelle un ouvrage hors agglomération devient un viaduc, en mètres */
export const VIADUCT_HEIGHT = 12;
/** Longueur maximale d'un pont de pierre hors agglomération, en mètres */
export const STONE_MAX_LENGTH = 40;
/** Longueur maximale d'un pont en treillis, en mètres */
export const TRUSS_MAX_LENGTH = 100;

/**
 * Règle mixte, dans l'ordre : pierre en agglomération hors grande route (vieux viaducs compris, Clisson) ;
 * viaduc dès 12 m de haut ; pierre si court ; treillis sur l'eau d'une petite route ; béton pour le reste.
 * ponytail: aucune source ne donne le matériau (BD TOPO muette, Overpass en panne) ; `material` et
 * `bridge:structure` d'OSM passeraient avant cette règle le jour où ils seront disponibles.
 */
export const bridgeStyleFor = ({
  length,
  height,
  overWater,
  minorRoad,
  urban,
}: BridgeContext): BridgeStyle =>
  urban && minorRoad
    ? "stone"
    : height >= VIADUCT_HEIGHT
      ? "viaduct"
      : length <= STONE_MAX_LENGTH
        ? "stone"
        : overWater && minorRoad && length <= TRUSS_MAX_LENGTH
          ? "steel"
          : "concrete";

/** Classes de grandes routes : ni pont de pierre en ville, ni treillis */
const MAJOR_ROADS = new Set([
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
]);

/**
 * Une entrée par suite de points sur un pont. `tags` : les tags de la voie en chaque point, `null` hors pont.
 * `groundAt` : sol brut sous le point i (le fond de vallée que donne l'IGN), `wet` : le pont passe-t-il sur l'eau en i.
 * `edge` : demi-largeur du tablier en chaque point.
 */
export const findStageBridges = (
  points: Vec3[],
  tags: (Record<string, string> | null)[],
  groundAt: (i: number) => number,
  wet: (i: number) => boolean,
  edge: number[],
): StageBridge[] => {
  const bridges: StageBridge[] = [];
  let i = 0;
  while (i < points.length) {
    if (!tags[i]) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < points.length && tags[end + 1]) end++;
    if (end > i) {
      let length = 0;
      let height = 0;
      let overWater = false;
      let urban = false;
      let major = false;
      let halfWidth = 0;
      for (let k = i; k <= end; k++) {
        if (k > i)
          length += Math.hypot(
            points[k].x - points[k - 1].x,
            points[k].z - points[k - 1].z,
          );
        height = Math.max(height, points[k].y - groundAt(k));
        overWater ||= wet(k);
        urban ||= tags[k]?.urban === "yes";
        major ||= MAJOR_ROADS.has(tags[k]?.highway ?? "");
        halfWidth = Math.max(halfWidth, edge[k]);
      }
      bridges.push({
        from: i,
        to: end,
        style: bridgeStyleFor({
          length,
          height,
          overWater,
          minorRoad: !major,
          urban,
        }),
        halfWidth: Math.round(halfWidth * 1000) / 1000,
      });
    }
    i = end + 1;
  }
  return bridges;
};
