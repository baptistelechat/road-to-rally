"use client";

import type { ResultSector } from "@/game/hudStore";
import { hudButton, menuFocus, panel } from "../hudStyles";
import { formatLap } from "../formatTime";
import { StageResultTable } from "./StageResultTable";

interface StageResultProps {
  sectors: readonly ResultSector[];
  /** Temps final, pénalités comprises, en ms */
  totalMs: number;
  penaltyMs: number;
  /** Écart au meilleur temps local d'avant cette course, `null` sans meilleur temps */
  deltaMs: number | null;
  /** Nouveau meilleur temps local */
  isBest: boolean;
  onRestart: () => void;
  onMenu: () => void;
}

/**
 * Écran de résultat d'une spéciale. Un `dialog` ouvert comme le menu : `applyMenuAction` y trouve les boutons,
 * haut et bas déplacent le focus, A clique. Le focus part sur « Recommencer ».
 */
export const StageResult = ({
  sectors,
  totalMs,
  penaltyMs,
  deltaMs,
  isBest,
  onRestart,
  onMenu,
}: StageResultProps) => {
  return (
    <dialog
      open
      aria-labelledby="result-title"
      className="pointer-events-auto absolute inset-0 z-20 m-0 grid size-full max-h-none max-w-none place-items-center border-0 bg-black/45 p-0 text-inherit opacity-100 transition-opacity duration-200 starting:opacity-0"
    >
      <div className={`${panel} w-96 space-y-4 p-6 text-center`}>
        <h1 id="result-title" className="text-2xl font-bold">
          Arrivée
        </h1>
        <div>
          <div className="font-mono text-4xl font-bold text-amber-400 tabular-nums">
            {formatLap(totalMs)}
          </div>
          {isBest && (
            <div className="mt-1 text-sm font-semibold text-emerald-400">
              Meilleur temps
            </div>
          )}
        </div>
        <StageResultTable
          sectors={sectors}
          totalMs={totalMs}
          deltaMs={deltaMs}
          penaltyMs={penaltyMs}
        />
        <button
          type="button"
          autoFocus
          className={`w-full rounded bg-amber-400 px-4 py-3 font-bold text-black hover:bg-amber-300 ${menuFocus}`}
          onClick={onRestart}
        >
          Recommencer
        </button>
        <button
          type="button"
          className={`${hudButton} ${menuFocus} w-full`}
          onClick={onMenu}
        >
          Retour au menu
        </button>
      </div>
    </dialog>
  );
};
