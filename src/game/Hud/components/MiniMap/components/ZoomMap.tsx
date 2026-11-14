import { useCallback, useMemo, useRef } from "react";
import type { Simulation } from "@/sim/simulation";
import type { CarSource } from "@/render/carSource";
import { miniMapOutline, ZOOM_MAX_POINTS } from "../../../miniMapOutline";
import { type CarTick, placeGhost, useCarTick } from "./carTick";
import { CarArrow, Gates, GhostDot, Markers, Road } from "./Road";

/** Panneau en pixels (`w-60 h-32.5` de la mini-carte) */
const ZOOM_WIDTH = 240;
const ZOOM_HEIGHT = 130;
/** Demi-largeur de la vue, en mètres : 800 m de large */
const RADIUS = 400;
/** Hauteur de la vue en mètres, au ratio du panneau */
const SPAN = (RADIUS * 2 * ZOOM_HEIGHT) / ZOOM_WIDTH;
/** Mètres par pixel */
const SCALE = (RADIUS * 2) / ZOOM_WIDTH;
/** Taille des marqueurs : 4/3 de pixel, comme sur l'ancien panneau carré */
const UNIT = (SCALE * 4) / 3;
/** Cap en haut : voiture au quart du bas, pour voir plus loin devant que derrière */
const AHEAD = 0.75;

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

  const top = -SPAN * (headingUp ? AHEAD : 0.5);
  return (
    <svg
      viewBox={`${-RADIUS} ${top} ${RADIUS * 2} ${SPAN}`}
      aria-hidden
      className={className}
    >
      <g ref={map}>
        <Road
          path={path}
          width={6}
          scale={SCALE}
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
          transform={`translate(${RADIUS - UNIT * 15} ${top + UNIT * 15}) scale(${UNIT})`}
        >
          <circle
            r={11}
            style={{ fill: "var(--background)", stroke: "var(--foreground)" }}
            strokeOpacity={0.3}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0 -8.5L3.2 0L-3.2 0Z"
            style={{ fill: "var(--destructive)" }}
          />
          <path
            d="M0 8.5L3.2 0L-3.2 0Z"
            style={{ fill: "var(--foreground)" }}
          />
        </g>
      )}
    </svg>
  );
};
