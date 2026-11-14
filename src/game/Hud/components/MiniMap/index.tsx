"use client";

import type { HudStyle } from "@/game/copilotOptions";
import { useHudStore } from "@/game/hudStore";
import type { Simulation } from "@/sim/simulation";
import type { CarSource } from "@/render/carSource";
import { hudBlock } from "../../hudStyles";
import { GlobalMap } from "./components/GlobalMap";
import { ZoomMap } from "./components/ZoomMap";

interface MiniMapProps {
  sim: Simulation;
  ghost: Pick<CarSource, "getPose"> | null;
  /** Nom de la carte, en titre du plan */
  title: string;
  /** Cockpit : coin coupé. Broadcast : titre souligné façon habillage télé. */
  hudStyle: HudStyle;
}

/** Plan de la spéciale, en haut à droite : loin de la route et du chrono. Placé par le HUD. */
export const MiniMap = ({ sim, ghost, title, hudStyle }: MiniMapProps) => {
  const { miniMapEnabled, miniMapStyle } = useHudStore((s) => s.copilotOptions);
  if (!miniMapEnabled) return null;
  const cockpit = hudStyle === "cockpit";
  return (
    <section
      aria-label="Plan de la spéciale"
      className={`${hudBlock} w-60 ${cockpit ? "[clip-path:polygon(8%_0,100%_0,100%_100%,0_100%,0_12%)]" : ""}`}
    >
      <div
        className={`truncate font-display text-[0.6875rem] tracking-[0.12em] uppercase ${
          cockpit
            ? "border-b border-foreground/15 py-1.5 pr-3 pl-6"
            : "border-b-3 border-foreground bg-background px-3 py-1.5"
        }`}
      >
        {title}
      </div>
      <div
        role="img"
        aria-label="Carte de la spéciale"
        // ZOOM_WIDTH × ZOOM_HEIGHT : 240 × 130
        className="relative h-32.5 w-60 overflow-hidden"
      >
        {miniMapStyle === "global" ? (
          <GlobalMap
            sim={sim}
            ghost={ghost}
            roadWidth={4}
            width={224}
            height={114}
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
            width={48}
            height={48}
            className="absolute top-1 right-1 size-14 border border-foreground/15 bg-background/70 p-1"
          />
        )}
      </div>
    </section>
  );
};
