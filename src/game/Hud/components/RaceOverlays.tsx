"use client";

import { requestRestart, setHudScreen, useHudStore } from "@/game/hudStore";
import { formatSignedLap } from "../formatTime";
import { Countdown } from "./Countdown";
import { SplitDelta } from "./SplitDelta";
import { StageResult } from "./StageResult";
import { StageStrip } from "./StageStrip";

/** Toujours monté : sinon la zone annoncée se tait, et un démontage en pause relancerait le GO. Masqué derrière le menu de départ. */
export const StageCountdown = () => {
  const countdown = useHudStore((s) => s.countdown);
  const screen = useHudStore((s) => s.screen);
  return (
    <div hidden={screen === "start"}>
      <Countdown seconds={countdown} />
    </div>
  );
};

export const StageSplit = () => {
  const split = useHudStore((s) => s.split);
  return (
    <SplitDelta
      index={split?.index ?? null}
      timeMs={split?.ms ?? 0}
      deltaMs={split?.deltaMs ?? null}
    />
  );
};

export const StageResultScreen = ({ mapLabel }: { mapLabel: string }) => {
  const screen = useHudStore((s) => s.screen);
  const result = useHudStore((s) => s.result);
  if (screen !== "result" || !result) return null;
  return (
    <StageResult
      {...result}
      mapLabel={mapLabel}
      onRestart={() => {
        requestRestart();
        setHudScreen("race");
      }}
      onMenu={() => {
        requestRestart();
        setHudScreen("start");
      }}
    />
  );
};

/** « +00:05.000 Hors piste », sous l'écart d'intermédiaire. La zone reste montée pour être annoncée. */
export const PenaltyToast = () => {
  const penalty = useHudStore((s) => s.penalty);
  return (
    <div
      aria-live="polite"
      className="absolute top-64 left-1/2 -translate-x-1/2"
    >
      {penalty && (
        <div
          key={penalty.id}
          className="flex h-11 items-stretch bg-background/90 [clip-path:polygon(4%_0,100%_0,96%_100%,0_100%)]"
        >
          <span className="flex items-center bg-destructive pr-4 pl-[22px] font-mono text-[22px] text-background tabular-nums">
            {formatSignedLap(penalty.ms)}
          </span>
          <span className="flex items-center pr-[26px] pl-3.5 font-display text-[11px] tracking-[0.14em] uppercase">
            {penalty.reason}
          </span>
        </div>
      )}
    </div>
  );
};

/** Frise de la spéciale, absente du circuit */
export const StageProgressStrip = () => {
  const strip = useHudStore((s) => s.strip);
  return strip ? <StageStrip {...strip} /> : null;
};
