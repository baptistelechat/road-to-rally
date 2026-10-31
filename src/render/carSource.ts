import type { CarState, Pose } from "@/sim/types";

/**
 * Ce que le rendu voit de la voiture. Lire dans `useFrame` sans déclencher de rendu React.
 * La boucle de jeu tourne en `useFrame(…, -1)`, donc avant tous les composants à priorité par défaut.
 */
export interface CarSource {
  /** Dernier état de simulation (rpm, roues, glissement…) */
  getState: () => CarState | null;
  /** Pose interpolée entre les deux derniers pas : à utiliser pour tout ce qui s'affiche */
  getPose: () => Pose | null;
  /** Incrémenté à chaque remise en piste : la caméra et les effets doivent se recaler sans balayage */
  getRespawnCount: () => number;
}
