import type { CrowdMember } from "./Crowd";
import type { Vec3 } from "./geometry";
import { between, hash, pick } from "./hash";
import { APP_HEX } from "./dressing";
import { WARDROBES } from "./outfits";
import { POSES, type PoseId, STYLES, type StyleId } from "./people";

// Placement des propositions : route le long de X (z entre -3,5 et 3,5), personnages au nord, groupes au sud.

/** Vers la route depuis le côté sud (z > 0) */
const FACING_ROAD_SOUTH = Math.PI;

export const POSE_X = (i: number): number => -24 + i * 3.2;
export const STYLE_ROW_Z = (k: number): number => -9 - 4 * k;
export const WARDROBE_ROW_Z = -21;

/** Une rangée par style : chaque pose une fois, tenues tirées de la graine. */
export const STYLE_ROWS: Record<StyleId, CrowdMember[]> = Object.fromEntries(
  STYLES.map((style, k) => [
    style,
    POSES.map((pose, i) => ({
      pose,
      position: [POSE_X(i), 0, STYLE_ROW_Z(k)] as Vec3,
      yaw: 0,
      seed: 100 + k * 17 + i * 5,
      wardrobe: pose === "marshal" ? ("marshal" as const) : undefined,
    })),
  ]),
) as Record<StyleId, CrowdMember[]>;

/** Les six garde-robes, deux fois chacune. */
export const WARDROBE_ROW: CrowdMember[] = WARDROBES.flatMap((wardrobe, w) =>
  [0, 1].map((n) => ({
    pose: n === 0 ? ("cheer" as const) : ("rail" as const),
    position: [POSE_X(w) - 0.6 + n * 1.2, 0, WARDROBE_ROW_Z] as Vec3,
    yaw: 0,
    seed: 400 + w * 3 + n,
    wardrobe,
  })),
);

const MIXED: PoseId[] = [
  "cheer",
  "cheer",
  "photo",
  "rail",
  "flag",
  "shoulders",
  "cheer",
  "photo",
];

/** Bloc de 24 spectateurs mélangés : la variété de couleurs d'un coup d'œil. */
export const VARIETY_BLOCK: CrowdMember[] = Array.from(
  { length: 24 },
  (_, i) => {
    const seed = 900 + i * 13;
    return {
      pose: pick(MIXED, seed),
      position: [
        1 + (i % 6) * 1.1 + between(-0.2, 0.2, seed + 1),
        0,
        -9 - Math.floor(i / 6) * 1.2 + between(-0.2, 0.2, seed + 2),
      ] as Vec3,
      yaw: between(-0.35, 0.35, seed + 3),
      seed,
      scale: between(0.92, 1.07, seed + 4),
    };
  },
);

/** Épingle : public massé sur trois rangs derrière la barrière de chicane (en z = 5,2). */
export const HAIRPIN_CROWD: CrowdMember[] = Array.from(
  { length: 21 },
  (_, i) => {
    const seed = 2000 + i * 7;
    const row = Math.floor(i / 7);
    return {
      pose:
        row === 0
          ? pick(["cheer", "photo", "rail"] as const, seed)
          : pick(MIXED, seed),
      position: [
        -29.4 + (i % 7) * 1.25 + row * 0.6 + between(-0.25, 0.25, seed + 1),
        0,
        6.6 + row * 1.0 + between(-0.15, 0.15, seed + 2),
      ] as Vec3,
      yaw: FACING_ROAD_SOUTH + between(-0.4, 0.4, seed + 3),
      seed,
      scale: between(0.93, 1.06, seed + 4),
    };
  },
);

/** File le long de la rubalise, un rang, espacement irrégulier. */
export const TAPE_CROWD: CrowdMember[] = Array.from({ length: 9 }, (_, i) => {
  const seed = 3000 + i * 11;
  return {
    pose: pick(["rail", "rail", "cheer", "photo", "flag"] as const, seed),
    position: [-15.5 + i * 1.3 + between(-0.3, 0.3, seed + 1), 0, 5.9] as Vec3,
    yaw: FACING_ROAD_SOUTH + between(-0.25, 0.25, seed + 3),
    seed,
  };
});

