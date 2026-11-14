import { createMeshHeight } from "../sim/track/meshHeight";
import { ribbon } from "../sim/track/ribbon";
import {
  FORK_MARGIN,
  findRoadContact,
  isForkPair,
  roadForkReach,
} from "../sim/track/roadContact";
import type {
  MedianBarrier,
  MeshData,
  RoundaboutIsland,
  SharedRange,
  StageData,
  Vec3,
} from "../sim/types";
import {
  chicaneExclusions,
  resolveChicanes,
  type ChicaneRemoval,
  type ChicaneRequest,
} from "./chicanes";
import {
  CHICANE_BARRIER_HEIGHT,
  CHICANE_SKIRT,
  DUAL_OFFSET,
  PIPELINE_VERSION,
  ROUND_TRIP_MAX_FORK_GAP,
  RUNOFF_MAX_SLOPE,
  STEP,
} from "./config";
import { StageError, formatKm } from "./errors";
import {
  roundMm,
  traceFromGpx,
  uniqueAxis,
  unproject,
  type TracePoints,
} from "./gpx";
import { throwIfAborted, type HttpOptions } from "./http";
import { assertCovered, fetchAltitudes } from "./ign";
import {
  deduceRoadAttributes,
  dualMask,
  fetchOsmWays,
  type OsmWay,
} from "./osm";
import { buildProfile, closeRoundTripProfile, symmetrizeFork } from "./profile";
import { findRoundabouts } from "./roundabouts";
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
  /** Altitudes IGN brutes, une par point de l'axe. Aller-retour : une par point du bras et de la boucle, le retour n'en demande pas. */
  altitudes: number[];
  /** Voies OSM, `null` si Overpass était indisponible */
  ways: OsmWay[] | null;
  /** Altitudes IGN brutes des nœuds de `corridorNodes`, dans leur ordre. `null` : spéciale sans terrain. */
  terrain: number[] | null;
  /** Chicanes demandées. Absent ou vide : la spéciale reste identique à celle d'un tracé sans chicane. */
  chicanes?: ChicaneRequest[];
  generatedAt: string;
}

export interface FetchStageOptions extends HttpOptions {
  onProgress?: (step: StageStep) => void;
  /** Voies tirées de BRouter par l'éditeur, `toOsmWays(segments)` : seulement si Overpass ne répond pas */
  fallbackWays?: OsmWay[];
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
    corridorNodes(uniqueAxis(trace)).map((p) => unproject(p, trace.origin)),
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
    uniqueAxis(trace).map((p) => unproject(p, trace.origin)),
    options,
  );
  assertCovered(altitudes, trace.runoffPoints);

  onProgress?.("routes");
  const osmWays = await fetchOsmWays(trace, options);
  // Moins riche qu'Overpass (ni `lanes`, ni `width`, ni ponts), mais bien mieux que rien : largeurs par type de route et ronds-points.
  const fallback = options.fallbackWays?.length ? options.fallbackWays : null;
  const ways = osmWays ?? fallback;
  const warnings =
    osmWays !== null
      ? []
      : fallback
        ? [
            "Les données OSM sont indisponibles : largeurs et ronds-points viennent de BRouter, mais les ponts et les tunnels manquent, ils suivent le relief.",
          ]
        : [
            "Les données de routes sont indisponibles : la route garde une largeur de 5 m partout, et les ponts suivent le relief.",
          ];

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
const gentleRunoff = (
  altitudes: number[],
  run: number,
  tailRun: number,
): number[] => {
  const result = [...altitudes];
  const limit = RUNOFF_MAX_SLOPE * STEP;
  const follow = (i: number, previous: number): void => {
    result[i] = Math.max(
      result[previous] - limit,
      Math.min(result[previous] + limit, altitudes[i]),
    );
  };
  for (let i = run - 1; i >= 0; i--) follow(i, i + 1);
  for (let i = result.length - tailRun; i < result.length; i++)
    follow(i, i - 1);
  return result;
};

