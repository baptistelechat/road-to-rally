import type { SceneryItem } from "../types";

// Pose du public, tirée par hachage de la position : module pur, partagé par le placement (simulation) et le
// rendu (`src/render/scenery/crowd/crowdLod.ts`). Même formule qu'avant le partage : aucune pose ne change.

/** Poses du public, dans l'ordre de `POSES` du rendu (`crowd/people.ts`) */
export type CrowdPoseId =
  | "cheer"
  | "rail"
  | "photo"
  | "seated"
  | "shoulders"
  | "flag"
  | "marshal";

/** Entier quelconque vers [0, 1), stable d'une session à l'autre. */
export const hash = (n: number): number => {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

/** Élément d'une liste choisi par graine. */
export const pick = <T>(list: readonly T[], seed: number): T =>
  list[Math.min(list.length - 1, Math.floor(hash(seed) * list.length))];

/** Graine tirée de la position au centimètre : rien à ajouter à la simulation ni au codec. */
export const crowdSeedAt = (x: number, z: number): number =>
  (Math.imul(Math.round(x * 100), 73856093) ^
    Math.imul(Math.round(z * 100), 19349663)) >>>
  8;

/** Poses tirées par graine, répétées selon leur poids. Le commissaire n'est jamais tiré. */
export const CROWD_POSE_POOL: readonly CrowdPoseId[] = [
  "cheer",
  "cheer",
  "cheer",
  "rail",
  "rail",
  "rail",
  "photo",
  "photo",
  "seated",
  "shoulders",
  "flag",
];

/** Pose d'un spectateur ou d'un commissaire, d'après sa position de pose. */
export const crowdPoseOf = (item: SceneryItem): CrowdPoseId =>
  item.kind === "marshal"
    ? "marshal"
    : pick(CROWD_POSE_POOL, crowdSeedAt(item.position.x, item.position.z) * 7);

/** Place prise au sol par une pose, à l'échelle 1, dans le repère du personnage (face au +Z). */
export interface CrowdSpace {
  /** Rayon de la bulle entre deux personnes : 0,35 + 0,35 = 0,7 m entre deux spectateurs debout */
  radius: number;
  /** Centre de la bulle, décalé vers le bras tendu ou les jambes, en mètres */
  offsetX: number;
  offsetZ: number;
  /** Rayon du corps et de ses accessoires au sol, face aux objets */
  body: number;
}

export const CROWD_SPACE: Record<CrowdPoseId, CrowdSpace> = {
  cheer: { radius: 0.35, offsetX: 0, offsetZ: 0, body: 0.3 },
  rail: { radius: 0.38, offsetX: 0, offsetZ: 0.1, body: 0.3 },
  photo: { radius: 0.37, offsetX: 0, offsetZ: 0.08, body: 0.3 },
  // Glacière de 0,5 m et jambes allongées devant.
  seated: { radius: 0.45, offsetX: 0, offsetZ: 0.1, body: 0.42 },
  shoulders: { radius: 0.42, offsetX: 0, offsetZ: 0, body: 0.32 },
  // Mât et toile du drapeau à droite (+X).
  flag: { radius: 0.5, offsetX: 0.3, offsetZ: 0, body: 0.3 },
  // Bras tendu et drapeau jaune jusqu'à 1 m à droite.
  marshal: { radius: 0.55, offsetX: 0.3, offsetZ: 0, body: 0.3 },
};
