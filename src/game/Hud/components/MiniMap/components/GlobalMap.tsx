import { useCallback, useMemo, useRef } from "react";
import type { Simulation } from "@/sim/simulation";
import type { CarSource } from "@/render/carSource";
import { miniMapOutline } from "../../../miniMapOutline";
import { type CarTick, placeGhost, useCarTick } from "./carTick";
import { CarArrow, Gates, GhostDot, Markers, Road } from "./Road";

interface GlobalMapProps {
  sim: Simulation;
  /** Fantôme, relu à chaque image */
  ghost: Pick<CarSource, "getPose"> | null;
  /** Épaisseur de route à l'écran, plus fine dans la vignette */
  roadWidth: number;
  /** Côté dessiné en pixels, padding déduit : l'épaisseur de route en dépend */
  pixels: number;
  className: string;
}

/** Toute la spéciale à l'échelle, nord en haut : (x, z) se lisent tels quels. */
export const GlobalMap = ({
  sim,
  ghost,
  roadWidth,
  pixels,
  className,
}: GlobalMapProps) => {
  const done = useRef<SVGPathElement>(null);
  const arrow = useRef<SVGPathElement>(null);
  const ghostDot = useRef<SVGCircleElement>(null);
  const { path, viewBox, start, finish, unit, size, gates, doneAt } = useMemo(
    () => miniMapOutline(sim.track),
    [sim],
  );

  const onTick = useCallback(
    (tick: CarTick) => {
      const { x, z, heading, index } = tick;
      placeGhost(ghostDot.current, tick.ghost);
      done.current?.setAttribute("stroke-dasharray", `${doneAt(index)} 1`);
      arrow.current?.setAttribute(
        "transform",
        `translate(${x} ${z}) rotate(${heading})`,
      );
    },
    [doneAt],
  );
  useCarTick(sim, ghost, onTick);

  return (
    <svg viewBox={viewBox} aria-hidden className={className}>
      <Road
        path={path}
        width={roadWidth}
        scale={size / pixels}
        doneRef={done}
      />
      <Gates gates={gates} unit={unit} />
      <Markers
        start={start}
        finish={finish}
        closed={sim.track.closed}
        unit={unit}
      />
      <GhostDot unit={unit * 0.8} ghostRef={ghostDot} />
      <CarArrow unit={unit * 0.8} arrowRef={arrow} />
    </svg>
  );
};
