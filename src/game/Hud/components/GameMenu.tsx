"use client";

import { useState } from "react";
import type { Copilot } from "@/game/copilot";
import { requestRestart, setHudScreen, useHudStore } from "@/game/hudStore";
import type { ImportedStage } from "@/game/useStageImport";
import { hudButton, menuFocus, panel } from "../hudStyles";
import { CopilotOptionsPanel } from "./CopilotOptionsPanel";
import { MapSelect } from "./MapSelect";

interface GameMenuProps {
  map: string;
  mapLabel: string;
  /** Tracé en boucle, sinon spéciale d'un départ à une arrivée */
  closed: boolean;
  copilot: Copilot;
  onImported: (stage: ImportedStage) => void;
  onToggleMute: () => void;
}

/** Démonté en course : le menu rouvre toujours sur sa première page. */
const MenuDialog = ({
  map,
  mapLabel,
  closed,
  copilot,
  onImported,
  onToggleMute,
  paused,
}: GameMenuProps & { paused: boolean }) => {
  const muted = useHudStore((s) => s.muted);
  // `returned` : retour des options, le focus revient sur leur bouton.
  const [view, setView] = useState<"menu" | "options" | "returned">("menu");
  const inOptions = view === "options";
  let title = paused ? "Pause" : "Rally";
  if (inOptions) title = "Options";
  return (
    <dialog
      open
      aria-labelledby="menu-title"
      className="pointer-events-auto absolute inset-0 z-20 m-0 grid size-full max-h-none max-w-none place-items-center border-0 bg-background/45 p-0 text-inherit opacity-100 transition-opacity duration-200 starting:opacity-0"
    >
      <div
        className={`${panel} ${inOptions ? "max-h-[95vh] w-[34rem] overflow-y-auto" : "w-80"} space-y-4 p-6 text-center`}
      >
        <h1 id="menu-title" className="text-2xl font-bold">
          {title}
        </h1>
        {inOptions ? (
          <CopilotOptionsPanel
            copilot={copilot}
            onBack={() => setView("returned")}
          />
        ) : (
          <>
            <MapSelect map={map} mapLabel={mapLabel} onImported={onImported} />
            <button
              type="button"
              autoFocus={view === "menu"}
              data-needs-sound={paused ? undefined : ""}
              className={`w-full rounded bg-brand px-4 py-3 font-bold text-brand-foreground hover:bg-brand/85 ${menuFocus}`}
              onClick={() => setHudScreen("race")}
            >
              {paused ? "Reprendre" : "Prendre le départ"}
            </button>
            {paused && (
              <button
                type="button"
                className={`${hudButton} ${menuFocus} w-full`}
                onClick={() => {
                  requestRestart();
                  setHudScreen("race");
                }}
              >
                {closed ? "Relancer le tour" : "Relancer"}
              </button>
            )}
            <button
              type="button"
              autoFocus={view === "returned"}
              className={`${hudButton} ${menuFocus} w-full`}
              onClick={() => setView("options")}
            >
              Options
            </button>
            {paused && (
              <button
                type="button"
                className={`${hudButton} ${menuFocus} w-full`}
                onClick={onToggleMute}
              >
                {muted ? "Remettre le son" : "Couper le son"}
              </button>
            )}
          </>
        )}
      </div>
    </dialog>
  );
};

/**
 * Menu de départ et de pause : choix de la carte et lancement de la course, gelée derrière.
 * Le premier geste sur ce menu débloque aussi le son : `useGameSession` écoute toute la page.
 */
export const GameMenu = (props: GameMenuProps) => {
  const screen = useHudStore((s) => s.screen);
  if (screen === "race") return null;
  return <MenuDialog {...props} paused={screen === "pause"} />;
};
