import { useEffect } from "react";
import type { Simulation } from "@/sim/simulation";
import { screenHeading } from "../../../miniMapOutline";

export interface CarTick {
  x: number;
  z: number;
  /** Cap à l'écran en degrés, 0 = nord en haut */
  heading: number;
  /** Index de `track.points` le plus proche de la voiture */
  index: number;
}

const readTick = (sim: Simulation): CarTick => {
  const { position, rotation } = sim.state();
  const { track } = sim;
  // Sur une spéciale, l'abscisse suivie ne saute pas d'une branche d'épingle à l'autre ; le circuit n'en a pas.
  const s = track.closed
    ? track.nearest(position.x, position.z).s
    : sim.routeS();
  return {
    x: position.x,
    z: position.z,
    heading: screenHeading(rotation),
    index: track.indexAt(s),
  };
};

/** À chaque image, par références directes sur le SVG : aucun rendu React pendant la course. À 10 Hz, une carte qui tourne saccadait. */
export const useCarTick = (
  sim: Simulation,
  onTick: (tick: CarTick) => void,
): void => {
  useEffect(() => {
    let frame = 0;
    const run = (): void => {
      onTick(readTick(sim));
      frame = requestAnimationFrame(run);
    };
    run();
    return () => cancelAnimationFrame(frame);
  }, [sim, onTick]);
};
