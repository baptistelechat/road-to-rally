import { useEffect } from "react";
import type { Simulation } from "@/sim/simulation";
import type { CarSource } from "@/render/carSource";
import { screenHeading } from "../../../miniMapOutline";

export interface CarTick {
  x: number;
  z: number;
  /** Cap à l'écran en degrés, 0 = nord en haut */
  heading: number;
  /** Index de `track.points` le plus proche de la voiture */
  index: number;
  /** Position du fantôme, `null` sans fantôme */
  ghost: { x: number; z: number } | null;
}

type GhostSource = Pick<CarSource, "getPose"> | null;

const readTick = (sim: Simulation, source: GhostSource): CarTick => {
  const ghost = source?.getPose() ?? null;
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
    ghost: ghost ? ghost.position : null,
  };
};

/** À chaque image, par références directes sur le SVG : aucun rendu React pendant la course. À 10 Hz, une carte qui tourne saccadait. */
export const useCarTick = (
  sim: Simulation,
  ghost: GhostSource,
  onTick: (tick: CarTick) => void,
): void => {
  useEffect(() => {
    let frame = 0;
    const run = (): void => {
      onTick(readTick(sim, ghost));
      frame = requestAnimationFrame(run);
    };
    run();
    return () => cancelAnimationFrame(frame);
  }, [sim, ghost, onTick]);
};

/** Montre ou cache le fantôme et le place, en coordonnées du monde. */
export const placeGhost = (
  dot: SVGCircleElement | null,
  ghost: { x: number; z: number } | null,
): void => {
  if (!dot) return;
  dot.setAttribute("visibility", ghost ? "visible" : "hidden");
  if (ghost) dot.setAttribute("transform", `translate(${ghost.x} ${ghost.z})`);
};
