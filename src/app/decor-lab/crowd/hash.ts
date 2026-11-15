// Hachage entier déterministe : toute variation du labo en dérive, jamais de Math.random.

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

/** Valeur dans [min, max) choisie par graine. */
export const between = (min: number, max: number, seed: number): number =>
  min + (max - min) * hash(seed);
