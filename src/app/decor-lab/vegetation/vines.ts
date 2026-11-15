import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
} from "three";
import { hash, merged, part, type Rgb, tintOf, triangles } from "./geometry";
import type { Placement } from "./Instances";

// Rangs de vigne : un module de 5 m (piquet, fil, ceps, bande de feuillage) répété bout à bout.

const LEAF: Rgb = [0.3, 0.46, 0.15];
const LEAF_YELLOW: Rgb = [0.5, 0.55, 0.2];
const STOCK: Rgb = [0.3, 0.22, 0.15];
const POST: Rgb = [0.52, 0.47, 0.4];
const WIRE: Rgb = [0.6, 0.6, 0.62];

/** Longueur d'un module de rang, en mètres */
export const VINE_MODULE = 5;
/** Écart entre deux rangs, en mètres */
export const VINE_ROW_SPACING = 2;
/** Parcelle de démonstration, en mètres : rangs le long de x */
export const PARCEL_LENGTH = 30;
export const PARCEL_WIDTH = 20;
/** Un cep par mètre de rang, pour l'estimation « une instance par cep » */
const CEP_SPACING = 1;
/** Triangles d'un cep isolé en gobelet : un tronc à 3 pans et un icosaèdre */
const CEP_TRIANGLES = 26;

interface BandShape {
  segments: number;
  bottom: number;
  top: number;
  /** Demi-largeurs de la bande en bas et en haut, en mètres */
  bottomHalf: number;
  topHalf: number;
  /** Bosselage des sommets intérieurs ; les bouts restent droits pour se raccorder au module voisin */
  bumps: number;
  salt: number;
}

/** Bande de feuillage continue : deux flancs et un dessus, fermée aux bouts pour les fins de rang. */
const band = (shape: BandShape): BufferGeometry => {
  const { segments, bottom, top, bottomHalf, topHalf, bumps, salt } = shape;
  const half = VINE_MODULE / 2;
  // Section : bas gauche, haut gauche, haut droit, bas droit
  const section = (i: number): [number, number, number][] => {
    const x = -half + (VINE_MODULE * i) / segments;
    const inner = i > 0 && i < segments;
    const wobble = (k: number): number =>
      inner ? (hash(i, salt, k) - 0.5) * 2 * bumps : 0;
    return [
      [x, bottom + wobble(1), -bottomHalf + wobble(2)],
      [x, top + wobble(3), -topHalf + wobble(4)],
      [x, top + wobble(5), topHalf + wobble(6)],
      [x, bottom + wobble(7), bottomHalf + wobble(8)],
    ];
  };
  const positions: number[] = [];
  const quad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
  ): void => {
    // Ordre inversé : faces tournées vers l'extérieur de la bande
    positions.push(...a, ...c, ...b, ...a, ...d, ...c);
  };
  for (let i = 0; i < segments; i++) {
    const [a0, a1, a2, a3] = section(i);
    const [b0, b1, b2, b3] = section(i + 1);
    quad(a0, b0, b1, a1); // flanc -z
    quad(a1, b1, b2, a2); // dessus
    quad(a2, b2, b3, a3); // flanc +z
  }
  const [s0, s1, s2, s3] = section(0);
  quad(s0, s1, s2, s3); // bout -x
  const [e0, e1, e2, e3] = section(segments);
  quad(e3, e2, e1, e0); // bout +x
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  return geometry;
};

/** Piquet de tête de module, en x = -2,5 m : la fin du rang reçoit un piquet à part. */
const post = (height: number, x: number, salt: number): BufferGeometry =>
  part(new CylinderGeometry(0.04, 0.05, height, 4, 1, true), POST, {
    at: [x, height / 2, 0],
    salt,
  });

export interface VineModel {
  id: string;
  label: string;
  geometry: BufferGeometry;
  note: string;
}

