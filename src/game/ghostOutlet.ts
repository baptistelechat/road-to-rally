import type { CarSource } from "@/render/carSource";
import type { Pose } from "@/sim/types";

/**
 * Pose du fantôme, écrite par la boucle de jeu dans le canvas et lue par la mini-carte hors du canvas.
 * Créée une fois par `Game` : aucun état React ne remonte du canvas.
 */
export interface GhostOutlet extends Pick<CarSource, "getPose"> {
  setPose: (pose: Pose | null) => void;
}

export const createGhostOutlet = (): GhostOutlet => {
  let current: Pose | null = null;
  return {
    getPose: () => current,
    setPose: (pose) => {
      current = pose;
    },
  };
};
