"use client";

import { useEffect, useState } from "react";
import { StageError, type StageErrorCode } from "@/geo/errors";
import type { StageStep } from "@/geo/pipeline";
import { runStageWorker } from "@/geo/stageWorkerClient";
import type { StageData } from "@/sim/types";
import { readCachedStage, stageCacheKey, writeCachedStage } from "./stageCache";

/** Une spéciale prête à rouler, sortie du Worker ou du cache. */
export interface ImportedStage {
  stage: StageData;
  /** À montrer au joueur : la génération a continué en mode dégradé */
  warnings: string[];
}

export type ImportStatus =
  | { kind: "idle" }
  | { kind: "running"; step: StageStep; fileName: string }
  | { kind: "failed"; code: StageErrorCode; message: string };

const loadStage = async (
  file: File,
  signal: AbortSignal,
  onProgress: (step: StageStep) => void,
): Promise<ImportedStage> => {
  const startedAt = performance.now();
  const gpx = await file.text();
  const key = stageCacheKey(gpx);
  const cached = await readCachedStage(key);
  if (cached) {
    console.info(
      `Spéciale rouverte depuis le cache en ${Math.round(performance.now() - startedAt)} ms`,
    );
    return { stage: cached, warnings: [] };
  }
  const generated = await runStageWorker(
    { kind: "generate", gpx, name: file.name.replace(/\.gpx$/i, "") },
    { signal, onProgress },
  );
  console.info(
    `Spéciale générée en ${Math.round(performance.now() - startedAt)} ms`,
  );
  // Une spéciale dégradée ne se fige pas : à la prochaine ouverture, Overpass aura peut-être répondu.
  if (generated.warnings.length === 0)
    void writeCachedStage(key, generated.stage);
  return generated;
};

/** Un objet neuf à chaque essai, même fichier compris : c'est lui qui relance l'effet. */
interface ImportRequest {
  file: File;
}

export const useStageImport = (onReady: (stage: ImportedStage) => void) => {
  const [request, setRequest] = useState<ImportRequest | null>(null);
  const [status, setStatus] = useState<ImportStatus>({ kind: "idle" });

  // Le nettoyage termine le Worker : annulation, nouvel essai, fermeture du panneau et Strict Mode.
  useEffect(() => {
    if (!request) return;
    const { file } = request;
    const controller = new AbortController();
    const { signal } = controller;
    void loadStage(file, signal, (step) =>
      setStatus({ kind: "running", step, fileName: file.name }),
    )
      .then((stage) => {
        if (!signal.aborted) onReady(stage);
      })
      .catch((error: unknown) => {
        if (signal.aborted) return;
        if (!(error instanceof StageError)) console.error(error);
        setStatus(
          error instanceof StageError
            ? { kind: "failed", code: error.code, message: error.message }
            : {
                kind: "failed",
                code: "service",
                message: "Le fichier n'a pas pu être lu.",
              },
        );
      });
    return () => controller.abort();
  }, [request, onReady]);

  const choose = (file: File): void => {
    setRequest({ file });
    setStatus({ kind: "running", step: "lecture", fileName: file.name });
  };

  return {
    status,
    choose,
    retry: (): void => {
      if (request) choose(request.file);
    },
    cancel: (): void => {
      setRequest(null);
      setStatus({ kind: "idle" });
    },
  };
};