/** Famille sous le parasol : mêmes graines voisines, garde-robes imposées pour l'air de famille. */
export const FAMILY: CrowdMember[] = [
  {
    pose: "seated",
    position: [5.4, 0, 7.4],
    yaw: FACING_ROAD_SOUTH - 0.2,
    seed: 4001,
    wardrobe: "cap",
  },
  {
    pose: "shoulders",
    position: [3.4, 0, 8.4],
    yaw: FACING_ROAD_SOUTH + 0.15,
    seed: 4002,
    wardrobe: "bare",
  },
  {
    pose: "photo",
    position: [6.6, 0, 6.6],
    yaw: FACING_ROAD_SOUTH + 0.3,
    seed: 4003,
    wardrobe: "team",
  },
  {
    pose: "cheer",
    position: [2.1, 0, 6.5],
    yaw: FACING_ROAD_SOUTH,
    seed: 4004,
    wardrobe: "beanie",
    scale: 0.62,
  },
];

/** Commissaires : drapeau jaune au bord, un collègue en retrait. */
export const MARSHALS: CrowdMember[] = [
  {
    pose: "marshal",
    position: [12, 0, 5.0],
    yaw: FACING_ROAD_SOUTH + 0.5,
    seed: 5001,
    wardrobe: "marshal",
  },
  {
    pose: "rail",
    position: [14.2, 0, 6.2],
    yaw: FACING_ROAD_SOUTH - 0.3,
    seed: 5002,
    wardrobe: "marshal",
  },
];

/** Pancartes d'encouragement : texte, fond, encre, jaune de marque et nuit de l'application. */
export interface Placard {
  text: string;
  background: string;
  color: string;
}

const PLACARD_INKS: { background: string; color: string }[] = [
  { background: APP_HEX.brand, color: APP_HEX.ink },
  { background: APP_HEX.night, color: APP_HEX.brand },
  { background: APP_HEX.snow, color: APP_HEX.ink },
  { background: APP_HEX.brand, color: APP_HEX.night },
  { background: APP_HEX.slate, color: APP_HEX.snow },
];
const PLACARD_TEXTS = [
  "ALLEZ LE 27 !",
  "FONCE !",
  "ON EST LÀ !",
  "PLEIN GAZ",
  "À FOND !",
  "BRAVO !",
  "ALLEZ !",
];

/** Pancarte tirée de la graine : message et couleurs. */
export const placardOf = (seed: number): Placard => ({
  text: pick(PLACARD_TEXTS, seed * 3 + 1),
  ...pick(PLACARD_INKS, seed * 3 + 2),
});

/** Habillage d'un bout de spéciale : `places` endroits de ce type. */
export interface DistributionRow {
  zone: string;
  places: number;
  flags: number;
  placards: number;
  /** Drapeaux sur mâts */
  masts: number;
  marshals: number;
  where: string;
}

/** Répartition sur une spéciale : départ et arrivée ont le même dispositif, seuls l'enseigne et le damier changent. */
export const DISTRIBUTION: DistributionRow[] = [
  {
    zone: "Départ",
    places: 1,
    flags: 4,
    placards: 2,
    masts: 3,
    marshals: 4,
    where:
      "arche et panneau lumineux, banderole, 3 mâts à drapeaux, tente, public des deux côtés derrière la rubalise, 2 commissaires de chaque côté de la ligne, derrière la rubalise",
  },
  {
    zone: "Intermédiaires (secteurs 2 et 3)",
    places: 2,
    flags: 2,
    placards: 1,
    masts: 0,
    marshals: 0,
    where: "une voile de chaque côté de l'arche, en quinconce",
  },
  {
    zone: "Épingles (les 3 plus serrées)",
    places: 3,
    flags: 2,
    placards: 3,
    masts: 0,
    marshals: 1,
    where:
      "une voile à chaque bout de la barrière, pancartes aux extrémités du public, un commissaire au point de corde",
  },
  {
    zone: "Arrivée",
    places: 1,
    flags: 4,
    placards: 2,
    masts: 4,
    marshals: 4,
    where:
      "le même dispositif que le départ, enseigne à damier, un 4e mât à damier, sans panneau lumineux",
  },
];

/** Bout de spéciale (départ ou arrivée), en mètres depuis l'arche le long de X. */
export const CONTROL = {
  tapeFrom: -6,
  sails: [-3, 3],
  signs: [5, 6.8],
  banner: 7,
  masts: [12, 13.6, 15.2],
  checkerMast: 16.8,
  tent: 23,
} as const;

