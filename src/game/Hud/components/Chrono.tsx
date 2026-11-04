"use client";

import { requestRestart, useHudStore } from "@/game/hudStore";
import { formatLap } from "../formatTime";
import { hudButton, label, panel } from "../hudStyles";

const LapRow = ({ name, value }: { name: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-6">
    <dt className={label}>{name}</dt>
    <dd className="font-mono text-base tabular-nums">{value}</dd>
  </div>
);

/** `closed` : boucle au tour, sinon spéciale d'un départ à une arrivée. */
export const Chrono = ({ closed }: { closed: boolean }) => {
  const lapMs = useHudStore((s) => s.lapMs);
  const lastLapMs = useHudStore((s) => s.lastLapMs);
  const bestLapMs = useHudStore((s) => s.bestLapMs);
  return (
    <section aria-label="Chronomètre" className={`${panel} px-4 py-3`}>
      <div className={label}>{closed ? "Tour" : "Temps"}</div>
      {/* Le chrono en cours change sans cesse : il reste hors de la zone annoncée. */}
      <div className="font-mono text-3xl leading-tight font-semibold tabular-nums">
        {formatLap(lapMs)}
      </div>
      <dl
        aria-live="polite"
        className="mt-2 space-y-0.5 border-t border-white/15 pt-2"
      >
        {closed && <LapRow name="Dernier" value={formatLap(lastLapMs)} />}
        <LapRow name="Meilleur" value={formatLap(bestLapMs)} />
      </dl>
      <button
        type="button"
        className={`${hudButton} pointer-events-auto mt-2 w-full`}
        onClick={(event) => {
          requestRestart();
          // Sans ça, Espace (frein à main) relancerait le tour en cliquant à nouveau.
          event.currentTarget.blur();
        }}
      >
        {closed ? "Relancer le tour" : "Relancer"}
      </button>
    </section>
  );
};

