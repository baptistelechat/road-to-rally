// Niveau de l'eau en un point (story 5.9). Pur, sans aléa : la simulation et le pipeline lisent la même réponse.
import type { DecorWater } from "../types";
import { createSpatialGrid } from "./spatialGrid";

/** Côté d'une case de l'index, en mètres : la taille des cases d'eau d'une rivière en pente, à moitié */
const CELL = 16;

/** Règle pair-impair sur un contour, demi-ouverte en z : un trou inverse naturellement le résultat. */
const crossings = (
  ring: { x: number; z: number }[],
  x: number,
  z: number,
  inside: boolean,
): boolean => {
  let result = inside;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.z > z === b.z > z) continue;
    if (x < b.x + ((z - b.z) * (a.x - b.x)) / (a.z - b.z)) result = !result;
  }
  return result;
};

/** Le point est-il dans la surface, îles exclues ? */
export const insideWater = (
  surface: DecorWater,
  x: number,
  z: number,
): boolean => {
  let inside = crossings(surface.outline, x, z, false);
  for (const hole of surface.holes ?? [])
    inside = crossings(hole, x, z, inside);
  return inside;
};

/**
 * Niveau de l'eau en (x, z), `null` hors de l'eau. Deux surfaces ne se recouvrent pas ; si c'était le cas,
 * la première dans l'ordre de la spéciale gagne, toujours la même.
 */
export const createWaterLevel = (
  water: DecorWater[],
): ((x: number, z: number) => number | null) => {
  const grid = createSpatialGrid(CELL);
  const boxes = water.map((surface, id) => {
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (const p of surface.outline) {
      minX = Math.min(minX, p.x);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxZ = Math.max(maxZ, p.z);
    }
    grid.insert(id, minX, minZ, maxX, maxZ);
    return { minX, minZ, maxX, maxZ };
  });
  return (x, z) => {
    const cell = grid.at(Math.floor(x / CELL), Math.floor(z / CELL));
    if (!cell) return null;
    let found = -1;
    for (const id of cell) {
      const box = boxes[id];
      if (x < box.minX || x > box.maxX || z < box.minZ || z > box.maxZ)
        continue;
      if ((found < 0 || id < found) && insideWater(water[id], x, z)) found = id;
    }
    return found < 0 ? null : water[found].y;
  };
};
