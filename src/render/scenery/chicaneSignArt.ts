// Le dessin du panneau A1c sur une image de 577 × 508, sans Three.js : le modèle 3D et le marqueur de l'éditeur en partagent le contour.

export type SignOutline = [number, number][];

export const SIGN_ART_WIDTH = 577;
export const SIGN_ART_HEIGHT = 508;

/** Coins cassés, comme ceux arrondis d'une vraie tôle. */
export const SIGN_ART_RIM: SignOutline = [
  [276, 22],
  [12.5, 486],
  [25, 508],
  [552, 508],
  [564.5, 486],
  [301, 22],
];
export const SIGN_ART_BORDER: SignOutline = [
  [279, 26],
  [22, 481],
  [32, 498],
  [545, 498],
  [555, 481],
  [298, 26],
];
export const SIGN_ART_FIELD: SignOutline = [
  [288.5, 70],
  [65, 458],
  [512, 458],
];
/** Double virage, le premier à droite. */
export const SIGN_ART_BENDS: SignOutline = [
  [203, 442],
  [203, 300],
  [212, 278],
  [235, 268],
  [260, 280],
  [307, 318],
  [307, 222],
  [328, 188],
  [351, 222],
  [351, 340],
  [342, 363],
  [320, 375],
  [297, 364],
  [246, 322],
  [246, 442],
  [224, 415],
];
