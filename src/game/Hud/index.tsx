"use client";

import type { CSSProperties } from "react";
import type { Copilot } from "@/game/copilot";
import { useHudStore } from "@/game/hudStore";
import type { ImportedStage } from "@/game/useStageImport";
import { RESPAWN_HOLD_S, type RecoveryStatus } from "@/sim/recovery";
import type { Simulation } from "@/sim/simulation";
import type { CarSource } from "@/render/carSource";
import { BroadcastHud } from "./components/Broadcast/BroadcastHud";
import { CockpitHud } from "./components/Cockpit/CockpitHud";
import { GameMenu } from "./components/GameMenu";
import { MiniMap } from "./components/MiniMap";
import { PaceNotes } from "./components/PaceNotes";
import {
  PenaltyToast,
  StageCountdown,
  StageProgressStrip,
  StageResultScreen,
  StageSplit,
} from "./components/RaceOverlays";
import { hudBlock } from "./hudStyles";

const SoundStatus = () => {
  const muted = useHudStore((s) => s.muted);
  return (
    <div aria-live="polite" className="min-h-9">
      {muted && (
        <div className={`${hudBlock} px-3 py-1.5 text-sm font-medium`}>
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
        <div className={`${hudBlock} px-4 py-2 text-sm font-semibold`}>
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

const stripes = (color: string): CSSProperties => ({
  background: `repeating-linear-gradient(135deg, ${color} 0 10px, var(--background) 10px 20px)`,
});

/** Panneau rond rouge barré de blanc */
const NoEntrySign = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className="size-12 shrink-0">
    <circle
      cx={24}
      cy={24}
      r={22}
      strokeWidth={3}
      style={{ fill: "var(--destructive)", stroke: "var(--foreground)" }}
    />
    <rect
      x={10}
      y={20}
      width={28}
      height={8}
      style={{ fill: "var(--foreground)" }}
    />
  </svg>
);

/** Bandeau hachuré : rouge hors piste et à contresens, jaune pendant la remise en piste maintenue. */
const RecoveryCountdown = () => {
  const recovery = useHudStore((s) => s.recovery);
  if (!recovery) return null;
  const { kind, remaining } = recovery;
  const { title, hint } = RECOVERY_TEXT[kind];
  const hold = kind === "hold";
  const progress = Math.min(1, Math.max(0, 1 - remaining / RESPAWN_HOLD_S));
  return (
    <div
      role="status"
      className={`${hudBlock} absolute top-1/4 left-1/2 flex w-75 -translate-x-1/2 [clip-path:polygon(6%_0,100%_0,94%_100%,0_100%)]`}
    >
      <span
        aria-hidden="true"
        className="w-9 shrink-0"
        style={stripes(hold ? "var(--brand)" : "var(--destructive)")}
      />
      <span
        className={`flex flex-1 items-center justify-center gap-3.5 py-3.5 pr-6 pl-4 ${kind === "wrongway" ? "" : "text-center"}`}
      >
        {kind === "wrongway" && <NoEntrySign />}
        <span className="block">
          <span
            className={`block font-display text-[0.6875rem] tracking-[0.18em] uppercase ${hold ? "text-brand" : "text-destructive"}`}
          >
            {title}
          </span>
          <span className="block font-mono text-[3.5rem] leading-[1.05] tabular-nums">
            {remaining.toFixed(1)}
          </span>
          {hold && (
            <span
              aria-hidden="true"
              className="mt-1 mb-1.5 block h-1 bg-foreground/15"
            >
              <span
                className="block h-full bg-brand"
                style={{ width: `${progress * 100}%` }}
              />
            </span>
          )}
          <span className="block text-[0.8125rem] text-muted-foreground">
            {hint}
          </span>
        </span>
      </span>
    </div>
  );
};

interface HudProps {
  sim: Simulation;
  /** Fantôme, pour la mini-carte. `null` tant que la scène ne l'a pas transmis. */
  ghost: Pick<CarSource, "getPose"> | null;
  copilot: Copilot;
  /** Identifiant de la carte en cours */
  map: string;
  mapLabel: string;
  /** Tracé en boucle, sinon spéciale d'un départ à une arrivée */
  closed: boolean;
  /** Avertissements de la spéciale en cours */
  notices: readonly string[];
  onImported: (stage: ImportedStage) => void;
  onToggleMute: () => void;
}

/** HUD en DOM, à placer par-dessus le canvas. Seuls les boutons et le sélecteur captent les clics. */
export const Hud = ({
  sim,
  ghost,
  copilot,
  map,
  mapLabel,
  closed,
  notices,
  onImported,
  onToggleMute,
}: HudProps) => {
  const hudStyle = useHudStore((s) => s.copilotOptions.hudStyle);
  const screen = useHudStore((s) => s.screen);
  // Menu de départ : rien du HUD de course, la vue reste dégagée. Pause et arrivée le gardent.
  const racing = screen !== "start";
  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {racing &&
        (hudStyle === "cockpit" ? (
          <CockpitHud closed={closed} notices={notices} />
        ) : (
          <BroadcastHud closed={closed} notices={notices} />
        ))}
      {racing && (
        <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
          <MiniMap
            sim={sim}
            ghost={ghost}
            title={mapLabel}
            hudStyle={hudStyle}
          />
          <SoundStatus />
        </div>
      )}
      <DiagToast />
      {racing && <PaceNotes />}
      {racing && <StageProgressStrip />}
      <StageSplit />
      <PenaltyToast />
      <RecoveryCountdown />
      <StageCountdown />
      <StageResultScreen mapLabel={mapLabel} />
      <GameMenu
        map={map}
        mapLabel={mapLabel}
        closed={closed}
        copilot={copilot}
        onImported={onImported}
        onToggleMute={onToggleMute}
      />
    </div>
  );
};
