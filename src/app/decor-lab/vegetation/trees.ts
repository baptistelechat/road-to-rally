import {
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
} from "three";
import { merged, part, type Rgb } from "./geometry";

// Propositions d'arbres low-poly : origine au pied, environ 6 à 14 m de haut pour une échelle de 1.

const BARK: Rgb = [0.34, 0.24, 0.16];
const BARK_DARK: Rgb = [0.27, 0.2, 0.14];
const BIRCH_BARK: Rgb = [0.86, 0.84, 0.78];
const BIRCH_MARK: Rgb = [0.17, 0.16, 0.15];
const PINE_BARK_TOP: Rgb = [0.62, 0.37, 0.21];
const DEAD_WOOD: Rgb = [0.45, 0.39, 0.33];
const OAK: Rgb = [0.3, 0.45, 0.16];
const OAK_DARK: Rgb = [0.24, 0.37, 0.13];
const BEECH: Rgb = [0.35, 0.49, 0.18];
const POPLAR: Rgb = [0.37, 0.51, 0.2];
const BIRCH_LEAF: Rgb = [0.46, 0.58, 0.22];
const WILLOW: Rgb = [0.47, 0.57, 0.3];
const WILLOW_HANG: Rgb = [0.52, 0.6, 0.32];
const FIR: Rgb = [0.13, 0.29, 0.16];
const FIR_LIGHT: Rgb = [0.16, 0.34, 0.18];
const SCOTS: Rgb = [0.21, 0.35, 0.17];
const ORCHARD_LEAF: Rgb = [0.36, 0.52, 0.2];
const APPLE: Rgb = [0.72, 0.17, 0.1];

/** Tronc ouvert aux deux bouts : ses disques seraient cachés par le sol et le houppier. */
const trunk = (
  top: number,
  bottom: number,
  height: number,
  segments: number,
  color: Rgb = BARK,
  salt = 0,
): BufferGeometry =>
  part(new CylinderGeometry(top, bottom, height, segments, 1, true), color, {
    at: [0, height / 2, 0],
    shade: 0.08,
    salt,
  });

/** Branche ancrée à sa base, inclinée de `tilt` puis tournée de `yaw`. */
const branch = (
  length: number,
  tilt: number,
  yaw: number,
  at: [number, number, number],
  color: Rgb,
  salt: number,
): BufferGeometry =>
  part(
    new CylinderGeometry(0.035, 0.09, length, 3, 1, true).translate(
      0,
      length / 2,
      0,
    ),
    color,
    { rotation: [0, yaw, tilt], at, salt },
  );

export interface TreeModel {
  id: string;
  label: string;
  /** Version proche, celle des 5 instances */
  near: BufferGeometry;
  /** Version lointaine quand la proche dépasse le budget ; `null` : la proche sert partout */
  far: BufferGeometry | null;
  /** Échelles d'instance de la démonstration */
  minScale: number;
  maxScale: number;
  /** Les géométries du jeu ne nous appartiennent pas : on ne les libère pas */
  owned: boolean;
}

const oakLobed = (): TreeModel => ({
  id: "oak-lobed",
  label: "Chêne, houppier à lobes",
  near: merged(
    trunk(0.25, 0.38, 3.2, 5, BARK, 1),
    part(new IcosahedronGeometry(2.2, 0), OAK, {
      at: [0, 4.7, 0],
      scale: [1, 0.85, 1],
      bumps: 0.22,
      salt: 2,
    }),
    part(new IcosahedronGeometry(1.6, 0), OAK_DARK, {
      at: [1.4, 4.0, 0.5],
      bumps: 0.18,
      salt: 3,
    }),
    part(new IcosahedronGeometry(1.5, 0), BEECH, {
      at: [-1.2, 4.3, -0.6],
      bumps: 0.18,
      salt: 4,
    }),
  ),
  far: merged(
    trunk(0.25, 0.38, 3.2, 3, BARK, 1),
    part(new IcosahedronGeometry(2.6, 0), OAK, {
      at: [0, 4.5, 0],
      scale: [1.1, 0.85, 1.1],
      bumps: 0.2,
      salt: 5,
    }),
  ),
  minScale: 0.85,
  maxScale: 1.35,
  owned: true,
});

