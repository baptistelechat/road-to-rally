import { useCallback, useMemo, useRef } from "react";
import type { Simulation } from "@/sim/simulation";
import { miniMapOutline } from "../../../miniMapOutline";
import { type CarTick, useCarTick } from "./carTick";
import { CarArrow, Markers, Road } from "./Road";

interface GlobalMapProps {
  sim: Simulation;
  /** Épaisseur de route à l'écran, plus fine dans la vignette */
  roadWidth: number;
  /** Côté dessiné en pixels, padding déduit : l'épaisseur de route en dépend */
  pixels: number;
  className: string;
}

/** Toute la spéciale à l'échelle, nord en haut : (x, z) se lisent tels quels. */
export const GlobalMap = ({
  sim,
  roadWidth,
  pixels,
  className,
}: GlobalMapProps) => {
  const done = useRef<SVGPathElement>(null);
  const arrow = useRef<SVGPathElement>(null);
  const { path, viewBox, start, finish, unit, size, doneAt } = useMemo(
    () => miniMapOutline(sim.track),
    [sim],
  );

  const onTick = useCallback(
    ({ x, z, heading, index }: CarTick) => {
      done.current?.setAttribute("stroke-dasharray", `${doneAt(index)} 1`);
      arrow.current?.setAttribute(
        "transform",
        `translate(${x} ${z}) rotate(${heading})`,
      );
    },
    [doneAt],
  );
  useCarTick(sim, onTick);

  return (
    <svg viewBox={viewBox} aria-hidden className={className}>
      <Road
        path={path}
        width={roadWidth}
        scale={size / pixels}
        doneRef={done}
      />
      <Markers
        start={start}
        finish={finish}
        closed={sim.track.closed}
        unit={unit}
      />
      <CarArrow unit={unit * 0.8} arrowRef={arrow} />
    </svg>
  );
};
