"use client";

import type { HudStyle } from "@/game/copilotOptions";
import { requestRestart, useHudStore } from "@/game/hudStore";
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
}

export const Chrono = ({ closed, hudStyle }: ChronoProps) => {
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
      <div
        className={`${hudBlock} border-l-4 border-foreground px-4 py-1.5 font-mono text-[2.125rem] leading-none tabular-nums`}
      >
        {formatLap(lapMs)}
      </div>
      <LapRows
        closed={closed}
        className="flex gap-4 bg-background/75 px-4 py-1.25 text-[0.8125rem]"
      />
    </section>
  );
};

/** Touche de relance rappelée sur le bouton, selon la manette ou le clavier */
export const RestartButton = ({ closed }: { closed: boolean }) => {
  const device = useHudStore((s) => s.device);
  return (
    <button
      type="button"
      className={`${hudFacetButton} pointer-events-auto`}
      onClick={(event) => {
        requestRestart();
        // Sans ça, Espace (frein à main) relancerait le tour en cliquant à nouveau.
        event.currentTarget.blur();
      }}
    >
      {closed ? "Relancer le tour" : "Relancer"}
      <span aria-hidden="true" className="font-mono">
        {" · "}
        {device === "gamepad" ? "Select" : "⌫"}
      </span>
    </button>
  );
};
