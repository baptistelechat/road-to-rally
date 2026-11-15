import type { Rgb } from "@/render/palette";

// Teintes propres au labo, en RVB linéaire 0..1 comme les couleurs par sommet du jeu.
// À reporter dans `DECOR_PALETTE` une fois les propositions retenues.

export const FACADE: Record<string, Rgb[]> = {
  /** Crépis de bourg : beige, blanc cassé, ocre clair, rosé */
  render: [
    [0.88, 0.83, 0.72],
    [0.9, 0.88, 0.82],
    [0.85, 0.75, 0.6],
    [0.87, 0.77, 0.7],
  ],
  /** Crépis de pavillon, plus clairs */
  renderLight: [
    [0.93, 0.91, 0.87],
    [0.91, 0.89, 0.83],
    [0.9, 0.86, 0.78],
  ],
  stoneOchre: [
    [0.72, 0.62, 0.47],
    [0.68, 0.6, 0.49],
    [0.76, 0.67, 0.52],
  ],
  granite: [
    [0.56, 0.56, 0.54],
    [0.6, 0.59, 0.56],
    [0.52, 0.52, 0.5],
  ],
  brick: [
    [0.62, 0.38, 0.27],
    [0.58, 0.36, 0.27],
  ],
  wood: [
    [0.38, 0.27, 0.18],
    [0.42, 0.31, 0.21],
  ],
  steelLight: [
    [0.74, 0.76, 0.77],
    [0.7, 0.72, 0.74],
  ],
  steelGreen: [
    [0.3, 0.42, 0.34],
    [0.32, 0.38, 0.42],
  ],
  /** Silos : tôle galvanisée ou béton */
  silo: [
    [0.78, 0.79, 0.8],
    [0.72, 0.73, 0.73],
  ],
  /** Serres : gris-bleu très clair */
  greenhouse: [
    [0.84, 0.88, 0.9],
    [0.82, 0.86, 0.89],
  ],
  /** Pierre de taille claire des monuments */
  stoneLight: [
    [0.82, 0.78, 0.7],
    [0.78, 0.75, 0.68],
  ],
};

export const ROOF: Record<string, Rgb> = {
  tile: [0.6, 0.27, 0.18],
  tileDark: [0.47, 0.23, 0.16],
  slate: [0.25, 0.27, 0.31],
  steel: [0.52, 0.54, 0.56],
  steelDark: [0.36, 0.38, 0.41],
  gravel: [0.45, 0.44, 0.41],
  greenhouse: [0.8, 0.86, 0.9],
  stone: [0.72, 0.69, 0.62],
};

/** Volets : bleu-gris, vert, bordeaux, blanc cassé */
export const SHUTTERS: Rgb[] = [
  [0.36, 0.48, 0.56],
  [0.3, 0.42, 0.32],
  [0.46, 0.2, 0.18],
  [0.82, 0.8, 0.74],
];
export const SHUTTERS_BLUE: Rgb[] = [[0.28, 0.4, 0.52]];

export const DETAIL: Record<string, Rgb> = {
  glass: [0.14, 0.17, 0.21],
  glassBlue: [0.2, 0.28, 0.36],
  stainedGlass: [0.17, 0.16, 0.28],
  frame: [0.9, 0.88, 0.82],
  doorWood: [0.32, 0.21, 0.14],
  doorSteel: [0.56, 0.58, 0.6],
  doorDark: [0.2, 0.2, 0.21],
  sign: [0.55, 0.16, 0.14],
  plinthStone: [0.46, 0.43, 0.39],
  plinthGrey: [0.52, 0.52, 0.51],
  concrete: [0.6, 0.6, 0.58],
  quoins: [0.84, 0.8, 0.7],
  quoinsGranite: [0.46, 0.46, 0.45],
  chimney: [0.62, 0.5, 0.42],
  underside: [0.4, 0.33, 0.27],
  post: [0.36, 0.3, 0.24],
  ridge: [0.42, 0.18, 0.12],
  ridgeSlate: [0.18, 0.19, 0.22],
};
