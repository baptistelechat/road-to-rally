import type { RoundaboutIsland, SceneryItem, Track } from "../types";

/**
 * Îlot de rond-point (PR-13, option B) : une butte solide, ceinte de séparateurs en plastique lestés que la voiture
 * pousse sans traverser l'îlot. Sous `SEPARATOR_MIN_ISLAND`, la butte seule occupe tout l'îlot : pas de barrière fixe,
 * pour que toute barrière se renverse.
 */
export const SEPARATOR_MIN_ISLAND = 2.5;
/** Module rouge ou blanc : longueur le long de l'anneau, hauteur, demi-profondeur à la base, en mètres */
export const SEPARATOR_LENGTH = 1.6;
export const SEPARATOR_HEIGHT = 0.8;
export const SEPARATOR_HALF_DEPTH = 0.25;
/** Jeu entre deux modules, pour qu'ils ne se chevauchent jamais au repos */
const SEPARATOR_GAP = 0.1;
/** La butte commence derrière les séparateurs : leur profondeur et un peu de marge */
const CORE_INSET = 0.8;

const hasSeparators = ({ radius }: RoundaboutIsland): boolean =>
  radius >= SEPARATOR_MIN_ISLAND;

/** Rayon de la partie fixe de l'îlot : la butte, ou tout l'îlot quand il garde sa barrière. */
export const islandCoreRadius = (island: RoundaboutIsland): number =>
  hasSeparators(island) ? island.radius - CORE_INSET : island.radius;

/** Anneau des séparateurs : leur face extérieure tombe au bord de l'îlot. */
const ringOf = (island: RoundaboutIsland): number =>
  island.radius - SEPARATOR_HALF_DEPTH;

/**
 * Séparateurs de tous les îlots, objets légers posés sur le sol, en alternance rouge et blanc. Placés en tout dernier
 * par `generateScenery` : sans rond-point, le décor et le monde restent les mêmes au bit près.
 */
export const islandSeparatorItems = (track: Track): SceneryItem[] =>
  track.islands.filter(hasSeparators).flatMap((island) => {
    const ring = ringOf(island);
    const count = Math.floor(
      (2 * Math.PI * ring) / (SEPARATOR_LENGTH + SEPARATOR_GAP),
    );
    return Array.from({ length: count }, (_, i): SceneryItem => {
      const angle = ((i + 0.5) * 2 * Math.PI) / count;
      const x = island.position.x + Math.cos(angle) * ring;
      const z = island.position.z + Math.sin(angle) * ring;
      return {
        kind: i % 2 === 0 ? "islandSeparatorRed" : "islandSeparatorWhite",
        position: { x, y: track.groundAt(x, z) ?? island.position.y, z },
        // L'axe X du module suit la tangente de l'anneau, comme les modules de barrière.
        yaw: -angle - Math.PI / 2,
        scale: 1,
        colliderRadius: SEPARATOR_LENGTH / 2,
      };
    });
  });
