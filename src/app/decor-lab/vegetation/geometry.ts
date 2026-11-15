import { BufferAttribute, type BufferGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Outils de modelage des propositions de végétation : pièces colorées par facette, fusionnées en une géométrie.

export type Rgb = [number, number, number];
export type Vec3Tuple = [number, number, number];

/** Hachage entier, comme `vegetation.ts` : jamais `Math.random`. Résultat dans [0, 1[. */
export const hash = (a: number, b: number, salt: number): number => {
  let h =
    Math.imul(a, 374761393) +
    Math.imul(b, 668265263) +
    Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Hachage d'une position au millimètre : les sommets confondus bougent ensemble, la surface ne se déchire pas. */
const hashPoint = (x: number, y: number, z: number, salt: number): number =>
  hash(
    Math.round(x * 1000) ^ Math.imul(Math.round(z * 1000), 73856093),
    Math.round(y * 1000),
    salt,
  );

export interface PartOptions {
  at?: Vec3Tuple;
  scale?: Vec3Tuple;
  /** Appliquée dans l'ordre X, Z puis Y : inclinaison d'abord, cap ensuite */
  rotation?: Vec3Tuple;
  /** Amplitude du bosselage des sommets, en unités de la forme avant mise à l'échelle */
  bumps?: number;
  salt?: number;
  /** Écart relatif de teinte entre facettes */
  shade?: number;
  /** Couleur d'une facette selon son centre (pièce mise à l'échelle, avant rotation) et un tirage ; `null` garde la couleur de base */
  paint?: (center: Vector3, roll: number) => Rgb | null;
}

/** Pièce sans index, bosselée, colorée par facette, puis placée. */
export const part = (
  source: BufferGeometry,
  color: Rgb,
  options: PartOptions = {},
): BufferGeometry => {
  const {
    at = [0, 0, 0],
    scale = [1, 1, 1],
    rotation = [0, 0, 0],
    bumps = 0,
    salt = 0,
    shade = 0.1,
    paint,
  } = options;
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");
  const position = geometry.getAttribute("position");
  if (bumps > 0)
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      position.setXYZ(
        i,
        x + (hashPoint(x, y, z, salt) - 0.5) * 2 * bumps,
        y + (hashPoint(x, y, z, salt + 1) - 0.5) * 2 * bumps,
        z + (hashPoint(x, y, z, salt + 2) - 0.5) * 2 * bumps,
      );
    }
  geometry.scale(scale[0], scale[1], scale[2]);
  const colors = new Float32Array(position.count * 3);
  const center = new Vector3();
  for (let t = 0; t < position.count / 3; t++) {
    center.set(0, 0, 0);
    for (let v = 0; v < 3; v++) center.x += position.getX(t * 3 + v) / 3;
    for (let v = 0; v < 3; v++) center.y += position.getY(t * 3 + v) / 3;
    for (let v = 0; v < 3; v++) center.z += position.getZ(t * 3 + v) / 3;
    const base = paint?.(center, hash(t, salt, 77)) ?? color;
    const k = 1 + (hash(t, salt, 31) - 0.5) * 2 * shade;
    for (let v = 0; v < 3; v++)
      colors.set([base[0] * k, base[1] * k, base[2] * k], (t * 3 + v) * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.rotateX(rotation[0]);
  geometry.rotateZ(rotation[2]);
  geometry.rotateY(rotation[1]);
  geometry.translate(at[0], at[1], at[2]);
  return geometry;
};

/** Une seule géométrie par modèle : un seul appel de dessin par lot instancié. */
export const merged = (...parts: BufferGeometry[]): BufferGeometry => {
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error("Pièces de végétation incompatibles");
  parts.forEach((piece) => piece.dispose());
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
};

/** Triangles dessinés, géométrie indexée ou non. */
export const triangles = (geometry: BufferGeometry): number =>
  (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;

/** Hauteur du sommet du modèle, pour poser les étiquettes. */
export const topOf = (geometry: BufferGeometry): number => {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return geometry.boundingBox?.max.y ?? 0;
};

/** Teinte par instance : luminosité et léger glissement vers le jaune ou le bleu. */
export const tintOf = (seed: number, strength = 1): Rgb => {
  const light = 1 + (hash(seed, 1, 501) - 0.55) * 0.32 * strength;
  const warm = (hash(seed, 2, 502) - 0.5) * 0.22 * strength;
  return [light * (1 + warm), light, light * (1 - warm)];
};
