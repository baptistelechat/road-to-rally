"use client";

import type { Copilot } from "@/game/copilot";
import { requestRestart, setHudScreen, useHudStore } from "@/game/hudStore";
import type { ImportedStage } from "@/game/useStageImport";
import { formatLap } from "../../formatTime";
import { CopilotOptionsPanel } from "../CopilotOptionsPanel";
import { MapSelect } from "../MapSelect";
import { leaveFor } from "./mapChoices";
import { MenuDrawer } from "./MenuDrawer";
import { brandSlantButton, drawerButton } from "./menuStyles";

interface PauseDrawerProps {
  map: string;
  mapLabel: string;
  /** Tracé en boucle, sinon spéciale d'un départ à une arrivée */
  closed: boolean;
  copilot: Copilot;
  onImported: (stage: ImportedStage) => void;
  onToggleMute: () => void;
}

/** Pause en road-book (maquette R-Pause) : reprise, carte et toutes les options sur un seul panneau. */
export const PauseDrawer = ({
  map,
  mapLabel,
  closed,
  copilot,
  onImported,
  onToggleMute,
}: PauseDrawerProps) => {
  const muted = useHudStore((s) => s.muted);
  const lapMs = useHudStore((s) => s.lapMs);
  return (
    <MenuDrawer
      title="Pause"
      onDismiss={() => setHudScreen("race")}
      aside={
        <span className="font-mono text-base text-muted-foreground tabular-nums">
          {mapLabel} · {formatLap(lapMs)}
        </span>
      }
    >
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
        <button
          type="button"
          autoFocus
          className={`min-h-10 px-4 text-sm ${brandSlantButton}`}
          onClick={() => setHudScreen("race")}
        >
          Reprendre
        </button>
        <button
          type="button"
          className={drawerButton}
          onClick={() => {
            requestRestart();
            setHudScreen("race");
          }}
        >
          {closed ? "Relancer le tour" : "Relancer"}
        </button>
        <button
          type="button"
          className={drawerButton}
          onClick={onToggleMute}
        >
          {muted ? "Remettre le son" : "Couper le son"}
        </button>
      </div>
      <MapSelect map={map} mapLabel={mapLabel} onImported={onImported} />
      <CopilotOptionsPanel copilot={copilot} />
      <nav aria-label="Quitter la course" className="mt-auto flex gap-2 pt-2">
        <button
          type="button"
          className={`${drawerButton} flex-1`}
          onClick={() => leaveFor("/garage")}
        >
          Garage
        </button>
        <button
          type="button"
          className={`${drawerButton} flex-1`}
          onClick={() => {
            // Comme le « Menu » de l'écran d'arrivée : la course repart de zéro au prochain départ.
            requestRestart();
            setHudScreen("start");
          }}
        >
          Menu principal
        </button>
      </nav>
    </MenuDrawer>
  );
};