const trellis = (): VineModel => ({
  id: "trellis",
  label: "Palissage complet",
  geometry: merged(
    post(1.8, -VINE_MODULE / 2, 201),
    part(new BoxGeometry(VINE_MODULE, 0.015, 0.015), WIRE, {
      at: [0, 0.5, 0],
      salt: 202,
    }),
    // Cinq ceps tordus sous la bande, un par mètre
    ...Array.from({ length: 5 }, (_, i) =>
      part(new CylinderGeometry(0.03, 0.05, 0.62, 3, 1, true), STOCK, {
        at: [-2 + i, 0.31, 0],
        rotation: [0, i * 1.3, (hash(i, 203, 1) - 0.5) * 0.3],
        salt: 204 + i,
      }),
    ),
    part(
      band({
        segments: 5,
        bottom: 0.55,
        top: 1.55,
        bottomHalf: 0.15,
        topHalf: 0.32,
        bumps: 0.07,
        salt: 210,
      }),
      LEAF,
      {
        salt: 211,
        shade: 0.14,
        paint: (_center, roll) => (roll < 0.12 ? LEAF_YELLOW : null),
      },
    ),
  ),
  note: "piquet, fil, 5 ceps, bande à 5 segments",
});

const economy = (): VineModel => ({
  id: "economy",
  label: "Bande économique",
  geometry: merged(
    post(1.6, -VINE_MODULE / 2, 221),
    // Bande effilée vers le bas : elle se lit comme les ceps, sans les dessiner
    part(
      band({
        segments: 2,
        bottom: 0.3,
        top: 1.4,
        bottomHalf: 0.06,
        topHalf: 0.3,
        bumps: 0.06,
        salt: 222,
      }),
      LEAF,
      {
        salt: 223,
        shade: 0.14,
        paint: (center, roll) =>
          center.y < 0.6 ? STOCK : roll < 0.12 ? LEAF_YELLOW : null,
      },
    ),
  ),
  note: "piquet et bande à 2 segments, ni fil ni cep",
});

export const buildVineModels = (): VineModel[] => [trellis(), economy()];

/** Piquet de fin de rang, seul. */
export const buildEndPost = (): BufferGeometry => merged(post(1.8, 0, 231));

/** Modules d'une parcelle centrée sur l'origine, rangs le long de x espacés de 2 m. */
export const parcelModules = (salt: number): Placement[] => {
  const rows = Math.round(PARCEL_WIDTH / VINE_ROW_SPACING);
  const perRow = Math.round(PARCEL_LENGTH / VINE_MODULE);
  return Array.from({ length: rows * perRow }, (_, k): Placement => {
    const row = Math.floor(k / perRow);
    const i = k % perRow;
    return {
      x: -PARCEL_LENGTH / 2 + VINE_MODULE * (i + 0.5),
      z: -PARCEL_WIDTH / 2 + VINE_ROW_SPACING * (row + 0.5),
      yaw: 0,
      // Hauteur légèrement variable d'un module à l'autre : la taille n'est jamais parfaite
      scale: [1, 0.92 + hash(k, salt, 1) * 0.16, 1],
      tint: tintOf(k * 17 + salt, 0.5),
    };
  });
};

/** Piquets de bout de rang, en x = +15 m. */
export const parcelEndPosts = (): Placement[] =>
  Array.from(
    { length: Math.round(PARCEL_WIDTH / VINE_ROW_SPACING) },
    (_, row): Placement => ({
      x: PARCEL_LENGTH / 2,
      z: -PARCEL_WIDTH / 2 + VINE_ROW_SPACING * (row + 0.5),
      yaw: 0,
      scale: [1, 1, 1],
      tint: [1, 1, 1],
    }),
  );

/** Triangles par hectare avec une instance par module de 5 m. */
export const trianglesPerHectare = (geometry: BufferGeometry): number =>
  (10000 / VINE_ROW_SPACING / VINE_MODULE) * triangles(geometry);

/** Variante « une instance par cep » : un gobelet tous les mètres. */
export const cepTrianglesPerHectare = (): number =>
  (10000 / VINE_ROW_SPACING / CEP_SPACING) * CEP_TRIANGLES;
