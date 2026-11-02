"use client";

import { requestRestart, setHudScreen, useHudStore } from "@/game/hudStore";
import type { ImportedStage } from "@/game/useStageImport";
import { hudButton, menuFocus, panel } from "../hudStyles";
import { MapSelect } from "./MapSelect";

interface GameMenuProps {
  map: string;
  mapLabel: string;
  /** Tracé en boucle, sinon spéciale d'un départ à une arrivée */
  closed: boolean;
  onImported: (stage: ImportedStage) => void;
  onToggleMute: () => void;
}

/**
 * Menu de départ et de pause : choix de la carte et lancement de la course, gelée derrière.
 * Le premier geste sur ce menu débloque aussi le son : `useGameSession` écoute toute la page.
 */
export const GameMenu = ({
  map,
  mapLabel,
  closed,
  onImported,
  onToggleMute,
}: GameMenuProps) => {
  const screen = useHudStore((s) => s.screen);
  const muted = useHudStore((s) => s.muted);
  if (screen === "race") return null;
  const paused = screen === "pause";
  return (
    <dialog
      open
      aria-labelledby="menu-title"
      className="pointer-events-auto absolute inset-0 z-20 m-0 grid size-full max-h-none max-w-none place-items-center border-0 bg-black/45 p-0 text-inherit opacity-100 transition-opacity duration-200 starting:opacity-0"
    >
      <div className={`${panel} w-80 space-y-4 p-6 text-center`}>
        <h1 id="menu-title" className="text-2xl font-bold">
          {paused ? "Pause" : "Rally"}
        </h1>
        <MapSelect map={map} mapLabel={mapLabel} onImported={onImported} />
        <button
          type="button"
          autoFocus
          data-needs-sound={paused ? undefined : ""}
          className={`w-full rounded bg-amber-400 px-4 py-3 font-bold text-black hover:bg-amber-300 ${menuFocus}`}
          onClick={() => setHudScreen("race")}
        >
          {paused ? "Reprendre" : "Prendre le départ"}
        </button>
        {paused && (
          <>
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
            <button
              type="button"
              className={`${hudButton} ${menuFocus} w-full`}
              onClick={onToggleMute}
            >
              {muted ? "Remettre le son" : "Couper le son"}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
};
