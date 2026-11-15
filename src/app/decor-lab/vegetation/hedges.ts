import { BoxGeometry, type BufferGeometry, IcosahedronGeometry } from "three";
import { hash, merged, part, type Rgb, tintOf, topOf } from "./geometry";
import type { Placement } from "./Instances";

// Buissons de haie : des modules allongés posés bout à bout le long de la ligne BD TOPO.

const HEDGE: Rgb = [0.25, 0.4, 0.15];
const HEDGE_LIGHT: Rgb = [0.31, 0.46, 0.18];
const HEDGE_DARK: Rgb = [0.2, 0.33, 0.13];
const HAWTHORN_FLOWER: Rgb = [0.78, 0.8, 0.7];

/** Longueur d'une haie de démonstration, en mètres */
export const HEDGE_DEMO_LENGTH = 40;
/** Hauteurs visées d'une haie, en mètres */
const HEDGE_MIN_HEIGHT = 1.5;
const HEDGE_MAX_HEIGHT = 3;

export interface BushModel {
  id: string;
  label: string;
  geometry: BufferGeometry;
  /** Longueur du module le long de la ligne, en mètres */
  length: number;
  /** Pas entre deux modules : plus court que le module, ils se recouvrent */
  spacing: number;
  /** Écart de cap maximal, en radians : un module allongé suit la ligne à quelques degrés près */
  yawJitter: number;
}

const balls = (): BushModel => ({
  id: "balls",
  label: "Boules fusionnées",
  geometry: merged(
    part(new IcosahedronGeometry(1, 0), HEDGE, {
      at: [-0.85, 0.85, 0],
      scale: [1, 0.85, 1],
      bumps: 0.14,
      salt: 101,
    }),
    part(new IcosahedronGeometry(1.15, 0), HEDGE_LIGHT, {
      at: [0.25, 1, 0.12],
      scale: [1, 0.9, 0.9],
      bumps: 0.15,
      salt: 102,
      // Aubépine en fleur sur quelques facettes
      paint: (center, roll) =>
        roll < 0.08 && center.y > 0 ? HAWTHORN_FLOWER : null,
    }),
    part(new IcosahedronGeometry(0.9, 0), HEDGE_DARK, {
      at: [1.15, 0.78, -0.15],
      scale: [1, 0.85, 1],
      bumps: 0.12,
      salt: 103,
    }),
  ),
  length: 3,
  spacing: 2.4,
  yawJitter: 0.5,
});

const mass = (): BushModel => ({
  id: "mass",
  label: "Massif allongé",
  geometry: merged(
    part(new IcosahedronGeometry(1, 0), HEDGE, {
      at: [0, 1, 0],
      scale: [2.1, 1, 0.95],
      bumps: 0.12,
      salt: 111,
    }),
    part(new IcosahedronGeometry(0.8, 0), HEDGE_LIGHT, {
      at: [0.9, 1.5, 0.15],
      scale: [1.25, 0.9, 0.9],
      bumps: 0.12,
      salt: 112,
    }),
  ),
  length: 4.2,
  spacing: 3.4,
  yawJitter: 0.12,
});

const trimmed = (): BushModel => ({
  id: "trimmed",
  label: "Haie taillée",
  // Pavé subdivisé en longueur et bosselé : une haie de bord de champ passée au broyeur
  geometry: merged(
    part(new BoxGeometry(4, 1.8, 1.2, 4, 1, 1), HEDGE_DARK, {
      at: [0, 0.9, 0],
      bumps: 0.09,
      salt: 121,
      paint: (center) => (center.y > 0.85 ? HEDGE : null),
    }),
  ),
  length: 4,
  spacing: 3.85,
  yawJitter: 0.03,
});

export const buildBushModels = (): BushModel[] => [balls(), mass(), trimmed()];

/** Modules d'une haie droite de `HEDGE_DEMO_LENGTH` m centrée sur x = 0, le long de x, hauteurs entre 1,5 et 3 m. */
export const hedgeLine = (bush: BushModel, salt: number): Placement[] => {
  const count = Math.ceil(HEDGE_DEMO_LENGTH / bush.spacing);
  const height = topOf(bush.geometry);
  const start = -HEDGE_DEMO_LENGTH / 2 + bush.length / 2;
  const step = (HEDGE_DEMO_LENGTH - bush.length) / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, i): Placement => {
    const h =
      HEDGE_MIN_HEIGHT +
      hash(i, salt, 1) * (HEDGE_MAX_HEIGHT - HEDGE_MIN_HEIGHT);
    // Cap aligné sur la ligne, retourné une fois sur deux au hasard : les modules ne se répètent pas
    const flip = hash(i, salt, 2) < 0.5 ? Math.PI : 0;
    return {
      x: start + i * step,
      z: (hash(i, salt, 3) - 0.5) * 0.4,
      yaw: flip + (hash(i, salt, 4) - 0.5) * 2 * bush.yawJitter,
      scale: [
        0.9 + hash(i, salt, 5) * 0.2,
        h / height,
        0.85 + hash(i, salt, 6) * 0.3,
      ],
      tint: tintOf(i * 31 + salt, 0.8),
    };
  });
};

/** Le jeu actuel : un arbre `tree` tous les 4 m, cap quelconque, ±0,6 m de part et d'autre, échelle 0,55 à 0,85. */
export const currentHedgeLine = (salt: number): Placement[] => {
  const spacing = 4;
  const count = Math.floor(HEDGE_DEMO_LENGTH / spacing);
  return Array.from({ length: count }, (_, i): Placement => {
    const s = 0.55 + hash(i, salt, 5) * 0.3;
    return {
      x: -HEDGE_DEMO_LENGTH / 2 + spacing * (i + 0.5),
      z: (hash(i, salt, 3) - 0.5) * 1.2,
      yaw: hash(i, salt, 4) * Math.PI * 2,
      scale: [s, s, s],
      tint: tintOf(i * 31 + salt, 0.8),
    };
  });
};
