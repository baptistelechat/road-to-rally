"use client";

import { useCallback, useEffect, useState } from "react";
import {
  sortChicaneRequests,
  type ChicaneRemoval,
  type ChicaneRequest,
} from "@/geo/chicanes";
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
  /** Les chicanes retirées parmi eux, avec leur endroit */
  removals?: ChicaneRemoval[];
}

/** Avec le GPX qui l'a produite : l'éditeur la range sous cette clé avant de quitter la page. */
export interface LoadedStage extends ImportedStage {
  gpx: string;
  chicanes?: ChicaneRequest[];
}

export type ImportStatus =
  | { kind: "idle" }
  | { kind: "running"; step: StageStep; fileName: string }
  | { kind: "failed"; code: StageErrorCode; message: string };

/** Un fichier ou le texte d'un tracé de l'éditeur : le texte n'est lu qu'au lancement. */
export interface StageSource {
  name: string;
  read: () => Promise<string>;
  chicanes?: ChicaneRequest[];
}

export const loadStage = async (
  source: StageSource,
  signal: AbortSignal,
  onProgress: (step: StageStep) => void,
): Promise<LoadedStage> => {
  const startedAt = performance.now();
  const gpx = await source.read();
  const chicanes = sortChicaneRequests(source.chicanes ?? []);
  const key = stageCacheKey(gpx, chicanes);
  const requested = chicanes.length > 0 ? { chicanes } : {};
  const cached = await readCachedStage(key);
  if (cached) {
    console.info(
      `Spéciale rouverte depuis le cache en ${Math.round(performance.now() - startedAt)} ms`,
    );
    // Le nom vient de la demande : renommer une spéciale de l'éditeur ne change ni son GPX ni son empreinte.
    return {
      stage: { ...cached, name: source.name },
      warnings: [],
      gpx,
      ...requested,
    };
  }
  const generated = await runStageWorker(
    { kind: "generate", gpx, name: source.name, ...requested },
    { signal, onProgress },
  );
  console.info(
    `Spéciale générée en ${Math.round(performance.now() - startedAt)} ms`,
  );
  // Une spéciale dégradée ne se fige pas : à la prochaine ouverture, Overpass aura peut-être répondu.
  // ponytail: une chicane retirée compte aussi, pour que l'avertissement revienne : régénérée à chaque ouverture, le temps de corriger le tracé.
  if (generated.warnings.length === 0)
    void writeCachedStage(key, generated.stage);
  return { ...generated, gpx, ...requested };
};

/** Un objet neuf à chaque essai, même fichier compris : c'est lui qui relance l'effet. */
interface ImportRequest {
  source: StageSource;
}

export const useStageImport = (onReady: (stage: LoadedStage) => void) => {
  const [request, setRequest] = useState<ImportRequest | null>(null);
  const [status, setStatus] = useState<ImportStatus>({ kind: "idle" });

  // Le nettoyage termine le Worker : annulation, nouvel essai, fermeture du panneau et Strict Mode.
  useEffect(() => {
    if (!request) return;
    const { source } = request;
    const controller = new AbortController();
    const { signal } = controller;
    void loadStage(source, signal, (step) =>
      setStatus({ kind: "running", step, fileName: source.name }),
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

  const start = (source: StageSource): void => {
    setRequest({ source });
    setStatus({ kind: "running", step: "lecture", fileName: source.name });
  };

  return {
    status,
    choose: (file: File): void =>
      start({
        name: file.name.replace(/\.gpx$/i, ""),
        read: () => file.text(),
      }),
    chooseText: (
      gpx: string,
      name: string,
      chicanes?: ChicaneRequest[],
    ): void => start({ name, read: () => Promise.resolve(gpx), chicanes }),
    retry: (): void => {
      if (request) start(request.source);
    },
    cancel: useCallback((): void => {
      setRequest(null);
      setStatus({ kind: "idle" });
    }, []),
  };
};
