"use client";

import { RESPAWN_HOLD_S, type RecoveryStatus } from "@/sim/recovery";
import { requestRestart, useHudStore } from "./hudStore";

export const formatLap = (ms: number | null): string => {
  if (ms === null) return "--:--.---";
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor(total / 1000) % 60;
  const millis = total % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
};

export const formatGear = (gear: number): string => {
  if (gear < 0) return "R";
  if (gear === 0) return "N";
  return String(gear);
};

const panel = "rounded-md border border-white/15 bg-black/65 text-white";
const label =
  "text-[0.65rem] font-semibold tracking-[0.18em] text-white/60 uppercase";

const LapRow = ({ name, value }: { name: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-6">
    <dt className={label}>{name}</dt>
    <dd className="font-mono text-base tabular-nums">{value}</dd>
  </div>
);

const Chrono = () => {
  const lapMs = useHudStore((s) => s.lapMs);
  const lastLapMs = useHudStore((s) => s.lastLapMs);
  const bestLapMs = useHudStore((s) => s.bestLapMs);
  return (
    <section aria-label="Chronomètre" className={`${panel} px-4 py-3`}>
      <div className={label}>Tour</div>
      {/* Le chrono en cours change sans cesse : il reste hors de la zone annoncée. */}
      <div className="font-mono text-3xl leading-tight font-semibold tabular-nums">
        {formatLap(lapMs)}
      </div>
      <dl
        aria-live="polite"
        className="mt-2 space-y-0.5 border-t border-white/15 pt-2"
      >
        <LapRow name="Dernier" value={formatLap(lastLapMs)} />
        <LapRow name="Meilleur" value={formatLap(bestLapMs)} />
      </dl>
      <button
        type="button"
        className="pointer-events-auto mt-2 w-full rounded border border-white/25 px-2 py-1 text-xs font-semibold transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-amber-400"
        onClick={(event) => {
          requestRestart();
          // Sans ça, Espace (frein à main) relancerait le tour en cliquant à nouveau.
          event.currentTarget.blur();
        }}
      >
        Relancer le tour
      </button>
    </section>
  );
};

const Speedometer = () => {
  const speedKmh = useHudStore((s) => s.speedKmh);
  const gear = useHudStore((s) => s.gear);
  return (
    <section
      aria-label="Compteur"
      className={`${panel} flex items-stretch gap-4 px-4 py-3`}
    >
      <div className="flex w-14 flex-col items-center justify-center border-r border-white/15 pr-4">
        <span className={label}>Rapport</span>
        <span className="font-mono text-4xl font-bold text-amber-400 tabular-nums">
          {formatGear(gear)}
        </span>
      </div>
      <div className="flex flex-col items-end justify-center">
        <span className="font-mono text-6xl leading-none font-bold tabular-nums">
          {speedKmh}
        </span>
        <span className={`${label} mt-1`}>km/h</span>
      </div>
    </section>
  );
};

const SoundStatus = () => {
  const muted = useHudStore((s) => s.muted);
  return (
    <div aria-live="polite" className="min-h-9">
      {muted && (
        <div className={`${panel} px-3 py-1.5 text-sm font-medium`}>
          Son coupé
        </div>
      )}
    </div>
  );
};

const DiagToast = () => {
  const diag = useHudStore((s) => s.diag);
  return (
    <div
      aria-live="polite"
      className="absolute top-4 left-1/2 -translate-x-1/2"
    >
      {diag && (
        <div className={`${panel} px-4 py-2 text-sm font-semibold text-amber-400`}>
          {diag}
        </div>
      )}
    </div>
  );
};

const RECOVERY_TEXT: Record<
  RecoveryStatus["kind"],
  { title: string; hint: string }
> = {
  hold: { title: "Remise en piste", hint: "Relâche pour annuler" },
  offroad: { title: "Hors piste", hint: "Reviens sur la route" },
  wrongway: { title: "Sens interdit", hint: "Fais demi-tour" },
};

const RecoveryCountdown = () => {
  const recovery = useHudStore((s) => s.recovery);
  if (!recovery) return null;
  const { title, hint } = RECOVERY_TEXT[recovery.kind];
  return (
    <div
      role="status"
      className={`${panel} absolute top-1/4 left-1/2 w-72 -translate-x-1/2 px-5 py-4 text-center`}
    >
      <div className={label}>
        {title}
      </div>
      <div className="font-mono text-5xl font-bold text-amber-400 tabular-nums">
        {recovery.remaining.toFixed(1)}
      </div>
      <div className="mt-1 text-xs text-white/70">
        {hint}
      </div>
    </div>
  );
};

const KEYBOARD_HELP: readonly (readonly [string, string])[] = [
  ["Flèches / ZQSD", "Conduire"],
  ["Espace", "Frein à main"],
  ["R maintenu", `Remise en piste (${RESPAWN_HOLD_S} s)`],
  ["Retour arrière", "Relancer le tour"],
  ["C", "Vue"],
  ["M", "Son"],
  ["F9", "Signaler un lag"],
];

const GAMEPAD_HELP: readonly (readonly [string, string])[] = [
  ["Stick gauche", "Diriger"],
  ["RT / LT", "Gaz / Frein, marche arrière"],
  ["A", "Frein à main"],
  ["Y maintenu", `Remise en piste (${RESPAWN_HOLD_S} s)`],
  ["Select", "Relancer le tour"],
  ["X", "Vue"],
  ["LB", "Signaler un lag"],
];

const ControlsHelp = () => {
  const device = useHudStore((s) => s.device);
  const help = device === "gamepad" ? GAMEPAD_HELP : KEYBOARD_HELP;
  return (
    <dl
      aria-label="Commandes"
      className={`${panel} hidden grid-cols-[auto_auto] gap-x-3 gap-y-0.5 px-3 py-2 text-xs sm:grid`}
    >
      {help.map(([key, action]) => (
        <div key={key} className="contents">
          <dt className="font-mono font-semibold text-white">{key}</dt>
          <dd className="text-white/70">{action}</dd>
        </div>
      ))}
    </dl>
  );
};

/** HUD en DOM, à placer par-dessus le canvas. Seul le bouton capte les clics. */
export const Hud = () => (
  <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 select-none">
    <div className="flex items-start justify-between gap-4">
      <Chrono />
      <SoundStatus />
    </div>
    <DiagToast />
    <RecoveryCountdown />
    <div className="flex items-end justify-between gap-4">
      <ControlsHelp />
      <div className="ml-auto">
        <Speedometer />
      </div>
    </div>
  </div>
);
