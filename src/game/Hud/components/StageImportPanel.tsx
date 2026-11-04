"use client";

import { useId } from "react";
import { useStageImport, type ImportedStage } from "@/game/useStageImport";
import { hudButton, label, panel } from "../hudStyles";
import { StageProgress } from "./StageProgress";

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
          Fichier GPX (spéciale en France, de 0,5 à 15 km)
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

      <StageProgress status={status} />

      <div className="flex justify-end gap-2">
        {running ? (
          <button type="button" className={hudButton} onClick={cancel}>
            Annuler
          </button>
        ) : (
          <>
            {status.kind === "failed" && (
              <button type="button" className={hudButton} onClick={retry}>
                Réessayer
              </button>
            )}
            <button type="button" className={hudButton} onClick={onClose}>
              Fermer
            </button>
          </>
        )}
      </div>
    </dialog>
  );
};