/** Plus grand écart de hauteur entre le passage aller et le passage retour de la fourche, tous les 50 cm. */
const forkRibbonGap = (
  points: Vec3[],
  widths: number[],
  { armEnd, returnStart }: SharedRange,
  reach: number,
): number => {
  const road = ribbon(points, widths, false);
  const span = (from: number, to: number): MeshData => ({
    positions: road.positions,
    indices: road.indices.slice(from * 6, to * 6),
  });
  const around = reach + FORK_MARGIN;
  const go = createMeshHeight([span(armEnd, armEnd + around)]);
  const back = createMeshHeight([span(returnStart - around, returnStart)]);
  const zone = points.slice(armEnd, armEnd + around);
  zone.push(...points.slice(returnStart - around, returnStart + 1));
  const halfWidth = Math.max(...widths) / 2;
  const minX = Math.min(...zone.map((p) => p.x)) - halfWidth;
  const maxX = Math.max(...zone.map((p) => p.x)) + halfWidth;
  const minZ = Math.min(...zone.map((p) => p.z)) - halfWidth;
  const maxZ = Math.max(...zone.map((p) => p.z)) + halfWidth;
  let gap = 0;
  for (let x = minX; x < maxX; x += 0.5)
    for (let z = minZ; z < maxZ; z += 0.5) {
      const a = go(x, z);
      const b = back(x, z);
      if (a !== null && b !== null) gap = Math.max(gap, Math.abs(a - b));
    }
  return gap;
};

export interface BuiltStage {
  stage: StageData;
  /** Chicanes retirées, à montrer au joueur */
  warnings: string[];
  /** Les mêmes, avec leur endroit */
  removals: ChicaneRemoval[];
}

