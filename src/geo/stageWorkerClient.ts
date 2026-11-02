// Côté fil principal du Worker de génération. Ce module ne charge pas le pipeline : seul le Worker le fait.
import type { StageData } from "../sim/types";
import type { ChicaneRequest } from "./chicanes";
import { StageError, type StageErrorCode } from "./errors";
import type { StageInputs, StageStep } from "./pipeline";

export type StageWorkerRequest =
  | { kind: "generate"; gpx: string; name: string; chicanes?: ChicaneRequest[] }
  /** Sans réseau, depuis des entrées déjà relevées : compare le Worker à Node (`/probe`). */
  | { kind: "rebuild"; inputs: StageInputs; name: string };

export type StageWorkerResponse =
  | { kind: "progress"; step: StageStep }
  | { kind: "done"; stage: StageData; warnings: string[] }
  | { kind: "error"; code: StageErrorCode; message: string };

export interface GeneratedStage {
  stage: StageData;
  /** À montrer au joueur : la génération a continué en mode dégradé */
  warnings: string[];
}

interface RunOptions {
  signal?: AbortSignal;
  onProgress?: (step: StageStep) => void;
}

/** Une génération, un Worker. Annuler le termine aussitôt, ce qui coupe aussi ses requêtes réseau. */
export const runStageWorker = (
  request: StageWorkerRequest,
  { signal, onProgress }: RunOptions = {},
): Promise<GeneratedStage> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./stageWorker.ts", import.meta.url));
    const close = (): void => {
      worker.terminate();
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = (): void => {
      close();
      reject(new StageError("aborted", "Génération annulée."));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort);

    worker.onmessage = ({ data }: MessageEvent<StageWorkerResponse>) => {
      if (data.kind === "progress") {
        onProgress?.(data.step);
        return;
      }
      close();
      if (data.kind === "done")
        resolve({ stage: data.stage, warnings: data.warnings });
      else reject(new StageError(data.code, data.message));
    };
    worker.onerror = (event) => {
      console.error(event.message);
      close();
      reject(
        new StageError(
          "service",
          "Le générateur de spéciales n'a pas pu démarrer. Vérifie ta connexion puis réessaie.",
        ),
      );
    };
    worker.postMessage(request);
  });
