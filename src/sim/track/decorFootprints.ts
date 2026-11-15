import { createSpatialGrid } from "./spatialGrid";
import type { StageDecor } from "../types";

interface PlanePoint {
  x: number;
  z: number;
}

/** Côté des mailles de l'index, en mètres : bien plus grand que les marges, assez petit pour un centre-bourg */
const FOOTPRINT_CELL = 25;
/** Rien ne se pose à moins de ça d'un mur, en mètres : ni panneau, ni botte, ni spectateur */
export const DECOR_BUILDING_MARGIN = 0.8;

const segmentDistance = (
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number => {
  const dx = bx - ax;
  const dz = bz - az;
  const length2 = dx * dx + dz * dz;
  const t =
    length2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length2));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
};

/**
 * Test « dans un polygone ou à moins de `margin` de l'un de ses bords », par mailles. Un polygone est une liste
 * d'anneaux (contour puis trous) : la règle pair-impair, polygone par polygone, exclut les trous. Pur.
 */
export const createPolygonTest = (
  polygons: PlanePoint[][][],
  margin: number,
): ((x: number, z: number) => boolean) => {
  // Arêtes à plat : (ax, az, bx, bz) et polygone d'origine.
  const coords: number[] = [];
  const owner: number[] = [];
  // Bandes horizontales : un rayon vers +x ne croise que les arêtes de sa bande.
  const rows = new Map<number, number[]>();
  const near = createSpatialGrid(FOOTPRINT_CELL);
  polygons.forEach((rings, polygon) => {
    for (const ring of rings) {
      if (ring.length < 3) continue;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j];
        const b = ring[i];
        const id = owner.length;
        coords.push(a.x, a.z, b.x, b.z);
        owner.push(polygon);
        const minZ = Math.min(a.z, b.z);
        const maxZ = Math.max(a.z, b.z);
        // Ajoutées polygone après polygone : chaque bande reste triée par polygone.
        for (
          let row = Math.floor(minZ / FOOTPRINT_CELL);
          row <= Math.floor(maxZ / FOOTPRINT_CELL);
          row++
        ) {
          const list = rows.get(row);
          if (list) list.push(id);
          else rows.set(row, [id]);
        }
        if (margin > 0)
          near.insert(
            id,
            Math.min(a.x, b.x) - margin,
            minZ - margin,
            Math.max(a.x, b.x) + margin,
            maxZ + margin,
          );
      }
    }
  });
  if (owner.length === 0) return () => false;

  return (x, z) => {
    if (margin > 0) {
      const close = near.at(
        Math.floor(x / FOOTPRINT_CELL),
        Math.floor(z / FOOTPRINT_CELL),
      );
      if (close)
        for (const id of close) {
          const k = id * 4;
          if (
            segmentDistance(
              x,
              z,
              coords[k],
              coords[k + 1],
              coords[k + 2],
              coords[k + 3],
            ) < margin
          )
            return true;
        }
    }
    const band = rows.get(Math.floor(z / FOOTPRINT_CELL));
    if (!band) return false;
    let current = -1;
    let inside = false;
    for (const id of band) {
      if (owner[id] !== current) {
        if (inside) return true;
        current = owner[id];
        inside = false;
      }
      const k = id * 4;
      const az = coords[k + 1];
      const bz = coords[k + 3];
      if (az > z !== bz > z) {
        const ax = coords[k];
        const bx = coords[k + 2];
        if (x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
      }
    }
    return inside;
  };
};

export interface DecorFootprints {
  /** Dans un bâtiment ou à moins de `DECOR_BUILDING_MARGIN` de ses murs */
  inBuilding: (x: number, z: number) => boolean;
  /** Dans une surface d'eau (son contour seul) */
  inWater: (x: number, z: number) => boolean;
}

const nowhere = (): boolean => false;

/** Emprises du décor réel pour écarter le mobilier de la story 1.7 et le public. Sans décor, rien n'est écarté. */
export const createDecorFootprints = (
  decor: StageDecor | undefined,
): DecorFootprints => {
  if (!decor) return { inBuilding: nowhere, inWater: nowhere };
  return {
    inBuilding: createPolygonTest(
      decor.buildings.map(({ footprint }) => [footprint]),
      DECOR_BUILDING_MARGIN,
    ),
    // Seul `outline` est lu : la forme de `DecorWater` peut s'enrichir sans toucher à ce filtre.
    inWater: createPolygonTest(
      decor.water.map(({ outline }) => [outline]),
      0,
    ),
  };
};
