import type { MeshData } from "../types";
import { createSpatialGrid } from "./spatialGrid";

/** Côté d'une case, en mètres : la maille de la grille d'altitudes */
const CELL = 16;
/** Tolérance sur l'arête d'un triangle, en m² : un point sur une arête partagée ne tombe jamais entre les deux */
const EDGE_TOLERANCE = 1e-6;

/**
 * Hauteur exacte de maillages vus du dessus : la plus haute au point donné, `null` si aucun ne le couvre.
 * Le plus haut gagne : là où deux bandes se chevauchent, la chaussée passe avant le bas-côté.
 */
export const createMeshHeight = (
  meshes: MeshData[],
): ((x: number, z: number) => number | null) => {
  const count = meshes.reduce((sum, m) => sum + m.indices.length / 3, 0);
  const corners = new Float64Array(count * 9);
  const grid = createSpatialGrid(CELL);
  let t = 0;
  for (const { positions, indices } of meshes)
    for (let i = 0; i < indices.length; i += 3, t++) {
      const o = t * 9;
      for (let k = 0; k < 3; k++) {
        const v = indices[i + k] * 3;
        corners[o + k * 3] = positions[v];
        corners[o + k * 3 + 1] = positions[v + 1];
        corners[o + k * 3 + 2] = positions[v + 2];
      }
      grid.insert(
        t,
        Math.min(corners[o], corners[o + 3], corners[o + 6]),
        Math.min(corners[o + 2], corners[o + 5], corners[o + 8]),
        Math.max(corners[o], corners[o + 3], corners[o + 6]),
        Math.max(corners[o + 2], corners[o + 5], corners[o + 8]),
      );
    }

  return (x, z) => {
    const cell = grid.at(Math.floor(x / CELL), Math.floor(z / CELL));
    if (!cell) return null;
    let best: number | null = null;
    for (const id of cell) {
      const o = id * 9;
      const ax = corners[o];
      const az = corners[o + 2];
      const bx = corners[o + 3];
      const bz = corners[o + 5];
      const cx = corners[o + 6];
      const cz = corners[o + 8];
      // Trois aires signées, de même signe à l'intérieur quel que soit le sens du triangle.
      const u = (bx - x) * (cz - z) - (bz - z) * (cx - x);
      const v = (cx - x) * (az - z) - (cz - z) * (ax - x);
      const w = (ax - x) * (bz - z) - (az - z) * (bx - x);
      const area = u + v + w;
      if (area === 0) continue;
      const sign = area > 0 ? 1 : -1;
      if (
        u * sign < -EDGE_TOLERANCE ||
        v * sign < -EDGE_TOLERANCE ||
        w * sign < -EDGE_TOLERANCE
      )
        continue;
      const y =
        (u * corners[o + 1] + v * corners[o + 4] + w * corners[o + 7]) / area;
      if (best === null || y > best) best = y;
    }
    return best;
  };
};
