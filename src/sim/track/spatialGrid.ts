/** Grille uniforme sur le plan horizontal : à chaque case, les identifiants des objets qui la recouvrent. */
export interface SpatialGrid {
  cellSize: number;
  /** Inscrit un objet dans toutes les cases de sa boîte englobante. */
  insert: (
    id: number,
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
  ) => void;
  /** Identifiants de la case (`cx`, `cz`), `undefined` si elle est vide. */
  at: (cx: number, cz: number) => number[] | undefined;
}

export const createSpatialGrid = (cellSize: number): SpatialGrid => {
  const cells = new Map<number, number[]>();
  // Un nombre exact par case : assez de marge pour ±2^20 cases sur chaque axe, soit bien plus que 15 km.
  const key = (cx: number, cz: number): number =>
    (cx + 0x100000) * 0x200000 + (cz + 0x100000);
  return {
    cellSize,
    insert: (id, minX, minZ, maxX, maxZ) => {
      const toX = Math.floor(maxX / cellSize);
      const toZ = Math.floor(maxZ / cellSize);
      for (let cx = Math.floor(minX / cellSize); cx <= toX; cx++)
        for (let cz = Math.floor(minZ / cellSize); cz <= toZ; cz++) {
          const k = key(cx, cz);
          const list = cells.get(k);
          if (list) list.push(id);
          else cells.set(k, [id]);
        }
    },
    at: (cx, cz) => cells.get(key(cx, cz)),
  };
};