/** Pure : mêmes entrées, même spéciale et mêmes avertissements au bit près. */
export const buildStageWithWarnings = (
  inputs: StageInputs,
  name: string,
): BuiltStage => {
  const trace = traceFromGpx(inputs.gpx);
  const hash = axisHash(trace);
  const shared = trace.roundTrip && {
    armEnd: trace.roundTrip.armEnd,
    returnStart: trace.roundTrip.returnStart,
  };
  const uniqueCount = uniqueAxis(trace).length;
  // Pas une `StageError` : le joueur n'y est jamais confronté, seul un cache périmé y mène.
  if (hash !== inputs.axisHash || inputs.altitudes.length !== uniqueCount)
    throw new Error(
      `Les altitudes en cache ne correspondent plus à l'axe (${inputs.axisHash} contre ${hash}) : relancer avec --refresh.`,
    );
  assertCovered(inputs.altitudes, trace.runoffPoints);

  const attributes = deduceRoadAttributes(trace, inputs.ways);
  const structures = attributes.structures.slice(0, uniqueCount);
  let widths = attributes.widths.slice(0, uniqueCount);
  const lanes = attributes.lanes.slice(0, uniqueCount);
  let profile = buildProfile(
    trace.realRunoff
      ? inputs.altitudes
      : gentleRunoff(
          inputs.altitudes,
          trace.runoffPoints,
          shared ? 0 : trace.runoffPoints,
        ),
    structures,
  );
  let reach = 0;
  if (shared) {
    const { armEnd, returnStart } = shared;
    reach = roadForkReach(trace.points, widths, armEnd, returnStart);
    widths = symmetrizeFork(widths, armEnd, returnStart, reach, 0).map(roundMm);
    profile = closeRoundTripProfile(profile, armEnd, returnStart, reach);
  }
  const baseAltitude = roundMm(Math.min(...profile));
  const unique: Vec3[] = uniqueAxis(trace).map((p, i) => ({
    x: p.x,
    y: Math.max(0, roundMm(profile[i] - baseAltitude)),
    z: p.z,
  }));

  if (shared) {
    const gap = forkRibbonGap(unique, widths, shared, reach);
    if (gap > ROUND_TRIP_MAX_FORK_GAP)
      throw new StageError(
        "roadContact",
        `À la jonction du ${formatKm((shared.armEnd - trace.runoffPoints) * STEP)}, l'aller et le retour passent à ${Math.round(gap * 100)} cm l'un de l'autre en hauteur, ${Math.round(ROUND_TRIP_MAX_FORK_GAP * 100)} au plus : la route y est trop pentue pour se refermer.`,
      );
  }
  const contact = findRoadContact(
    unique,
    widths,
    shared &&
      ((i, j) => isForkPair(i, j, shared.armEnd, shared.returnStart, reach)),
  );
  if (contact)
    throw new StageError(
      "roadContact",
      `Deux portions de route se touchent : le ${formatKm(contact.sA - trace.runoffPoints * STEP)} rejoint le ${formatKm(contact.sB - trace.runoffPoints * STEP)}.`,
    );

  const nodes = inputs.terrain && corridorNodes(uniqueAxis(trace));
  if (inputs.terrain && inputs.terrain.length !== nodes?.length)
    throw new Error(
      "Les altitudes du couloir en cache ne correspondent plus à la grille : relancer avec --refresh.",
    );

  // Le retour recopie l'aller, valeur pour valeur : mêmes points, même largeur.
  const points = shared
    ? [...unique, ...unique.slice(0, shared.armEnd).reverse()]
    : unique;
  const allLanes = shared
    ? [...lanes, ...lanes.slice(0, shared.armEnd).reverse()]
    : lanes;
  const allWidths = shared
    ? [...widths, ...widths.slice(0, shared.armEnd).reverse()]
    : widths;

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

  // Sur l'axe unique : une chicane d'aller-retour n'existe qu'une fois, et le retour la franchit en sens inverse.
  const { blocks, warnings, removals } = resolveChicanes(
    inputs.chicanes ?? [],
    unique,
    widths,
    trace.origin,
    {
      startS,
      finishS,
      // ponytail: ponts et tunnels ignorés, le jeu n'en dessine aucun pour l'instant ; passer `structures` ici le jour où il y en aura.
      // Pas de chicane sur une chaussée de terre-plein : la glissière occupe déjà l'autre côté.
      excluded: chicaneExclusions(
        unique,
        widths,
        shared || undefined,
        dualMask(unique, trace.dual),
      ),
    },
  );

  // Posé au niveau moyen de l'anneau, enterré jusqu'à son point le plus bas : rien ne flotte sur un rond-point en pente.
  const islands = findRoundabouts(
    unique,
    widths,
    inputs.ways,
    trace.origin,
  ).map(({ x, z, radius }): RoundaboutIsland => {
    const ring = unique.filter(
      (p) => Math.hypot(p.x - x, p.z - z) <= radius + Math.max(...widths) + 5,
    );
    const y = ring.reduce((sum, p) => sum + p.y, 0) / ring.length;
    const low = Math.min(...ring.map((p) => p.y));
    const high = Math.max(...ring.map((p) => p.y));
    // Le collider est un cylindre droit : il couvre toute la pente, du point le plus bas au plus haut de l'anneau.
    return {
      position: { x, y: roundMm(y), z },
      radius,
      height: roundMm(CHICANE_BARRIER_HEIGHT + high - y),
      skirt: roundMm(CHICANE_SKIRT + y - low),
    };
  });

  // Au niveau moyen des deux chaussées qui l'encadrent, enterrée sous la plus basse : ni en l'air ni noyée.
  const medians = (trace.dual ?? [])
    .filter(({ barrier }) => barrier.length > 1)
    .map(({ barrier }): MedianBarrier => {
      let skirt = CHICANE_SKIRT;
      const footing = barrier.map((p) => {
        const near = unique.filter(
          (q) => Math.hypot(q.x - p.x, q.z - p.z) <= DUAL_OFFSET + 1,
        );
        const ys = near.length > 0 ? near.map((q) => q.y) : [0];
        const y = ys.reduce((sum, value) => sum + value, 0) / ys.length;
        skirt = Math.max(skirt, CHICANE_SKIRT + y - Math.min(...ys));
        return { x: p.x, y: roundMm(y), z: p.z };
      });
      return {
        points: footing,
        height: CHICANE_BARRIER_HEIGHT,
        skirt: roundMm(skirt),
      };
    });

  return {
    stage: {
      name,
      origin: trace.origin,
      baseAltitude,
      points,
      widths: allWidths,
      lanes: allLanes,
      startS: roundMm(startS),
      finishS: roundMm(finishS),
      ...(shared && { shared }),
      ...(blocks.length > 0 && { obstacles: blocks }),
      ...(islands.length > 0 && { islands }),
      ...(medians.length > 0 && { medians }),
      terrain:
        inputs.terrain && nodes
          ? buildTerrain(
              unique,
              widths,
              nodes,
              inputs.terrain,
              baseAltitude,
              trace.runoffPoints,
              shared?.armEnd,
            )
          : null,
      pipelineVersion: PIPELINE_VERSION,
      generatedAt: inputs.generatedAt,
      hash: "",
    },
    warnings,
    removals,
  };
};

/** La spéciale seule, pour un tracé sans chicane demandée. Une chicane retirée n'y est signalée nulle part : voir `buildStageWithWarnings`. */
export const buildStage = (inputs: StageInputs, name: string): StageData =>
  buildStageWithWarnings(inputs, name).stage;
