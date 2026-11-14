"use client";

import type { ResultSector } from "@/game/hudStore";
import { menuFocus } from "../hudStyles";
import { formatLap } from "../formatTime";
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
 * La facette d'un bouton vit sur son `span` intérieur : un `clip-path` sur le bouton couperait aussi les traits
 * de focus, seul repère de la sélection à la manette.
 */
const actionButton = `flex min-h-14 ${menuFocus}`;
const actionFace = "grid w-full place-items-center px-6 text-sm";

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
              className={`${actionButton} flex-1`}
              onClick={onRestart}
            >
              <span
                className={`${actionFace} bg-brand font-display tracking-[0.06em] text-brand-foreground uppercase transition-colors hover:bg-brand/90 [clip-path:polygon(5%_0,100%_0,95%_100%,0_100%)]`}
              >
                Recommencer
              </span>
            </button>
            <button type="button" className={actionButton} onClick={onMenu}>
              <span
                className={`${actionFace} bg-accent font-bold text-accent-foreground transition-colors hover:bg-accent/80 [clip-path:polygon(10%_0,100%_0,90%_100%,0_100%)]`}
              >
                Retour au menu
              </span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
};
