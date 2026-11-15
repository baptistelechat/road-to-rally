// Copie de `src/app/decor-lab/crowd/hash.ts` : le labo évolue à part, resynchroniser à la main.
// Hachage entier déterministe : toute variation du labo en dérive, jamais de Math.random.
// `hash` et `pick` vivent dans `src/sim/track/crowdPose.ts`, partagés avec le placement du public.
import { hash } from "@/sim/track/crowdPose";

export { hash, pick } from "@/sim/track/crowdPose";

/** Valeur dans [min, max) choisie par graine. */
export const between = (min: number, max: number, seed: number): number =>
  min + (max - min) * hash(seed);
