import { CatmullRomCurve3, Vector3 } from "three";
import type { Track, Vec3 } from "../types";
import { createTrack } from "./createTrack";

const WIDTH = 6;
/** Pas de l'axe en mètres : une corde de 2 m dans l'épingle reste à moins de 5 cm de l'arc */
const STEP = 2;

interface SandboxSection {
  name: string;
  /** Points de contrôle (x, z), posés à la main dans le sens de la route */
  points: [number, number][];
}

// Vue de dessus : x vers la droite, z vers le bas, sens horaire.
export const SANDBOX_SECTIONS: SandboxSection[] = [
  {
    name: "Longue ligne droite",
    points: [
      [0, 0],
      [30, 0],
      [110, 0],
      [220, 0],
      [330, 0],
      [380, 0],
      [400, 0],
    ],
  },
  {
    // Arc de rayon 100 m sur 135° : la sortie, déjà orientée sud-ouest, lance le S.
    name: "Grande courbe rapide",
    points: [
      [438, 8],
      [471, 29],
      [492, 62],
      [500, 100],
      [492, 138],
    ],
  },
  {
    // Sinusoïde : deux virages opposés d'environ 32 m de rayon, sortie plein sud.
    name: "Enchaînement en S",
    points: [
      [471, 171],
      [448, 196],
      [439, 221],
      [448, 246],
      [471, 271],
      [494, 296],
      [503, 321],
    ],
  },
  {
    name: "Crête",
    points: [
      [503, 380],
      [503, 430],
      [503, 480],
    ],
  },
  {
    // Demi-cercle de 11 m de rayon, centré en (492, 548).
    name: "Épingle",
    points: [
      [503, 520],
      [503, 538],
      [503.0, 548.0],
      [502.2, 552.2],
      [499.8, 555.8],
      [496.2, 558.2],
      [492.0, 559.0],
      [487.8, 558.2],
      [484.2, 555.8],
      [481.8, 552.2],
      [481.0, 548.0],
      [481, 538],
    ],
  },
  {
    name: "Liaison vers la bosse",
    points: [
      [479, 522],
      [472, 506],
      [455, 495],
      [425, 490],
      [385, 490],
    ],
  },
  {
    name: "Bosse",
    points: [
      [345, 490],
      [310, 490],
    ],
  },
  {
    name: "Chicane",
    points: [
      [270, 490],
      [245, 490],
      [228, 479],
      [210, 475],
      [192, 479],
      [175, 490],
      [150, 490],
    ],
  },
  {
    // Spirale : le rayon passe d'environ 250 m à 30 m sur 126 m, 135° au total.
    name: "Virage qui se resserre",
    points: [
      [100, 490],
      [82, 489],
      [64, 486],
      [48, 479],
      [34, 467],
      [26, 451],
      [25, 433],
      [33, 418],
    ],
  },
  {
    name: "Retour rapide",
    points: [
      [44, 402],
      [54, 378],
      [52, 345],
      [25, 280],
      [-20, 210],
      [-62, 150],
      [-78, 105],
      [-78, 75],
      [-68, 40],
      [-40, 11],
      [-14, 1.2],
    ],
  },
];

/** Reliefs ajoutés après coup sur l'axe plat, centrés sur leur section : hauteur et longueur en mètres. */
const RELIEFS: { section: string; height: number; length: number }[] = [
  // Rayon en haut ≈ 100 m : la voiture s'allège nettement vers 100 km/h.
  { section: "Crête", height: 2.5, length: 80 },
  // Rayon en haut ≈ 16 m : décolle vers 50 km/h, test de suspension.
  { section: "Bosse", height: 0.5, length: 14 },
];

const toVec3 = ([x, z]: [number, number]): Vector3 => new Vector3(x, 0, z);

const closestIndex = (points: Vector3[], x: number, z: number): number => {
  let best = 0;
  let bestD2 = Infinity;
  points.forEach((p, i) => {
    const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  });
  return best;
};

/** Abscisse de début de chaque section du sandbox, dans l'ordre de `SANDBOX_SECTIONS`. */
export const sandboxSectionStarts = (track: Track): number[] =>
  SANDBOX_SECTIONS.map(({ points: [[x, z]] }) => track.nearest(x, z).s);

export const createSandboxTrack = (): Track => {
  const curve = new CatmullRomCurve3(
    SANDBOX_SECTIONS.flatMap((section) => section.points.map(toVec3)),
    true,
    "centripetal",
  );
  // Sans ça, l'abaque de longueur (200 divisions par défaut) laisse le pas varier dans les virages.
  curve.arcLengthDivisions = 8000;
  const divisions = Math.round(curve.getLength() / STEP);
  // `getSpacedPoints` répète le premier point à la fin d'une courbe fermée : l'axe du contrat n'a pas de doublon.
  const flat = curve.getSpacedPoints(divisions).slice(0, -1);
  const spacing = curve.getLength() / divisions;

  const heights = new Array<number>(flat.length).fill(0);
  for (const { section, height, length } of RELIEFS) {
    const index = SANDBOX_SECTIONS.findIndex((s) => s.name === section);
    const [startX, startZ] = SANDBOX_SECTIONS[index].points[0];
    const [endX, endZ] = SANDBOX_SECTIONS[index + 1].points[0];
    const from = closestIndex(flat, startX, startZ);
    const to = closestIndex(flat, endX, endZ);
    const center = ((from + to) / 2) * spacing;
    flat.forEach((_, i) => {
      const u = (i * spacing - center) / length + 0.5;
      if (u > 0 && u < 1)
        heights[i] += (height / 2) * (1 - Math.cos(2 * Math.PI * u));
    });
  }

  const points: Vec3[] = flat.map((p, i) => ({
    x: p.x,
    y: heights[i],
    z: p.z,
  }));
  return createTrack(points, WIDTH, true);
};
