"use client";

import type { Copilot } from "@/game/copilot";
import { useHudStore } from "@/game/hudStore";
import type { ImportedStage } from "@/game/useStageImport";
import type { RecoveryStatus } from "@/sim/recovery";
import type { Simulation } from "@/sim/simulation";
import { Chrono, FinishBanner } from "./components/Chrono";
import { ControlsHelp } from "./components/ControlsHelp";
import { GameMenu } from "./components/GameMenu";
import { MiniMap } from "./components/MiniMap";
import { PaceNotes } from "./components/PaceNotes";
import { Speedometer } from "./components/Speedometer";
import { StageNotices } from "./components/StageNotices";
import { label, panel } from "./hudStyles";

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
        <div
          className={`${panel} px-4 py-2 text-sm font-semibold text-brand`}
        >
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
      <div className={label}>{title}</div>
      <div className="font-mono text-5xl font-bold text-brand tabular-nums">
        {recovery.remaining.toFixed(1)}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
};

interface HudProps {
  sim: Simulation;
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
  copilot,
  map,
  mapLabel,
  closed,
  notices,
  onImported,
  onToggleMute,
}: HudProps) => (
  <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 select-none">
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Chrono closed={closed} />
        <StageNotices notices={notices} />
      </div>
      <SoundStatus />
    </div>
    <DiagToast />
    <PaceNotes />
    <MiniMap sim={sim} />
    <FinishBanner />
    <RecoveryCountdown />
    <GameMenu
      map={map}
      mapLabel={mapLabel}
      closed={closed}
      copilot={copilot}
      onImported={onImported}
      onToggleMute={onToggleMute}
    />
    <div className="flex items-end justify-between gap-4">
      <ControlsHelp closed={closed} />
      <div className="ml-auto">
        <Speedometer />
      </div>
    </div>
  </div>
);
