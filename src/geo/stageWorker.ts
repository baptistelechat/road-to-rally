// Génère une spéciale hors du fil principal. Ni `Track` ni Rapier ici : seules les données traversent.
import type { MeshData } from "../sim/types";
import { StageError } from "./errors";
import { buildStage, fetchStageInputs } from "./pipeline";
import { stageHash } from "./stageHash";
import type {
  StageWorkerRequest,
  StageWorkerResponse,
} from "./stageWorkerClient";

/** `lib.dom` et `lib.webworker` ne cohabitent pas : seul le nécessaire est décrit. */
interface WorkerScope {
  onmessage: ((event: MessageEvent<StageWorkerRequest>) => void) | null;
  postMessage: (
    message: StageWorkerResponse,
    transfer?: Transferable[],
  ) => void;
}

const scope = globalThis as unknown as WorkerScope;

const meshBuffers = (mesh: MeshData | null): Transferable[] =>
  mesh
    ? [mesh.positions, mesh.indices, ...(mesh.colors ? [mesh.colors] : [])].map(
        (values) => values.buffer as ArrayBuffer,
      )
    : [];

const generate = async (request: StageWorkerRequest): Promise<void> => {
  const { inputs, warnings } =
    request.kind === "generate"
      ? await fetchStageInputs(request.gpx, {
          onProgress: (step) => scope.postMessage({ kind: "progress", step }),
        })
      : { inputs: request.inputs, warnings: [] };
  const stage = buildStage(inputs, request.name);
  stage.hash = stageHash(stage);
  scope.postMessage(
    { kind: "done", stage, warnings },
    meshBuffers(stage.terrain),
  );
};

scope.onmessage = ({ data }) => {
  void generate(data).catch((error: unknown) => {
    if (!(error instanceof StageError)) console.error(error);
    scope.postMessage(
      error instanceof StageError
        ? { kind: "error", code: error.code, message: error.message }
        : {
            kind: "error",
            code: "service",
            message:
              "La génération a échoué de façon inattendue. Réessaie, ou essaie un autre tracé.",
          },
    );
  });
};
