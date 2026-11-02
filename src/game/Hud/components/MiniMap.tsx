"use client";

import { useEffect, useMemo, useRef } from "react";
import { HUD_PERIOD_MS, useHudStore } from "@/game/hudStore";
import type { Simulation } from "@/sim/simulation";
import { panel } from "../hudStyles";
import { miniMapOutline } from "../miniMapOutline";

const MiniMapView = ({ sim }: { sim: Simulation }) => {
  const car = useRef<SVGCircleElement>(null);
  const { path, viewBox, start, finish, unit } = useMemo(
    () => miniMapOutline(sim.track),
    [sim],
  );

  useEffect(() => {
    const place = (): void => {
      const { x, z } = sim.state().position;
      car.current?.setAttribute("cx", String(x));
      car.current?.setAttribute("cy", String(z));
    };
    place();
    const timer = setInterval(place, HUD_PERIOD_MS);
    return () => clearInterval(timer);
  }, [sim]);

  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label="Carte de la spéciale"
      className={`${panel} absolute top-16 right-4 size-40 p-2`}
    >
      <path
        d={path}
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {!sim.track.closed && (
        <rect
          x={finish.x - unit * 3}
          y={finish.z - unit * 3}
          width={unit * 6}
          height={unit * 6}
          fill="white"
        />
      )}
      <circle
        cx={start.x}
        cy={start.z}
        r={unit * 3.5}
        fill="black"
        stroke="white"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <circle ref={car} r={unit * 4.5} fill="#fbbf24" stroke="black" />
    </svg>
  );
};

/** En haut à droite, sous l'état du son : loin de la route et du chrono. */
export const MiniMap = ({ sim }: { sim: Simulation }) => {
  const enabled = useHudStore((s) => s.copilotOptions.miniMapEnabled);
  return enabled ? <MiniMapView sim={sim} /> : null;
};
