"use client";

import type { ResultSector } from "@/game/hudStore";
import { formatLap } from "../formatTime";
import { brandStartButton, facetButton, grayButton } from "./Menu/menuStyles";
import { StageResultTable } from "./StageResultTable";

interface StageResultProps {
  /** Nom de la carte, à droite du titre */
  mapLabel: string;
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

/** Coin bas droit coupé, la facette de la DA « Nuit facettée » */
const facetPanel = "[clip-path:polygon(0_0,100%_0,100%_94%,94%_100%,0_100%)]";
/**
 * Facette sur le bouton lui-même, comme au menu de départ : les traits de focus (ombres intérieures) suivent le
 * parallélogramme au lieu de déborder en rectangle.
 */
const actionButton = "grid min-h-14 flex-1 place-items-center px-6 text-sm";

/**
 * Écran de résultat d'une spéciale. Un `dialog` ouvert comme le menu : `applyMenuAction` y trouve les boutons,
 * haut et bas déplacent le focus, A clique. Le focus part sur « Recommencer ».
 */
export const StageResult = ({
  mapLabel,
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
      className="pointer-events-auto absolute inset-0 z-20 m-0 grid size-full max-h-none max-w-none place-items-center border-0 bg-background/50 p-0 text-inherit opacity-100 transition-opacity duration-200 starting:opacity-0"
    >
      <div
        className={`w-[min(35rem,calc(100vw-2rem))] bg-background text-foreground ${facetPanel}`}
      >
        <header className="flex items-center justify-between gap-4 border-b-[3px] border-brand bg-card px-8 pt-5 pb-4">
          <h1
            id="result-title"
            className="font-display text-xl tracking-[0.06em] uppercase"
          >
            Arrivée
          </h1>
          <span className="font-display text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase">
            {mapLabel}
          </span>
        </header>
        <div className="flex flex-col gap-5 px-8 pt-6 pb-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-6xl leading-none text-brand tabular-nums">
              {formatLap(totalMs)}
            </span>
            {isBest && (
              <span className="bg-chart-4 px-3.5 py-2 font-display text-[0.65rem] tracking-[0.14em] text-background uppercase [clip-path:polygon(8%_0,100%_0,92%_100%,0_100%)]">
                Meilleur temps
              </span>
            )}
          </div>
          <StageResultTable
            sectors={sectors}
            totalMs={totalMs}
            deltaMs={deltaMs}
            penaltyMs={penaltyMs}
          />
          <div className="flex gap-2.5">
            <button
              type="button"
              autoFocus
              className={`${actionButton} font-display tracking-[0.06em] uppercase ${brandStartButton}`}
              onClick={onRestart}
            >
              Recommencer
            </button>
            <button
              type="button"
              className={`${actionButton} ${grayButton} ${facetButton}`}
              onClick={onMenu}
            >
              Retour au menu
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
};
