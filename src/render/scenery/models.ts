import {
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  CHICANE_BARRIER_HEIGHT,
  CHICANE_SKIRT,
  CHICANE_STACK_DEPTH,
  CHICANE_STACK_HEIGHT,
} from "@/geo/config";
import type { SceneryKind } from "@/sim/types";

type Rgb = [number, number, number];

/** Pièce sans index et colorée : le flat shading et la fusion n'ont besoin de rien d'autre. */
const part = (
  geometry: BufferGeometry,
  color: Rgb,
  x = 0,
  y = 0,
  z = 0,
  rotateZ = 0,
): BufferGeometry => {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.rotateZ(rotateZ);
  flat.translate(x, y, z);
  const count = flat.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set(color, i * 3);
  flat.setAttribute("color", new BufferAttribute(colors, 3));
  flat.deleteAttribute("uv");
  return flat;
};

const merged = (...parts: BufferGeometry[]): BufferGeometry => {
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error("Pièces de décor incompatibles");
  return geometry;
};

const TRUNK: Rgb = [0.34, 0.24, 0.16];

// Origine au pied de l'élément, dimensions pour `scale` = 1.
export const SCENERY_GEOMETRY: Record<SceneryKind, BufferGeometry> = {
  tree: merged(
    part(new CylinderGeometry(0.22, 0.32, 2.4, 5), TRUNK, 0, 1.2),
    part(new IcosahedronGeometry(2, 0), [0.32, 0.47, 0.17], 0, 3.6),
  ),
  pine: merged(
    part(new CylinderGeometry(0.16, 0.26, 1.6, 5), TRUNK, 0, 0.8),
    part(new ConeGeometry(1.9, 3.4, 6), [0.14, 0.32, 0.17], 0, 3),
    part(new ConeGeometry(1.35, 2.8, 6), [0.17, 0.37, 0.19], 0, 5),
  ),
  rock: part(new DodecahedronGeometry(1, 0), [0.47, 0.45, 0.41], 0, 0.45),
  hay: part(
    new CylinderGeometry(0.75, 0.75, 1.2, 8),
    [0.82, 0.68, 0.32],
    0,
    0.75,
    0,
    Math.PI / 2,
  ),
  hayUpright: part(
    new CylinderGeometry(0.75, 0.75, 1.2, 8),
    [0.82, 0.68, 0.32],
    0,
    0.6,
  ),
  post: part(new BoxGeometry(0.18, 1, 0.18), [0.95, 0.93, 0.88], 0, 0.5),
  sign: merged(
    part(new BoxGeometry(0.1, 2, 0.1), [0.5, 0.5, 0.52], 0, 1),
    part(new BoxGeometry(1, 0.7, 0.06), [0.92, 0.72, 0.1], 0, 2.1),
    part(new BoxGeometry(0.85, 0.18, 0.08), [0.1, 0.1, 0.1], 0, 2.1),
  ),
};

const TAPE_RED: Rgb = [0.86, 0.12, 0.1];
const TAPE_WHITE: Rgb = [0.96, 0.96, 0.94];
/** Tons de paille alternés : les bottes se lisent une à une, sans teinte par instance. */
const STRAW: Rgb[] = [
  [0.86, 0.71, 0.33],
  [0.78, 0.63, 0.27],
  [0.82, 0.67, 0.3],
];
const TWINE: Rgb = [0.52, 0.39, 0.15];

/** Longueur d'un module en travers de la route : la vue en met autant que le bloc en demande. */
export const CHICANE_BARRIER_MODULE = 2;
export const CHICANE_STACK_MODULE = 2.4;

/** Poteaux aux extrémités, ruban en boîtes fines : visible des deux faces sans matériau double face. */
const chicaneBarrier = (): BufferGeometry => {
  const half = CHICANE_BARRIER_MODULE / 2;
  const postHeight = CHICANE_BARRIER_HEIGHT + CHICANE_SKIRT;
  const stripes = 4;
  const stripe = CHICANE_BARRIER_MODULE / stripes;
  const tapes = [0.45, 0.8].map((height) => height * CHICANE_BARRIER_HEIGHT);
  return merged(
    ...[-half, half].map((x) =>
      part(
        new BoxGeometry(0.1, postHeight, 0.1),
        [0.36, 0.36, 0.38],
        x,
        postHeight / 2 - CHICANE_SKIRT,
      ),
    ),
    ...tapes.flatMap((y, row) =>
      Array.from({ length: stripes }, (_, i) =>
        part(
          new BoxGeometry(stripe, 0.2, 0.03),
          (i + row) % 2 === 0 ? TAPE_RED : TAPE_WHITE,
          -half + stripe * (i + 0.5),
          y,
        ),
      ),
    ),
  );
};

/** Bottes carrées posées en quinconce : une pile sans jour, contrairement aux bottes rondes qui laisseraient voir la sortie. */
const hayStack = (): BufferGeometry => {
  const rows = 3;
  const baleHeight = CHICANE_STACK_HEIGHT / rows;
  const half = CHICANE_STACK_MODULE / 2;
  const bale = half;
  const bales: BufferGeometry[] = [];
  for (let row = 0; row < rows; row++) {
    // Rang pair : deux bottes. Rang impair : une botte au milieu et deux moitiés, qui se raccordent au module voisin.
    const edges =
      row % 2 === 0 ? [-half, 0, half] : [-half, -bale / 2, bale / 2, half];
    // Le rang du bas descend jusqu'à la partie enterrée.
    const bottom = row === 0 ? -CHICANE_SKIRT : baleHeight * row;
    const top = baleHeight * (row + 1);
    for (let i = 0; i < edges.length - 1; i++) {
      const length = edges[i + 1] - edges[i];
      const x = (edges[i] + edges[i + 1]) / 2;
      const y = (bottom + top) / 2;
      bales.push(
        part(
          new BoxGeometry(length, top - bottom, CHICANE_STACK_DEPTH),
          STRAW[(row + i) % STRAW.length],
          x,
          y,
        ),
        part(
          new BoxGeometry(0.06, top - bottom, CHICANE_STACK_DEPTH + 0.02),
          TWINE,
          x,
          y,
        ),
      );
    }
  }
  return merged(...bales);
};

// Origine au centre du module, au niveau de la route : la partie sous y = 0 reste enterrée.
export const CHICANE_GEOMETRY = {
  chicaneBarrier: chicaneBarrier(),
  hayStack: hayStack(),
};

export const SCENERY_MATERIAL = new MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.95,
});
