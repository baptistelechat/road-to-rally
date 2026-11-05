"use client";

import { useHudStore } from "@/game/hudStore";
import type { Simulation } from "@/sim/simulation";
import { panel } from "../../hudStyles";
import { GlobalMap } from "./components/GlobalMap";
import { ZoomMap } from "./components/ZoomMap";

/** En haut à droite, sous l'état du son : loin de la route et du chrono. */
export const MiniMap = ({ sim }: { sim: Simulation }) => {
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
          roadWidth={4}
          pixels={144}
          className="size-full p-2"
        />
      ) : (
        <ZoomMap
          sim={sim}
          headingUp={miniMapStyle !== "north"}
          className="size-full"
        />
      )}
      {miniMapStyle === "hybrid" && (
        <GlobalMap
          sim={sim}
          roadWidth={2}
          pixels={48}
          className="absolute top-1 right-1 size-14 rounded-sm border border-foreground/15 bg-background/70 p-1"
        />
      )}
    </div>
  );
};