const oakTiered = (): TreeModel => ({
  id: "oak-tiered",
  label: "Feuillu étagé",
  near: merged(
    trunk(0.22, 0.34, 3.6, 5, BARK_DARK, 11),
    part(new IcosahedronGeometry(2.4, 0), OAK_DARK, {
      at: [0, 3.7, 0],
      scale: [1, 0.45, 1],
      bumps: 0.2,
      salt: 12,
    }),
    part(new IcosahedronGeometry(2, 0), OAK, {
      at: [0.3, 4.9, -0.2],
      scale: [1, 0.5, 1],
      bumps: 0.2,
      salt: 13,
    }),
    part(new IcosahedronGeometry(1.3, 0), BEECH, {
      at: [-0.1, 6, 0.1],
      scale: [1, 0.65, 1],
      bumps: 0.15,
      salt: 14,
    }),
  ),
  far: merged(
    trunk(0.22, 0.34, 3.6, 3, BARK_DARK, 11),
    part(new IcosahedronGeometry(2.4, 0), OAK_DARK, {
      at: [0, 4, 0],
      scale: [1, 0.55, 1],
      bumps: 0.2,
      salt: 15,
    }),
    part(new IcosahedronGeometry(1.6, 0), OAK, {
      at: [0.2, 5.5, 0],
      scale: [1, 0.6, 1],
      bumps: 0.15,
      salt: 16,
    }),
  ),
  minScale: 0.85,
  maxScale: 1.3,
  owned: true,
});

const poplar = (): TreeModel => ({
  id: "poplar",
  label: "Peuplier",
  near: merged(
    trunk(0.18, 0.3, 2.4, 5, BARK, 21),
    // Octaèdre subdivisé étiré : un fuseau de 32 facettes
    part(new OctahedronGeometry(1, 1), POPLAR, {
      at: [0, 8, 0],
      scale: [1.4, 6, 1.4],
      bumps: 0.12,
      salt: 22,
    }),
  ),
  far: null,
  minScale: 0.9,
  maxScale: 1.15,
  owned: true,
});

const birch = (): TreeModel => ({
  id: "birch",
  label: "Bouleau",
  near: merged(
    // Trois tranches de tronc : les facettes sombres font les marques de l'écorce
    part(new CylinderGeometry(0.13, 0.2, 4.6, 5, 3, true), BIRCH_BARK, {
      at: [0, 2.3, 0],
      salt: 31,
      shade: 0.05,
      paint: (_center, roll) => (roll < 0.3 ? BIRCH_MARK : null),
    }),
    part(new IcosahedronGeometry(1.4, 0), BIRCH_LEAF, {
      at: [0.3, 5.3, 0],
      scale: [1, 1.25, 1],
      bumps: 0.2,
      salt: 32,
    }),
    part(new IcosahedronGeometry(1.1, 0), BIRCH_LEAF, {
      at: [-0.5, 6.4, 0.3],
      scale: [1, 1.2, 1],
      bumps: 0.15,
      salt: 33,
    }),
  ),
  far: merged(
    trunk(0.13, 0.2, 4.6, 5, BIRCH_BARK, 34),
    part(new IcosahedronGeometry(1.5, 0), BIRCH_LEAF, {
      at: [0, 5.8, 0],
      scale: [1, 1.5, 1],
      bumps: 0.2,
      salt: 35,
    }),
  ),
  minScale: 0.8,
  maxScale: 1.2,
  owned: true,
});

const willow = (): TreeModel => ({
  id: "willow",
  label: "Saule pleureur",
  near: merged(
    trunk(0.3, 0.45, 2.4, 5, BARK_DARK, 41),
    part(new IcosahedronGeometry(2.6, 0), WILLOW, {
      at: [0, 3.7, 0],
      scale: [1, 0.6, 1],
      bumps: 0.2,
      salt: 42,
    }),
    // Jupe ouverte qui retombe jusqu'à un mètre du sol : le rideau de branches
    part(new CylinderGeometry(2.3, 2.95, 2.7, 8, 1, true), WILLOW_HANG, {
      at: [0, 2.35, 0],
      bumps: 0.22,
      salt: 43,
    }),
  ),
  far: null,
  minScale: 0.85,
  maxScale: 1.2,
  owned: true,
});

