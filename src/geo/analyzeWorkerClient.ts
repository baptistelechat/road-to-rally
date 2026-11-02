// Côté fil principal du Worker d'analyse. Ce module ne charge ni `analyzeTrace` ni le filtre du profil : seul le Worker le fait.
import type { AutoChicanes } from "../editor/types";
import type { AnalyzeOptions, TraceAnalysis } from "./analyzeTrace";
import { StageError } from "./errors";
import type { LatLon, PlanePoint } from "./gpx";
import type { PreviewProfile } from "./previewProfile";

export type AnalyzeWorkerRequest =
  | { kind: "analyze"; gpx: string; options: AnalyzeOptions }
  | {
      kind: "profile";
      axis: PlanePoint[];
      origin: LatLon;
      runoffPoints: number;
    };

/** L'axe sort de la zone couverte par l'IGN : un refus du tracé, pas une panne. */
export interface OutOfFrance {
  kind: "outOfFrance";
  message: string;
  /** Point de l'axe sans altitude */
  pointIndex: number;
}

export type AnalyzeWorkerResponse =
  | { kind: "done"; analysis: TraceAnalysis; chicanes: AutoChicanes | null }
  | { kind: "profile"; profile: PreviewProfile }
  | OutOfFrance
  | { kind: "error"; message: string };

/** Une tâche, un Worker. Annuler le termine aussitôt : un tracé plus récent remplace le calcul en cours. */
const runWorker = (
  request: AnalyzeWorkerRequest,
  signal?: AbortSignal,
): Promise<Exclude<AnalyzeWorkerResponse, { kind: "error" }>> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./analyzeWorker.ts", import.meta.url));
    const close = (): void => {
      worker.terminate();
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = (): void => {
      close();
      reject(new StageError("aborted", "Analyse annulée."));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort);

    worker.onmessage = ({ data }: MessageEvent<AnalyzeWorkerResponse>) => {
      close();
      if (data.kind === "error")
        reject(new StageError("service", data.message));
      else resolve(data);
    };
    worker.onerror = (event) => {
      console.error(event.message);
      close();
      reject(
        new StageError(
          "service",
          "L'analyse du tracé n'a pas pu démarrer. Déplace un point pour réessayer.",
        ),
      );
    };
    worker.postMessage(request);
  });

export const runAnalyzeWorker = async (
  gpx: string,
  options: AnalyzeOptions = {},
  signal?: AbortSignal,
): Promise<{ analysis: TraceAnalysis; chicanes: AutoChicanes | null }> => {
  const response = await runWorker({ kind: "analyze", gpx, options }, signal);
  if (response.kind !== "done")
    throw new StageError("service", "L'analyse du tracé a échoué.");
  return response;
};

/** Les altitudes de l'IGN et le filtre de `buildProfile`, 2 s sur 15 km : hors du fil principal. */
export const runProfileWorker = async (
  axis: PlanePoint[],
  origin: LatLon,
  runoffPoints: number,
  signal?: AbortSignal,
): Promise<PreviewProfile | OutOfFrance> => {
  const response = await runWorker(
    { kind: "profile", axis, origin, runoffPoints },
    signal,
  );
  if (response.kind === "profile") return response.profile;
  if (response.kind === "outOfFrance") return response;
  throw new StageError("service", "Le profil d'altitude a échoué.");
};
