/** Centre historique de la flèche (voir `TurnIcon`), décalé de `ARROW_SHIFT` pour tomber au centre du badge. */
export const DISC = { x: 32, y: 32, r: 25 };
export const ARROW_SHIFT = "translate(4 4)";
/** Tuile parallélogramme, cadre `viewBox="-1 -1 138 74"` */
export const TILE = "12,0 136,0 124,72 0,72";
/** Liseré du bas de la tuile, couleur de sortie du virage */
export const TILE_BAR = "1.5,66 125,66 124,72 0,72";
/** Badge hexagonal centré en (36, 36) */
export const HEX = "36,8 60,22 60,50 36,64 12,50 12,22";
/** Moitié du badge côté virage, pour la note de sortie d'un virage qui se resserre */
export const HEX_HALF = "36,8 60,22 60,50 36,64";
/** Retourne le badge pour un virage à gauche */
export const MIRROR = "translate(72 0) scale(-1 1)";
