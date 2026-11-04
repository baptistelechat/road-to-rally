"use client";

import { requestRestart, setHudScreen, useHudStore } from "@/game/hudStore";
import { label, panel } from "../hudStyles";
import { formatSignedLap } from "../formatTime";
import { Countdown } from "./Countdown";
import { SplitDelta } from "./SplitDelta";
import { StageResult } from "./StageResult";
import { StageStrip } from "./StageStrip";

/** Toujours monté : sinon la zone annoncée se tait, et un démontage en pause relancerait le GO. */
export const StageCountdown = () => {
  const countdown = useHudStore((s) => s.countdown);
  return <Countdown seconds={countdown} />;
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

export const StageResultScreen = () => {
  const screen = useHudStore((s) => s.screen);
  const result = useHudStore((s) => s.result);
  if (screen !== "result" || !result) return null;
  return (
    <StageResult
      {...result}
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

/** « Hors piste +00:05.000 », sous l'écart d'intermédiaire. La zone reste montée pour être annoncée. */
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
          className={`${panel} flex items-baseline gap-3 px-5 py-2`}
        >
          <span className={label}>{penalty.reason}</span>
          <span className="font-mono text-xl font-bold text-red-500 tabular-nums">
            {formatSignedLap(penalty.ms)}
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
