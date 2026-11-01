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

export const SCENERY_MATERIAL = new MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.95,
});
