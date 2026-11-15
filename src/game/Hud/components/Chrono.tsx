"use client";

import type { ReactNode } from "react";
import type { HudStyle } from "@/game/copilotOptions";
import { requestRestart, useHudStore } from "@/game/hudStore";
import { InputPrompt } from "@/input/InputPrompt";
import { formatLap } from "../formatTime";
import { hudBlock, hudFacetButton, label } from "../hudStyles";

const LapRow = ({ name, value }: { name: string; value: string }) => (
  <div className="flex items-baseline gap-3">
    <dt className="text-muted-foreground">{name}</dt>
    <dd className="font-mono text-foreground tabular-nums">{value}</dd>
  </div>
);

/** `closed` : boucle au tour, sinon spéciale d'un départ à une arrivée. */
const LapRows = ({
  closed,
  className,
}: {
  closed: boolean;
  className: string;
}) => {
  const lastLapMs = useHudStore((s) => s.lastLapMs);
  const bestLapMs = useHudStore((s) => s.bestLapMs);
  return (
    <dl aria-live="polite" className={className}>
      {closed && <LapRow name="Dernier" value={formatLap(lastLapMs)} />}
      <LapRow name="Meilleur" value={formatLap(bestLapMs)} />
    </dl>
  );
};

interface ChronoProps {
  closed: boolean;
  /** Cockpit : dans le tableau de bord. Broadcast : bandeau télé en haut à gauche. */
  hudStyle: HudStyle;
  /** Broadcast : posé à gauche du temps, à sa hauteur (h-11.5) ; les lignes Dernier et Meilleur s'alignent sur son bord. */
  lead?: ReactNode;
}

export const Chrono = ({ closed, hudStyle, lead }: ChronoProps) => {
  const lapMs = useHudStore((s) => s.lapMs);
  // Le chrono en cours change sans cesse : il reste hors de la zone annoncée.
  if (hudStyle === "cockpit")
    return (
      <section aria-label="Chronomètre">
        <div className={label}>{closed ? "Tour" : "Temps"}</div>
        <div className="font-mono text-[2.5rem] leading-tight tabular-nums">
          {formatLap(lapMs)}
        </div>
        <LapRows closed={closed} className="flex gap-4 text-xs" />
      </section>
    );
  return (
    <section
      aria-label="Chronomètre"
      className="flex flex-col items-start gap-1"
    >
      <div className="flex gap-1">
        {lead}
        <div
          className={`${hudBlock} flex h-11.5 items-center border-l-4 border-foreground px-4 font-mono text-[2.125rem] leading-none tabular-nums`}
        >
          {formatLap(lapMs)}
        </div>
      </div>
      <LapRows
        closed={closed}
        className="flex gap-4 bg-background/75 px-4 py-1.25 text-[0.8125rem]"
      />
    </section>
  );
};

/** Touche de relance rappelée sur le bouton, selon la manette ou le clavier */
export const RestartButton = ({ closed }: { closed: boolean }) => (
  <button
    type="button"
    className={`${hudFacetButton} pointer-events-auto inline-flex items-center gap-2`}
    onClick={(event) => {
      requestRestart();
      // Sans ça, Espace (frein à main) relancerait le tour en cliquant à nouveau.
      event.currentTarget.blur();
    }}
  >
    {closed ? "Relancer le tour" : "Relancer"}
    <InputPrompt action="restart" size="sm" />
  </button>
);
