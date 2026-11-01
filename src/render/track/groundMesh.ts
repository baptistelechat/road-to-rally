// Chemins relatifs : `src/geo/` importe ce fichier, y compris hors de Next.
import { GROUND_Y } from "../../sim/track/ribbon";
import type { MeshData, Track } from "../../sim/types";

/** Taille d'une maille : assez fine pour des taches de terre, assez grosse pour rester à ~15 000 triangles */
const CELL = 16;
const MARGIN = 480;
/** Sur une grande spéciale, la maille grossit plutôt que de faire exploser le nombre de triangles */
const MAX_CELLS_PER_SIDE = 200;

/** Hauteur de la bordure du terrain, en mètres */
const SKIRT_DROP = 80;
/** En dessous de cette distance à l'axe, un bord libre borde la route, pas le couloir */
const SKIRT_MIN_DISTANCE = 100;

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

/** Herbe et terre à ce point du plan : le même sol sur le circuit et sur le terrain d'une spéciale. */
export const groundColor = (x: number, z: number): [number, number, number] => {
  const green = noise(x / 40, z / 40);
  const dirt = Math.max(0, noise(x / 90 + 50, z / 90) - 0.62) * 2.6;
  const channel = (k: 0 | 1 | 2): number =>
    mix(mix(GRASS[k], GRASS_DARK[k], green), DIRT[k], dirt);
  return [channel(0), channel(1), channel(2)];
};

/** Bordure qui plonge sous le bord extérieur du terrain : vu de l'autre côté d'une vallée, il garde une épaisseur. */
export const withSkirt = (terrain: MeshData, track: Track): MeshData => {
  const { positions, indices, colors } = terrain;
  const count = positions.length / 3;
  const key = (a: number, b: number): number => a * count + b;
  const directed = new Set<number>();
  for (let t = 0; t < indices.length; t += 3)
    for (let k = 0; k < 3; k++)
      directed.add(key(indices[t + k], indices[t + (k + 1) % 3]));

  const lowPositions: number[] = [];
  const lowColors: number[] = [];
  const faces: number[] = [];
  const low = new Map<number, number>();
  const lowered = (v: number): number => {
    const known = low.get(v);
    if (known !== undefined) return known;
    const id = count + lowPositions.length / 3;
    lowPositions.push(
      positions[v * 3],
      positions[v * 3 + 1] - SKIRT_DROP,
      positions[v * 3 + 2],
    );
    if (colors) lowColors.push(...colors.subarray(v * 3, v * 3 + 3));
    low.set(v, id);
    return id;
  };
  for (let t = 0; t < indices.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = indices[t + k];
      const b = indices[t + (k + 1) % 3];
      if (directed.has(key(b, a))) continue;
      // Bord libre : le contour extérieur, pas celui que les bas-côtés recouvrent.
      const x = (positions[a * 3] + positions[b * 3]) / 2;
      const z = (positions[a * 3 + 2] + positions[b * 3 + 2]) / 2;
      if (track.nearest(x, z).distance < SKIRT_MIN_DISTANCE) continue;
      faces.push(b, a, lowered(a), b, lowered(a), lowered(b));
    }

  const join = (base: Float32Array, extra: number[]): Float32Array => {
    const merged = new Float32Array(base.length + extra.length);
    merged.set(base);
    merged.set(extra, base.length);
    return merged;
  };
  const allFaces = new Uint32Array(indices.length + faces.length);
  allFaces.set(indices);
  allFaces.set(faces, indices.length);
  return {
    positions: join(positions, lowPositions),
    indices: allFaces,
    colors: colors && join(colors, lowColors),
  };
};

/** Grand sol d'herbe et de terre en couleurs de sommet, plat à `GROUND_Y`. Le talus et le bas-côté sont posés dessus. */
export const groundMesh = (track: Track): MeshData => {
  const xs = track.points.map((p) => p.x);
  const zs = track.points.map((p) => p.z);
  const minX = Math.min(...xs) - MARGIN;
  const minZ = Math.min(...zs) - MARGIN;
  const spanX = Math.max(...xs) + MARGIN - minX;
  const spanZ = Math.max(...zs) + MARGIN - minZ;
  const cell = Math.max(CELL, Math.max(spanX, spanZ) / MAX_CELLS_PER_SIDE);
  const cols = Math.ceil(spanX / cell) + 1;
  const rows = Math.ceil(spanZ / cell) + 1;

  const positions = new Float32Array(cols * rows * 3);
  const colors = new Float32Array(cols * rows * 3);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = minX + c * cell;
      const z = minZ + r * cell;
      const o = (r * cols + c) * 3;
      positions.set([x, GROUND_Y, z], o);
      colors.set(groundColor(x, z), o);
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
