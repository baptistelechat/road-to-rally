import { useCallback, useMemo, useRef } from "react";
import type { Simulation } from "@/sim/simulation";
import type { CarSource } from "@/render/carSource";
import { miniMapOutline, ZOOM_MAX_POINTS } from "../../../miniMapOutline";
import { type CarTick, placeGhost, useCarTick } from "./carTick";
import { CarArrow, Gates, GhostDot, Markers, Road } from "./Road";

/** Demi-largeur de la vue, en mètres : 800 m de côté */
const RADIUS = 400;
const UNIT = RADIUS / 60;
/** Cap en haut : voiture aux trois quarts du bas, pour voir plus loin devant que derrière */
const AHEAD = 0.5;
/** Côté du panneau en pixels (`size-40`) */
const PIXELS = 160;

interface ZoomMapProps {
  sim: Simulation;
  /** Fantôme, relu à chaque image */
  ghost: Pick<CarSource, "getPose"> | null;
  /** `true` : la carte tourne et la route à venir est toujours devant. `false` : nord en haut. */
  headingUp: boolean;
  className: string;
}

/** Portion de la spéciale autour de la voiture, à plus grande échelle. */
export const ZoomMap = ({
  sim,
  ghost,
  headingUp,
  className,
}: ZoomMapProps) => {
  const map = useRef<SVGGElement>(null);
  const done = useRef<SVGPathElement>(null);
  const arrow = useRef<SVGPathElement>(null);
  const ghostDot = useRef<SVGCircleElement>(null);
  const { path, start, finish, gates, doneAt } = useMemo(
    () => miniMapOutline(sim.track, ZOOM_MAX_POINTS),
    [sim],
  );

  const onTick = useCallback(
    (tick: CarTick) => {
      const { x, z, heading, index } = tick;
      placeGhost(ghostDot.current, tick.ghost);
      done.current?.setAttribute("stroke-dasharray", `${doneAt(index)} 1`);
      const turn = headingUp ? `rotate(${-heading}) ` : "";
      map.current?.setAttribute("transform", `${turn}translate(${-x} ${-z})`);
      arrow.current?.setAttribute(
        "transform",
        `rotate(${headingUp ? 0 : heading})`,
      );
    },
    [headingUp, doneAt],
  );
  useCarTick(sim, ghost, onTick);

  const top = headingUp ? -RADIUS * (1 + AHEAD) : -RADIUS;
  return (
    <svg
      viewBox={`${-RADIUS} ${top} ${RADIUS * 2} ${RADIUS * 2}`}
      aria-hidden
      className={className}
    >
      <g ref={map}>
        <Road
          path={path}
          width={6}
          scale={(RADIUS * 2) / PIXELS}
          doneRef={done}
        />
        <Gates gates={gates} unit={UNIT} />
        <Markers
          start={start}
          finish={finish}
          closed={sim.track.closed}
          unit={UNIT}
        />
        <GhostDot unit={UNIT} ghostRef={ghostDot} />
      </g>
      <CarArrow unit={UNIT} arrowRef={arrow} />
      {!headingUp && (
        // Aiguille de boussole, rouge au nord : la carte ne tourne pas, elle non plus.
        <g
          transform={`translate(${RADIUS - UNIT * 15} ${-RADIUS + UNIT * 15}) scale(${UNIT})`}
        >
          <circle
            r={11}
            fill="black"
            stroke="white"
            strokeOpacity={0.3}
            vectorEffect="non-scaling-stroke"
          />
          <path d="M0 -8.5L3.2 0L-3.2 0Z" fill="#ef4444" />
          <path d="M0 8.5L3.2 0L-3.2 0Z" fill="#e5e7eb" />
        </g>
      )}
    </svg>
  );
};
