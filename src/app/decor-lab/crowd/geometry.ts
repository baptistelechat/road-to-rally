import {
  BufferAttribute,
  type BufferGeometry,
  CylinderGeometry,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Rgb = [number, number, number];
export type Vec3 = [number, number, number];

/** Emplacement de couleur d'un sommet : 0 garde sa couleur, sinon une entrée de la tenue de l'instance. */
export const SLOT = { fixed: 0, skin: 1, top: 2, bottom: 3, head: 4 } as const;
export type Slot = (typeof SLOT)[keyof typeof SLOT];

/** Pièce facultative : 0 toujours dessinée, sinon montrée si le bit `part - 1` du masque d'instance est levé. */
export const PART = {
  always: 0,
  hair: 1,
  cap: 2,
  beanie: 3,
  hood: 4,
  band: 5,
} as const;
export type Part = (typeof PART)[keyof typeof PART];

export const partBit = (part: Part): number =>
  part === 0 ? 0 : 1 << (part - 1);

const WHITE: Rgb = [1, 1, 1];

interface PieceOptions {
  color?: Rgb;
  slot?: Slot;
  part?: Part;
}

/** Pièce sans index, avec couleur, emplacement et pièce facultative par sommet : prête à fusionner. */
export const piece = (
  geometry: BufferGeometry,
  { color = WHITE, slot = SLOT.fixed, part = PART.always }: PieceOptions = {},
): BufferGeometry => {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  const count = flat.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set(color, i * 3);
  flat.setAttribute("color", new BufferAttribute(colors, 3));
  flat.setAttribute(
    "slot",
    new BufferAttribute(new Float32Array(count).fill(slot), 1),
  );
  flat.setAttribute(
    "partId",
    new BufferAttribute(new Float32Array(count).fill(part), 1),
  );
  if (flat.getAttribute("uv")) flat.deleteAttribute("uv");
  return flat;
};

/** Place une géométrie : rotations en radians (X, puis Y, puis Z), puis translation. */
export const placed = <T extends BufferGeometry>(
  geometry: T,
  [x, y, z]: Vec3,
  [rx, ry, rz]: Vec3 = [0, 0, 0],
  [sx, sy, sz]: Vec3 = [1, 1, 1],
): T => {
  geometry.scale(sx, sy, sz);
  if (rx) geometry.rotateX(rx);
  if (ry) geometry.rotateY(ry);
  if (rz) geometry.rotateZ(rz);
  geometry.translate(x, y, z);
  return geometry;
};

const UP = new Vector3(0, 1, 0);

/** Cylindre de `a` à `b` : un membre, un mât, une corde. À 4 côtés, tourné d'un huitième pour présenter une arête. */
export const segment = (
  a: Vec3,
  b: Vec3,
  radius: number,
  sides: number,
  options: PieceOptions = {},
  radiusAtB: number = radius,
): BufferGeometry => {
  const from = new Vector3(...a);
  const direction = new Vector3(...b).sub(from);
  const length = Math.max(direction.length(), 1e-4);
  const geometry = new CylinderGeometry(radiusAtB, radius, length, sides);
  if (sides === 4) geometry.rotateY(Math.PI / 4);
  geometry.translate(0, length / 2, 0);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(UP, direction.normalize()),
  );
  geometry.translate(from.x, from.y, from.z);
  return piece(geometry, options);
};

/** Fusionne des pièces construites par `piece` ; les sources sont libérées. */
export const merged = (parts: BufferGeometry[]): BufferGeometry => {
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error("Pièces du public incompatibles");
  return geometry;
};

export const triangles = (geometry: BufferGeometry): number =>
  Math.round(geometry.getAttribute("position").count / 3);

/** Triangles réellement dessinés pour un masque de pièces : les pièces écrasées ne comptent pas. */
export const visibleTriangles = (
  geometry: BufferGeometry,
  mask: number,
): number => {
  const parts = geometry.getAttribute("partId");
  let visible = 0;
  for (let i = 0; i < parts.count; i += 3) {
    const part = Math.round(parts.getX(i));
    if (part === 0 || (mask >> (part - 1)) & 1) visible++;
  }
  return visible;
};

/** Couleur CSS hexadécimale vers RVB linéaire 0..1, comme les couleurs par sommet du jeu. */
export const linear = (hex: string): Rgb => {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number): number => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [channel(16), channel(8), channel(0)];
};