/** Cônes empilés qui débordent les uns des autres : les étages du sapin se lisent même de loin. */
const firTiers = (
  tiers: [number, number, number][],
  segments: number,
  salt: number,
): BufferGeometry[] =>
  tiers.map(([radius, height, base], i) =>
    part(
      new ConeGeometry(radius, height, segments),
      i % 2 === 0 ? FIR : FIR_LIGHT,
      { at: [0, base + height / 2, 0], bumps: 0.07, salt: salt + i },
    ),
  );

const fir = (): TreeModel => ({
  id: "fir",
  label: "Sapin",
  near: merged(
    trunk(0.14, 0.24, 1.4, 5, BARK_DARK, 51),
    ...firTiers(
      [
        [2, 2.6, 0.9],
        [1.6, 2.4, 2.4],
        [1.15, 2.1, 3.8],
        [0.7, 1.8, 5.1],
      ],
      7,
      52,
    ),
  ),
  far: merged(
    trunk(0.14, 0.24, 1.4, 3, BARK_DARK, 51),
    ...firTiers(
      [
        [2, 3.6, 0.9],
        [1.3, 3.4, 3.4],
      ],
      6,
      58,
    ),
  ),
  minScale: 0.85,
  maxScale: 1.6,
  owned: true,
});

const scotsPine = (): TreeModel => ({
  id: "scots-pine",
  label: "Pin sylvestre",
  near: merged(
    // Écorce brune en bas, orangée en haut : la signature du pin sylvestre
    part(new CylinderGeometry(0.12, 0.26, 6.6, 5, 2, true), BARK, {
      at: [0, 3.3, 0],
      salt: 61,
      shade: 0.06,
      paint: (center) => (center.y > 0 ? PINE_BARK_TOP : null),
    }),
    part(new IcosahedronGeometry(1.8, 0), SCOTS, {
      at: [0.4, 7, 0],
      scale: [1.25, 0.42, 1.1],
      bumps: 0.25,
      salt: 62,
    }),
    part(new IcosahedronGeometry(1.4, 0), SCOTS, {
      at: [-0.8, 7.7, 0.4],
      scale: [1.1, 0.5, 1],
      bumps: 0.2,
      salt: 63,
    }),
  ),
  far: null,
  minScale: 0.85,
  maxScale: 1.3,
  owned: true,
});

const fruitTree = (): TreeModel => ({
  id: "fruit",
  label: "Fruitier de verger",
  near: merged(
    trunk(0.11, 0.17, 1.3, 5, BARK, 71),
    // Quelques facettes rouges : les pommes, sans un triangle de plus
    part(new IcosahedronGeometry(1.5, 0), ORCHARD_LEAF, {
      at: [0, 2.3, 0],
      scale: [1.15, 0.8, 1.15],
      bumps: 0.18,
      salt: 72,
      paint: (_center, roll) => (roll < 0.15 ? APPLE : null),
    }),
  ),
  far: null,
  minScale: 0.85,
  maxScale: 1.1,
  owned: true,
});

const deadTree = (): TreeModel => ({
  id: "dead",
  label: "Arbre mort (rare)",
  near: merged(
    trunk(0.12, 0.3, 4.2, 5, DEAD_WOOD, 81),
    branch(1.8, 0.75, 0.3, [0, 2.4, 0], DEAD_WOOD, 82),
    branch(1.5, 0.6, 2.4, [0, 2.9, 0], DEAD_WOOD, 83),
    branch(1.3, 0.8, 4.3, [0, 3.4, 0], DEAD_WOOD, 84),
    branch(1.1, 0.35, 1.2, [0, 3.9, 0], DEAD_WOOD, 85),
  ),
  far: null,
  minScale: 0.8,
  maxScale: 1.2,
  owned: true,
});

/** Les huit propositions, de la plus courante à la plus rare. */
export const buildTreeModels = (): TreeModel[] => [
  oakLobed(),
  oakTiered(),
  poplar(),
  birch(),
  willow(),
  fir(),
  scotsPine(),
  fruitTree(),
  deadTree(),
];
