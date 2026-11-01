import { findRoadContact } from "../sim/track/roadContact";
import type { StageData, Vec3 } from "../sim/types";
import { PIPELINE_VERSION, RUNOFF_MAX_SLOPE, STEP } from "./config";
import { StageError, formatKm } from "./errors";
import { roundMm, traceFromGpx, unproject, type TracePoints } from "./gpx";
import { throwIfAborted, type HttpOptions } from "./http";
import { assertCovered, fetchAltitudes } from "./ign";
import { deduceRoadAttributes, fetchOsmWays, type OsmWay } from "./osm";
import { buildProfile } from "./profile";
import { buildTerrain, corridorNodes } from "./terrain";

export { PIPELINE_VERSION };
export { StageError } from "./errors";

export type StageStep =
  | "lecture"
  | "relief"
  | "routes"
  | "terrain"
  | "finalisation";

/** Tout ce que le réseau apporte : `buildStage` en tire la spéciale sans plus jamais l'appeler. */
export interface StageInputs {
  gpx: string;
  /** Empreinte de l'axe pour lequel les altitudes ont été demandées */
  axisHash: string;
  /** Altitudes IGN brutes, une par point de l'axe */
  altitudes: number[];
  /** Voies OSM, `null` si Overpass était indisponible */
  ways: OsmWay[] | null;
  /** Altitudes IGN brutes des nœuds de `corridorNodes`, dans leur ordre. `null` : spéciale sans terrain. */
  terrain: number[] | null;
  generatedAt: string;
}

export interface FetchStageOptions extends HttpOptions {
  onProgress?: (step: StageStep) => void;
}

export interface FetchStageResult {
  inputs: StageInputs;
  /** À montrer au joueur : la génération a continué en mode dégradé */
  warnings: string[];
}

/** FNV-1a sur 32 bits : détecte un axe modifié, pas une attaque. */
export const axisHash = (trace: TracePoints): string => {
  let hash = 0x811c9dc5;
  const text = trace.points.map((p) => `${p.x},${p.z}`).join(";");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

/** Altitudes du couloir de cet axe, requêtes une à une. */
export const fetchCorridorAltitudes = (
  trace: TracePoints,
  options: HttpOptions,
): Promise<number[]> =>
  fetchAltitudes(
    corridorNodes(trace.points).map((p) => unproject(p, trace.origin)),
    options,
  );

export const fetchStageInputs = async (
  gpxText: string,
  options: FetchStageOptions = {},
): Promise<FetchStageResult> => {
  const { onProgress, signal } = options;
  throwIfAborted(signal);
  onProgress?.("lecture");
  const trace = traceFromGpx(gpxText);

  onProgress?.("relief");
  const altitudes = await fetchAltitudes(
    trace.points.map((p) => unproject(p, trace.origin)),
    options,
  );
  assertCovered(altitudes, trace.runoffPoints);

  onProgress?.("routes");
  const ways = await fetchOsmWays(trace, options);
  const warnings =
    ways === null
      ? [
          "Les données de routes sont indisponibles : la route garde une largeur de 5 m partout, et les ponts suivent le relief.",
        ]
      : [];

  onProgress?.("terrain");
  const terrain = await fetchCorridorAltitudes(trace, options);
  throwIfAborted(signal);
  onProgress?.("finalisation");
  return {
    inputs: {
      gpx: gpxText,
      axisHash: axisHash(trace),
      altitudes,
      ways,
      terrain,
      generatedAt: new Date().toISOString(),
    },
    warnings,
  };
};

/**
 * Un prolongement inventé suit le relief sans dépasser `RUNOFF_MAX_SLOPE` : ni tremplin après l'arrivée,
 * et une colline voisine ne vient pas déformer la vraie route.
 */
const gentleRunoff = (altitudes: number[], run: number): number[] => {
  const result = [...altitudes];
  const limit = RUNOFF_MAX_SLOPE * STEP;
  const follow = (i: number, previous: number): void => {
    result[i] = Math.max(
      result[previous] - limit,
      Math.min(result[previous] + limit, altitudes[i]),
    );
  };
  for (let i = run - 1; i >= 0; i--) follow(i, i + 1);
  for (let i = result.length - run; i < result.length; i++) follow(i, i - 1);
  return result;
};

/** Pure : mêmes entrées, même spéciale au bit près. */
export const buildStage = (inputs: StageInputs, name: string): StageData => {
  const trace = traceFromGpx(inputs.gpx);
  const hash = axisHash(trace);
  // Pas une `StageError` : le joueur n'y est jamais confronté, seul un cache périmé y mène.
  if (
    hash !== inputs.axisHash ||
    inputs.altitudes.length !== trace.points.length
  )
    throw new Error(
      `Les altitudes en cache ne correspondent plus à l'axe (${inputs.axisHash} contre ${hash}) : relancer avec --refresh.`,
    );
  assertCovered(inputs.altitudes, trace.runoffPoints);

  const { widths, structures } = deduceRoadAttributes(trace, inputs.ways);
  const profile = buildProfile(
    trace.realRunoff
      ? inputs.altitudes
      : gentleRunoff(inputs.altitudes, trace.runoffPoints),
    structures,
  );
  const baseAltitude = roundMm(Math.min(...profile));
  const points: Vec3[] = trace.points.map((p, i) => ({
    x: p.x,
    y: Math.max(0, roundMm(profile[i] - baseAltitude)),
    z: p.z,
  }));

  const contact = findRoadContact(points, widths);
  if (contact)
    throw new StageError(
      "roadContact",
      `Deux portions de route se touchent : le ${formatKm(contact.sA - trace.runoffPoints * STEP)} rejoint le ${formatKm(contact.sB - trace.runoffPoints * STEP)}.`,
    );

  const nodes = inputs.terrain && corridorNodes(trace.points);
  if (inputs.terrain && inputs.terrain.length !== nodes?.length)
    throw new Error(
      "Les altitudes du couloir en cache ne correspondent plus à la grille : relancer avec --refresh.",
    );

  // `createTrack` mesure ses abscisses en 3D : les lignes doivent tomber au même endroit.
  let s = 0;
  let startS = 0;
  let finishS = 0;
  for (let i = 1; i < points.length; i++) {
    s += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
      points[i].z - points[i - 1].z,
    );
    if (i === trace.runoffPoints) startS = s;
    if (i === points.length - 1 - trace.runoffPoints) finishS = s;
  }

  return {
    name,
    origin: trace.origin,
    baseAltitude,
    points,
    widths,
    startS: roundMm(startS),
    finishS: roundMm(finishS),
    terrain:
      inputs.terrain && nodes
        ? buildTerrain(
            points,
            widths,
            nodes,
            inputs.terrain,
            baseAltitude,
            trace.runoffPoints,
          )
        : null,
    pipelineVersion: PIPELINE_VERSION,
    generatedAt: inputs.generatedAt,
    hash: "",
  };
};
