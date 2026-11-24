// Analyse un tracé hors du fil principal : le lissage d'un axe de 15 km ne doit pas figer la carte.
import { computeAutoChicanes } from "../editor/autoChicanes";
import { analyzeTrace } from "./analyzeTrace";
import type {
  AnalyzeWorkerRequest,
  AnalyzeWorkerResponse,
} from "./analyzeWorkerClient";
import { IGN_NO_DATA } from "./config";
import { StageError } from "./errors";
import { unproject } from "./gpx";
import { fetchAltitudes } from "./ign";
import { fetchIgnWays } from "./ignRoads";
import { deduceRoadAttributes } from "./osm";
import { buildPreviewProfile, previewSampleIndices } from "./previewProfile";

/** `lib.dom` et `lib.webworker` ne cohabitent pas : seul le nécessaire est décrit. */
interface WorkerScope {
  onmessage: ((event: MessageEvent<AnalyzeWorkerRequest>) => void) | null;
  postMessage: (message: AnalyzeWorkerResponse) => void;
}

const scope = globalThis as unknown as WorkerScope;

const buildResponse = async (
  request: AnalyzeWorkerRequest,
): Promise<AnalyzeWorkerResponse> => {
  if (request.kind === "analyze") {
    const analysis = analyzeTrace(request.gpx, request.options);
    return {
      kind: "done",
      analysis,
      chicanes: analysis.axis
        ? computeAutoChicanes(analysis.axis, request.options.widthsByHighway)
        : null,
    };
  }

  const { trace } = request;
  const { points: axis, origin, runoffPoints } = trace;
  const indices = previewSampleIndices(axis.length);
  // Ponts et tunnels lus comme le pipeline (B-13) : sans la BD TOPO, le profil plongeait sous chaque pont.
  // Une panne de la Géoplateforme n'empêche pas le profil : il suit alors le relief, comme avant.
  const [altitudes, ways] = await Promise.all([
    fetchAltitudes(
      indices.map((i) => unproject(axis[i], origin)),
      {},
    ),
    fetchIgnWays(trace, {}).catch(() => null),
  ]);
  const attributes = ways ? deduceRoadAttributes(trace, ways) : null;
  try {
    return {
      kind: "profile",
      profile: buildPreviewProfile(
        altitudes,
        axis.length,
        runoffPoints,
        attributes?.structures,
        attributes?.bridgeTags.map((tags) => tags !== null),
        attributes?.tunnelTags.map((tags) => tags !== null),
      ),
    };
  } catch (error) {
    if (error instanceof StageError && error.code === "outOfFrance")
      return {
        kind: "outOfFrance",
        message: error.message,
        pointIndex: indices[altitudes.indexOf(IGN_NO_DATA)],
      };
    throw error;
  }
};

scope.onmessage = ({ data }) => {
  void buildResponse(data)
    .catch((error: unknown): AnalyzeWorkerResponse => {
      if (error instanceof StageError)
        return { kind: "error", message: error.message };
      console.error(error);
      return {
        kind: "error",
        message:
          "L'analyse du tracé a échoué de façon inattendue. Déplace un point pour réessayer.",
      };
    })
    .then((response) => scope.postMessage(response));
};
