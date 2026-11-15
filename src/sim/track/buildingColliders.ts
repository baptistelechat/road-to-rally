import type { DecorBuilding, Track } from "../types";
import { NEAR_SCENERY_DISTANCE } from "./scenery";

/** Partie enterrée sous `base` : le pied le plus bas est pris sur l'emprise, un sol en pente ne laisse pas de jour sous le mur. */
export const BUILDING_SKIRT = 0.5;
/** Demi-épaisseur minimale d'une boîte de repli, pour une emprise dégénérée (alignée ou réduite à un point) */
const MIN_HALF_EXTENT = 0.05;

/** Bâtiments dont un sommet de l'emprise passe à moins de `NEAR_SCENERY_DISTANCE` de l'axe, dans l'ordre trié du pipeline. */
export const nearBuildings = (track: Track): DecorBuilding[] =>
  // ponytail: test sur les sommets seuls, un mur de plus de 80 m qui longe l'axe sans sommet proche serait oublié.
  (track.decor?.buildings ?? []).filter((building) =>
    building.footprint.some(
      (p) => track.nearest(p.x, p.z).distance <= NEAR_SCENERY_DISTANCE,
    ),
  );

/**
 * Sommets du prisme : l'emprise au pied (enterré) puis au sommet des murs, à passer à `convexHull`.
 * Sur une emprise concave (ferme en L ou en U), Rapier en prend l'enveloppe convexe : toujours plus serrée que la boîte
 * orientée englobante, et la route ne passe jamais dans la cour d'une ferme.
 */
export const buildingHullPoints = (building: DecorBuilding): Float32Array => {
  const { footprint, base, height } = building;
  const points = new Float32Array(footprint.length * 6);
  footprint.forEach((p, i) => {
    const k = i * 6;
    points[k] = points[k + 3] = p.x;
    points[k + 1] = base - BUILDING_SKIRT;
    points[k + 4] = base + height;
    points[k + 2] = points[k + 5] = p.z;
  });
  return points;
};

/** Boîte orientée sur Y : centre, demi-tailles et lacet comme les blocs de chicane (axe X local = (cos, -sin)). */
export interface BuildingBox {
  center: { x: number; y: number; z: number };
  half: { x: number; y: number; z: number };
  yaw: number;
}

/** Repli si `convexHull` échoue : plus petite boîte englobante alignée sur un mur de l'emprise. */
export const buildingBox = (building: DecorBuilding): BuildingBox => {
  const { footprint, base, height } = building;
  const low = base - BUILDING_SKIRT;
  const high = base + height;
  let best: BuildingBox | null = null;
  let bestArea = Infinity;
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i];
    const b = footprint[(i + 1) % footprint.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length === 0) continue;
    const ux = (b.x - a.x) / length;
    const uz = (b.z - a.z) / length;
    // Projection sur le mur (u) et sur sa normale (v).
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of footprint) {
      const u = p.x * ux + p.z * uz;
      const v = p.z * ux - p.x * uz;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area >= bestArea) continue;
    bestArea = area;
    const cu = (minU + maxU) / 2;
    const cv = (minV + maxV) / 2;
    best = {
      center: {
        x: cu * ux - cv * uz,
        y: (low + high) / 2,
        z: cu * uz + cv * ux,
      },
      half: {
        x: Math.max((maxU - minU) / 2, MIN_HALF_EXTENT),
        y: (high - low) / 2,
        z: Math.max((maxV - minV) / 2, MIN_HALF_EXTENT),
      },
      yaw: Math.atan2(-uz, ux),
    };
  }
  // Emprise réduite à un point : une boîte minuscule plutôt que rien.
  const p = footprint[0] ?? { x: 0, z: 0 };
  return (
    best ?? {
      center: { x: p.x, y: (low + high) / 2, z: p.z },
      half: { x: MIN_HALF_EXTENT, y: (high - low) / 2, z: MIN_HALF_EXTENT },
      yaw: 0,
    }
  );
};
