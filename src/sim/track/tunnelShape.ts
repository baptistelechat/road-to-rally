// Gabarit du tube d'un tunnel (PR-21) : partagé par le pipeline (montagne au-dessus), les collisions et le rendu.
import type { TunnelPortal } from "../types";

/** Hauteur des parois droites au-dessus de la chaussée, en mètres */
export const TUNNEL_WALL_HEIGHT = 4.5;
/** Flèche de la voûte au-dessus des parois, en mètres */
export const TUNNEL_VAULT_RISE = 1.8;
/** Épaisseur du tube, voûte et parois : la montagne se pose au-dessus, à son extrados, en mètres */
export const TUNNEL_COVER = 1;
/** Paroi enterrée sous la chaussée : pas de jour entre le sol et le mur, en mètres */
export const TUNNEL_SKIRT = 0.3;
/** Segments de la voûte, d'une paroi à l'autre */
export const TUNNEL_VAULT_SEGMENTS = 8;

export const TUNNEL_PORTALS: readonly TunnelPortal[] = [
  "rock",
  "stone",
  "concrete",
];

/** Classes de petite route (importance BD TOPO 4 à 6, voir `ignRoads.ts`) : arche en pierre entre 80 et 300 m */
const SMALL_ROADS = new Set([
  "tertiary",
  "unclassified",
  "residential",
  "track",
]);

/** Portail automatique (PR-22) : roc brut sous 80 m, arche en pierre sur petite route jusqu'à 300 m, béton sinon. */
export const tunnelPortal = (
  length: number,
  highway: string | null,
): TunnelPortal => {
  if (length < 80) return "rock";
  if (length <= 300 && highway !== null && SMALL_ROADS.has(highway))
    return "stone";
  return "concrete";
};

/**
 * Profil intérieur en travers, de la paroi gauche à la paroi droite : (latéral, hauteur) par rapport à l'axe.
 * Latéral positif à droite, comme `bridgeGeometry` et les garde-corps.
 */
export const tunnelProfile = (
  halfWidth: number,
  /** Décalage vers l'extérieur : 0 pour l'intrados, `TUNNEL_COVER` pour l'extrados */
  grow = 0,
): [number, number][] => {
  const width = halfWidth + grow;
  const profile: [number, number][] = [[-width, -TUNNEL_SKIRT]];
  for (let k = 0; k <= TUNNEL_VAULT_SEGMENTS; k++) {
    const angle = Math.PI * (1 - k / TUNNEL_VAULT_SEGMENTS);
    profile.push([
      width * Math.cos(angle),
      TUNNEL_WALL_HEIGHT + (TUNNEL_VAULT_RISE + grow) * Math.sin(angle),
    ]);
  }
  profile.push([width, -TUNNEL_SKIRT]);
  return profile;
};
