"use client";

import { requestRestart, useHudStore } from "@/game/hudStore";
import { hudButton, label, panel } from "../hudStyles";

const formatLap = (ms: number | null): string => {
  if (ms === null) return "--:--.---";
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor(total / 1000) % 60;
  const millis = total % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
};

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
        className="mt-2 space-y-0.5 border-t border-foreground/15 pt-2"
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

/** Bandeau d'arrivée d'une spéciale, annoncé une fois : la zone reste montée, seul son contenu change. */
export const FinishBanner = () => {
  const finished = useHudStore((s) => s.finished);
  const lastLapMs = useHudStore((s) => s.lastLapMs);
  return (
    <div
      aria-live="polite"
      className="absolute top-16 left-1/2 -translate-x-1/2"
    >
      {finished && (
        <div className={`${panel} px-6 py-3 text-center`}>
          <div className={label}>Arrivée</div>
          <div className="font-mono text-4xl font-bold text-brand tabular-nums">
            {formatLap(lastLapMs)}
          </div>
        </div>
      )}
    </div>
  );
};
