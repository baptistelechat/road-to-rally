import { GROUND_Y } from "@/sim/track/ribbon";
import type { MeshData, Track } from "@/sim/types";

/** Taille d'une maille : assez fine pour des taches de terre, assez grosse pour rester à ~15 000 triangles */
const CELL = 16;
const MARGIN = 480;

const GRASS: [number, number, number] = [0.33, 0.45, 0.2];
const GRASS_DARK: [number, number, number] = [0.25, 0.37, 0.17];
const DIRT: [number, number, number] = [0.52, 0.43, 0.28];

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

// Bruit de valeur à hachage entier : même sol à chaque chargement, sans Math.random.
const hash = (x: number, z: number): number => {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const noise = (x: number, z: number): number => {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const u = x - ix;
  const v = z - iz;
  return mix(
    mix(hash(ix, iz), hash(ix + 1, iz), u),
    mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), u),
    v,
  );
};

/** Grand sol d'herbe et de terre en couleurs de sommet, plat à `GROUND_Y`. Le talus et le bas-côté sont posés dessus. */
export const groundMesh = (track: Track): MeshData => {
  const xs = track.points.map((p) => p.x);
  const zs = track.points.map((p) => p.z);
  const minX = Math.min(...xs) - MARGIN;
  const minZ = Math.min(...zs) - MARGIN;
  const cols = Math.ceil((Math.max(...xs) + MARGIN - minX) / CELL) + 1;
  const rows = Math.ceil((Math.max(...zs) + MARGIN - minZ) / CELL) + 1;

  const positions = new Float32Array(cols * rows * 3);
  const colors = new Float32Array(cols * rows * 3);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = minX + c * CELL;
      const z = minZ + r * CELL;
      const o = (r * cols + c) * 3;
      positions.set([x, GROUND_Y, z], o);
      const green = noise(x / 40, z / 40);
      const dirt = Math.max(0, noise(x / 90 + 50, z / 90) - 0.62) * 2.6;
      for (let k = 0; k < 3; k++)
        colors[o + k] = mix(mix(GRASS[k], GRASS_DARK[k], green), DIRT[k], dirt);
    }

  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let i = 0;
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + cols;
      // Sommets en z croissant vers le bas : normale vers le haut.
      indices.set([a, b, a + 1, a + 1, b, b + 1], i);
      i += 6;
    }
  return { positions, indices, colors };
};
