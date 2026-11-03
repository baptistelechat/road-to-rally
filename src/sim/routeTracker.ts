import { SHOULDER_WIDTH } from "./track/ribbon";
import type { Track } from "./types";

/** Saut d'abscisse toléré en plus du chemin parcouru hors de la route, en mètres */
const ROUTE_MAX_JUMP = 25;
/** Écart vertical à la route au-delà duquel la voiture n'y est plus, en chute ou sur une autre branche, en mètres */
const ROUTE_MAX_HEIGHT = 3;

export interface RouteTracker {
  update: (x: number, y: number, z: number) => { s: number; offRoute: boolean };
  /** Dernière abscisse où la voiture roulait vraiment sur la route */
  s: () => number;
  reset: (s: number) => void;
}

/**
 * Suit la portion de route que la voiture parcourt sur un tracé ouvert. Revenir sur la chaussée après une sortie reste
 * contigu tant que le saut d'abscisse est couvert par le chemin parcouru dehors : à 150 km/h, 25 m passent en 0,6 s.
 * Seule une portion atteinte sans ce chemin, comme l'autre branche d'une épingle, compte comme hors piste.
 */
export const createRouteTracker = (
  track: Pick<Track, "nearest">,
  startS: number,
): RouteTracker => {
  let routeS = startS;
  let strayed = 0;
  let last: { x: number; z: number } | null = null;

  return {
    update: (x, y, z) => {
      const here = track.nearest(x, z, routeS);
      const onRoad =
        here.distance <= here.width / 2 + SHOULDER_WIDTH &&
        Math.abs(y - here.point.y) < ROUTE_MAX_HEIGHT;
      if (!onRoad && last) strayed += Math.hypot(x - last.x, z - last.z);
      last = { x, z };
      const contiguous = Math.abs(here.s - routeS) <= ROUTE_MAX_JUMP + strayed;
      if (onRoad && contiguous) {
        routeS = here.s;
        strayed = 0;
      }
      return { s: here.s, offRoute: onRoad && !contiguous };
    },
    s: () => routeS,
    reset: (s) => {
      routeS = s;
      strayed = 0;
      last = null;
    },
  };
};
