"use client";

import { useId } from "react";
import type { StageErrorCode } from "@/geo/errors";
import type { StageStep } from "@/geo/pipeline";
import { useStageImport, type ImportedStage } from "@/game/useStageImport";
import { label, panel } from "../hudStyles";

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

const button =
  "rounded border border-white/25 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-amber-400";

interface StageImportPanelProps {
  onClose: () => void;
  onReady: (stage: ImportedStage) => void;
}

/** Le fermer annule la génération en cours : le Worker vit le temps du panneau. */
export const StageImportPanel = ({
  onClose,
  onReady,
}: StageImportPanelProps) => {
  const id = useId();
  const { status, choose, retry, cancel } = useStageImport(onReady);
  const running = status.kind === "running";
  const stepIndex = running
    ? STEPS.findIndex((step) => step.id === status.step)
    : -1;

  return (
    <dialog
      open
      aria-labelledby={`${id}-title`}
      className={`${panel} pointer-events-auto absolute top-1/4 left-1/2 m-0 w-96 max-w-[calc(100%-2rem)] -translate-x-1/2 space-y-3 p-4 select-text`}
    >
      <h2 id={`${id}-title`} className="text-base font-semibold">
        Importer un GPX
      </h2>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-file`} className={label}>
          Fichier GPX (spéciale en France, de 2 à 15 km)
        </label>
        <input
          id={`${id}-file`}
          type="file"
          accept=".gpx,application/gpx+xml"
          autoFocus
          disabled={running}
          className="text-xs file:mr-3 file:rounded file:border file:border-white/25 file:bg-transparent file:px-2 file:py-1 file:font-semibold file:text-white disabled:opacity-50"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            // Vidé tout de suite : rechoisir le même fichier doit relancer un chargement.
            event.currentTarget.value = "";
            if (file) choose(file);
          }}
        />
      </div>

      <div aria-live="polite" className="min-h-10 space-y-1 text-sm">
        {status.kind === "running" && (
          <>
            <p>
              Étape {stepIndex + 1} sur {STEPS.length} :{" "}
              {STEPS[stepIndex].label}
            </p>
            <progress
              aria-label={`Génération de ${status.fileName}`}
              max={STEPS.length}
              value={stepIndex + 1}
              className="h-2 w-full accent-amber-400"
            />
          </>
        )}
        {status.kind === "failed" && (
          <div role="alert">
            <p className="font-semibold text-amber-400">
              {ERROR_TITLES[status.code]}
            </p>
            <p className="text-white/80">{status.message}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {running ? (
          <button type="button" className={button} onClick={cancel}>
            Annuler
          </button>
        ) : (
          <>
            {status.kind === "failed" && (
              <button type="button" className={button} onClick={retry}>
                Réessayer
              </button>
            )}
            <button type="button" className={button} onClick={onClose}>
              Fermer
            </button>
          </>
        )}
      </div>
    </dialog>
  );
};
