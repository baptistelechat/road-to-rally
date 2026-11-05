"use client";

import type { StageErrorCode } from "@/geo/errors";
import type { StageStep } from "@/geo/pipeline";
import type { ImportStatus } from "@/game/useStageImport";

const STEPS: readonly { id: StageStep; label: string }[] = [
  { id: "lecture", label: "Lecture du tracé" },
  { id: "relief", label: "Relief" },
  { id: "routes", label: "Routes" },
  { id: "terrain", label: "Terrain" },
  { id: "finalisation", label: "Finalisation" },
];

const ERROR_TITLES: Record<StageErrorCode, string> = {
  empty: "Tracé refusé",
  tooShort: "Tracé refusé",
  tooLong: "Tracé refusé",
  selfCrossing: "Tracé refusé",
  roadContact: "Tracé refusé",
  outOfFrance: "Hors de France",
  network: "Réseau coupé",
  service: "Service indisponible",
  aborted: "Génération annulée",
};

/** Progression et échec d'une génération, dans le panneau d'import comme dans l'éditeur. */
export const StageProgress = ({ status }: { status: ImportStatus }) => {
  const stepIndex =
    status.kind === "running"
      ? STEPS.findIndex((step) => step.id === status.step)
      : -1;
  return (
    <div
      aria-live="polite"
      className="min-h-10 space-y-1 text-sm"
    >
      {status.kind === "running" && (
        <>
          <p>
            Étape {stepIndex + 1} sur {STEPS.length} : {STEPS[stepIndex].label}
          </p>
          <progress
            aria-label={`Génération de ${status.fileName}`}
            max={STEPS.length}
            value={stepIndex + 1}
            className="h-2 w-full accent-brand"
          />
          {status.step === "routes" && (
            <p className="text-xs text-muted-foreground">
              Cette étape dure souvent près de 2 minutes : le service des routes
              OpenStreetMap est lent. Rien n&apos;a planté.
            </p>
          )}
        </>
      )}
      {status.kind === "failed" && (
        <div role="alert">
          <p className="font-semibold text-brand">
            {ERROR_TITLES[status.code]}
          </p>
          <p className="text-muted-foreground">{status.message}</p>
        </div>
      )}
    </div>
  );
};
