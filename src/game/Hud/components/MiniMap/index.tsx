"use client";

import { useHudStore } from "@/game/hudStore";
import type { Simulation } from "@/sim/simulation";
import type { CarSource } from "@/render/carSource";
import { panel } from "../../hudStyles";
import { GlobalMap } from "./components/GlobalMap";
import { ZoomMap } from "./components/ZoomMap";

/** En haut à droite, sous l'état du son : loin de la route et du chrono. */
interface MiniMapProps {
  sim: Simulation;
  ghost: Pick<CarSource, "getPose"> | null;
}

export const MiniMap = ({ sim, ghost }: MiniMapProps) => {
  const { miniMapEnabled, miniMapStyle } = useHudStore((s) => s.copilotOptions);
  if (!miniMapEnabled) return null;
  return (
    <div
      role="img"
      aria-label="Carte de la spéciale"
      className={`${panel} absolute top-16 right-4 size-40 overflow-hidden`}
    >
      {miniMapStyle === "global" ? (
        <GlobalMap
          sim={sim}
          ghost={ghost}
          roadWidth={4}
          pixels={144}
          className="size-full p-2"
        />
      ) : (
        <ZoomMap
          sim={sim}
          ghost={ghost}
          headingUp={miniMapStyle !== "north"}
          className="size-full"
        />
      )}
      {miniMapStyle === "hybrid" && (
        <GlobalMap
          sim={sim}
          ghost={ghost}
          roadWidth={2}
          pixels={48}
          className="absolute top-1 right-1 size-14 rounded-sm border border-white/15 bg-black/70 p-1"
        />
      )}
    </div>
  );
};