/** Public d'un bout de spéciale, derrière la rubalise (z = ±4,6) : deux rangs au sud, un groupe au nord après les mâts. */
export const controlCrowd = (x: number, seedBase: number): CrowdMember[] => {
  const south = Array.from({ length: 16 }, (_, i): CrowdMember => {
    const seed = seedBase + i * 7;
    const row = Math.floor(i / 8);
    return {
      pose:
        row === 0
          ? pick(["rail", "rail", "cheer", "flag", "photo"] as const, seed)
          : pick(MIXED, seed),
      position: [
        x + 8.6 + (i % 8) * 1.45 + row * 0.7 + between(-0.2, 0.2, seed + 1),
        0,
        5.6 + row * 1.1 + between(-0.12, 0.12, seed + 2),
      ],
      yaw: FACING_ROAD_SOUTH + between(-0.35, 0.35, seed + 3),
      seed,
      scale: between(0.93, 1.06, seed + 4),
    };
  });
  const north = Array.from({ length: 8 }, (_, i): CrowdMember => {
    const seed = seedBase + 500 + i * 7;
    const row = Math.floor(i / 4);
    return {
      pose:
        row === 0
          ? pick(["rail", "cheer", "flag"] as const, seed)
          : pick(MIXED, seed),
      position: [
        x + 17.4 + (i % 4) * 1.15 + row * 0.5 + between(-0.15, 0.15, seed + 1),
        0,
        -5.6 - row * 1.1 + between(-0.12, 0.12, seed + 2),
      ],
      yaw: between(-0.35, 0.35, seed + 3),
      seed,
      scale: between(0.93, 1.06, seed + 4),
    };
  });
  return [...south, ...north];
};

/** Commissaires d'un bout de spéciale : un avant et un après la ligne, de chaque côté, derrière la rubalise (côté public). */
export const controlMarshals = (x: number, seedBase: number): CrowdMember[] =>
  [-2.2, 2.2].flatMap((dx, n) =>
    [-5.3, 5.3].map((z, side): CrowdMember => {
      const seed = seedBase + n * 2 + side;
      // Tourné vers la route et un peu vers la ligne
      const toLine = dx < 0 ? 0.45 : -0.45;
      // Cap positif = vers +X au nord, négatif au sud
      return {
        pose: "marshal",
        position: [x + dx, 0, z],
        yaw: z < 0 ? toLine : FACING_ROAD_SOUTH - toLine,
        seed,
        wardrobe: "marshal",
      };
    }),
  );

/** Échantillon de drapeaux tenus, au nord de la route face à la vue par défaut : 24 tirages sur 3 rangs. */
export const FLAG_SAMPLE: CrowdMember[] = Array.from({ length: 24 }, (_, i) => {
  const seed = 6000 + i * 19;
  const row = Math.floor(i / 8);
  return {
    pose: "flag" as const,
    position: [
      9.4 + (i % 8) * 1.25 + row * 0.4,
      0,
      -7.6 - row * 1.4 + between(-0.15, 0.15, seed + 1),
    ] as Vec3,
    yaw: between(-0.2, 0.2, seed + 3),
    seed,
  };
});

/** Chaîne de niveaux de détail : B de près, A au-delà de 120 m, C au-delà de 300 m. */
export const LOD_ORIGIN_X = -80;
export const LOD_NEAR = 120;
export const LOD_FAR = 300;
export const LOD_END = 440;

const lodPair = (distance: number, seed: number): CrowdMember[] =>
  [-1.2, 1.2].map((z, n) => ({
    pose: pick(MIXED, seed + n),
    position: [LOD_ORIGIN_X - distance, 0, z] as Vec3,
    // Face au point de vue, vers +X
    yaw: Math.PI / 2 + between(-0.3, 0.3, seed + n + 7),
    seed: seed + n,
  }));

const lodRange = (from: number, to: number, step: number): CrowdMember[] =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) =>
    lodPair(from + i * step, 7000 + from + i * 31),
  ).flat();

/** File de spectateurs qui s'éloigne du point de vue, découpée aux seuils. */
export const LOD_FILE: Record<StyleId, CrowdMember[]> = {
  figurine: lodRange(4, LOD_NEAR - 4, 8),
  facet: lodRange(LOD_NEAR + 4, LOD_FAR - 4, 12),
  picto: lodRange(LOD_FAR + 4, LOD_END, 16),
};

/** Petite variation déterministe pour les objets d'habillage. */
export const jitter = (seed: number, amount: number): number =>
  (hash(seed) - 0.5) * amount;
