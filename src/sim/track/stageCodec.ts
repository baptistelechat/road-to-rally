import {
  DECOR_BUILDING_TYPES,
  DECOR_ROOF_KINDS,
  DECOR_ROOF_MATERIALS,
  DECOR_TREE_KINDS,
  DECOR_WALL_MATERIALS,
} from "../types";
import type {
  ChicaneBlock,
  DecorBuilding,
  DecorBuildingKind,
  DecorBuildingType,
  DecorTree,
  DecorWater,
  MedianBarrier,
  RoundaboutIsland,
  MeshData,
  SharedRange,
  StageBridge,
  StageData,
  StageDecor,
  Vec3,
} from "../types";

const fail = (field: string, why: string): never => {
  throw new Error(`Spéciale invalide : ${field} ${why}`);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finite = (value: unknown, field: string): number =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : fail(field, "doit être un nombre");

const text = (value: unknown, field: string): string =>
  typeof value === "string" ? value : fail(field, "doit être un texte");

const numbers = (value: unknown, field: string): number[] => {
  if (!Array.isArray(value)) return fail(field, "doit être un tableau");
  value.forEach((v, i) => finite(v, `${field}[${i}]`));
  return value as number[];
};

const parsePoint = (value: unknown, i: number): Vec3 => {
  const field = `points[${i}]`;
  if (!isObject(value)) return fail(field, "doit être un point { x, y, z }");
  const y = finite(value.y, `${field}.y`);
  if (y < 0) fail(`${field}.y`, "doit être positif ou nul");
  return {
    x: finite(value.x, `${field}.x`),
    y,
    z: finite(value.z, `${field}.z`),
  };
};

const parseTerrain = (value: unknown): MeshData | null => {
  if (value === null) return null;
  if (!isObject(value)) return fail("terrain", "doit être un maillage ou null");
  const positions = numbers(value.positions, "terrain.positions");
  const indices = numbers(value.indices, "terrain.indices");
  if (positions.length % 3 !== 0)
    fail("terrain.positions", "doit contenir des triplets");
  if (indices.length % 3 !== 0)
    fail("terrain.indices", "doit contenir des triplets");
  const count = positions.length / 3;
  for (const index of indices)
    if (!Number.isInteger(index) || index < 0 || index >= count)
      fail("terrain.indices", `contient un indice hors maillage : ${index}`);
  const mesh: MeshData = {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
  if (value.colors === undefined) return mesh;
  const colors = numbers(value.colors, "terrain.colors");
  if (colors.length !== positions.length)
    fail("terrain.colors", "doit avoir la taille de terrain.positions");
  mesh.colors = new Float32Array(colors);
  return mesh;
};

/** Une recopie annoncée doit être exacte : le ruban et les collisions n'existent qu'une fois, et le retour leur fait confiance. */
const parseShared = (
  value: unknown,
  points: Vec3[],
  widths: number[],
): SharedRange => {
  if (!isObject(value))
    return fail("shared", "doit être { armEnd, returnStart }");
  const armEnd = finite(value.armEnd, "shared.armEnd");
  const returnStart = finite(value.returnStart, "shared.returnStart");
  if (
    !Number.isInteger(armEnd) ||
    !Number.isInteger(returnStart) ||
    armEnd < 1 ||
    returnStart <= armEnd ||
    returnStart + armEnd !== points.length - 1
  )
    fail("shared", "ne correspond pas à l'axe");
  for (let k = 0; k <= armEnd; k++) {
    const a = points[armEnd - k];
    const b = points[returnStart + k];
    if (
      a.x !== b.x ||
      a.y !== b.y ||
      a.z !== b.z ||
      widths[armEnd - k] !== widths[returnStart + k]
    )
      fail(
        `points[${returnStart + k}]`,
        `ne recopie pas points[${armEnd - k}]`,
      );
  }
  return { armEnd, returnStart };
};

const parseObstacle = (value: unknown, i: number): ChicaneBlock => {
  const field = `obstacles[${i}]`;
  if (!isObject(value) || !isObject(value.position))
    return fail(field, "doit être un bloc de chicane");
  if (value.side !== "left" && value.side !== "right")
    return fail(`${field}.side`, "doit être left ou right");
  const positive = (key: string): number => {
    const size = finite(value[key], `${field}.${key}`);
    if (size <= 0) fail(`${field}.${key}`, "doit rester positif");
    return size;
  };
  return {
    s: finite(value.s, `${field}.s`),
    side: value.side,
    lateral: finite(value.lateral, `${field}.lateral`),
    span: positive("span"),
    passage: positive("passage"),
    depth: positive("depth"),
    height: positive("height"),
    skirt: positive("skirt"),
    position: {
      x: finite(value.position.x, `${field}.position.x`),
      y: finite(value.position.y, `${field}.position.y`),
      z: finite(value.position.z, `${field}.position.z`),
    },
    yaw: finite(value.yaw, `${field}.yaw`),
  };
};

/** L'ordre de création des colliders fait partie du déterminisme : une liste vide ou désordonnée est refusée. */
const parseObstacles = (value: unknown): ChicaneBlock[] => {
  if (!Array.isArray(value)) return fail("obstacles", "doit être un tableau");
  if (value.length === 0) fail("obstacles", "doit être absent sans chicane");
  const blocks = value.map(parseObstacle);
  blocks.forEach((block, i) => {
    if (i > 0 && block.s < blocks[i - 1].s)
      fail(`obstacles[${i}].s`, "doit suivre l'ordre des abscisses");
  });
  return blocks;
};

const parseLanes = (value: unknown, count: number): number[] => {
  const lanes = numbers(value, "lanes");
  if (lanes.length !== count)
    fail("lanes", "doit avoir un nombre de voies par point");
  if (lanes.some((n) => !Number.isInteger(n) || n < 1))
    fail("lanes", "doit être un entier positif");
  return lanes;
};

const parseIslands = (value: unknown): RoundaboutIsland[] => {
  if (!Array.isArray(value)) return fail("islands", "doit être un tableau");
  if (value.length === 0) fail("islands", "doit être absent sans rond-point");
  return value.map((island: unknown, i) => {
    const field = `islands[${i}]`;
    if (!isObject(island) || !isObject(island.position))
      return fail(field, "doit être un îlot de rond-point");
    const positive = (key: string): number => {
      const size = finite(island[key], `${field}.${key}`);
      if (size <= 0) fail(`${field}.${key}`, "doit rester positif");
      return size;
    };
    return {
      position: {
        x: finite(island.position.x, `${field}.position.x`),
        y: finite(island.position.y, `${field}.position.y`),
        z: finite(island.position.z, `${field}.position.z`),
      },
      radius: positive("radius"),
      height: positive("height"),
      skirt: positive("skirt"),
    };
  });
};

const parseMedians = (value: unknown): MedianBarrier[] => {
  if (!Array.isArray(value)) return fail("medians", "doit être un tableau");
  if (value.length === 0) fail("medians", "doit être absent sans terre-plein");
  return value.map((median: unknown, i) => {
    const field = `medians[${i}]`;
    if (!isObject(median) || !Array.isArray(median.points))
      return fail(field, "doit être une glissière");
    if (median.points.length < 2)
      fail(`${field}.points`, "doit contenir au moins 2 points");
    const positive = (key: string): number => {
      const size = finite(median[key], `${field}.${key}`);
      if (size <= 0) fail(`${field}.${key}`, "doit rester positif");
      return size;
    };
    return {
      points: median.points.map(parsePoint),
      height: positive("height"),
      skirt: positive("skirt"),
    };
  });
};

const BRIDGE_STYLES = ["stone", "concrete", "steel", "viaduct"] as const;

const parseBridges = (value: unknown, count: number): StageBridge[] => {
  if (!Array.isArray(value)) return fail("bridges", "doit être un tableau");
  if (value.length === 0) fail("bridges", "doit être absent sans pont");
  return value.map((bridge: unknown, i) => {
    const field = `bridges[${i}]`;
    if (!isObject(bridge)) return fail(field, "doit être un pont");
    const from = finite(bridge.from, `${field}.from`);
    const to = finite(bridge.to, `${field}.to`);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from || to >= count)
      fail(field, "doit aller d'un point de l'axe à un point suivant");
    const style = BRIDGE_STYLES.find((s) => s === bridge.style);
    if (!style) return fail(`${field}.style`, "doit être un style de pont connu");
    const halfWidth = finite(bridge.halfWidth, `${field}.halfWidth`);
    if (halfWidth <= 0) fail(`${field}.halfWidth`, "doit rester positif");
    return { from, to, style, halfWidth };
  });
};

type LegacyTypology = Omit<
  DecorBuilding,
  "footprint" | "base" | "height" | "kind" | "floors"
>;

const legacy = (
  type: DecorBuildingType,
  roof: DecorBuilding["roof"],
  roofMaterial: DecorBuilding["roofMaterial"],
  wallMaterial: DecorBuilding["wallMaterial"],
): LegacyTypology => ({
  type,
  roof,
  roofMaterial,
  wallMaterial,
  party: [],
  street: 0,
});

const BUILDING_KINDS: readonly DecorBuildingKind[] = [
  "house",
  "farm",
  "industrial",
  "church",
  "other",
];

/** Valeur d'une liste fermée, sinon une erreur qui donne les valeurs permises. */
const oneOf = <T extends string>(
  list: readonly T[],
  value: unknown,
  field: string,
): T => {
  const found = list.find((k) => k === value);
  return found === undefined
    ? fail(field, `doit être ${list.join(", ")}`)
    : found;
};

/** Typologie d'un bâtiment rangé avant la story 5.2 : le toit et la couleur qu'il avait déjà. */
const LEGACY_TYPOLOGY: Record<DecorBuildingKind, LegacyTypology> = {
  house: legacy("house", "gable", "tile", "render"),
  farm: legacy("barn", "gable", "metal", "wood"),
  industrial: legacy("workshop", "flat", "membrane", "metal"),
  church: legacy("church", "gable", "slate", "stone"),
  other: legacy("house", "flat", "membrane", "render"),
};

/** Contour plan : au moins 3 points { x, z } finis. */
const parseOutline = (
  value: unknown,
  field: string,
): { x: number; z: number }[] => {
  if (!Array.isArray(value)) return fail(field, "doit être un tableau");
  if (value.length < 3) fail(field, "doit contenir au moins 3 points");
  return value.map((point: unknown, i) => {
    if (!isObject(point)) return fail(`${field}[${i}]`, "doit être { x, z }");
    return {
      x: finite(point.x, `${field}[${i}].x`),
      z: finite(point.z, `${field}[${i}].z`),
    };
  });
};

const parseBuilding = (value: unknown, i: number): DecorBuilding => {
  const field = `decor.buildings[${i}]`;
  if (!isObject(value)) return fail(field, "doit être un bâtiment");
  const kind = BUILDING_KINDS.find((k) => k === value.kind);
  if (kind === undefined)
    return fail(`${field}.kind`, `doit être ${BUILDING_KINDS.join(", ")}`);
  const height = finite(value.height, `${field}.height`);
  if (height <= 0) fail(`${field}.height`, "doit rester positif");
  const footprint = parseOutline(value.footprint, `${field}.footprint`);
  const base = finite(value.base, `${field}.base`);
  // Spéciale d'avant la typologie (rouverte à la demande) : déduite de l'usage, comme l'ancien rendu.
  if (value.type === undefined)
    return {
      footprint,
      base,
      height,
      kind,
      floors: Math.max(1, Math.round(height / 3)),
      ...LEGACY_TYPOLOGY[kind],
    };
  const type = oneOf(DECOR_BUILDING_TYPES, value.type, `${field}.type`);
  const floors = finite(value.floors, `${field}.floors`);
  if (!Number.isInteger(floors) || floors < 1)
    fail(`${field}.floors`, "doit être un entier positif");
  const wallIndex = (v: unknown, name: string): number => {
    const k = finite(v, name);
    if (!Number.isInteger(k) || k < 0 || k >= footprint.length)
      fail(name, "doit désigner un mur de l'emprise");
    return k;
  };
  if (!Array.isArray(value.party))
    return fail(`${field}.party`, "doit être un tableau");
  const party = value.party.map((v: unknown, k) =>
    wallIndex(v, `${field}.party[${k}]`),
  );
  return {
    footprint,
    base,
    height,
    kind,
    type,
    floors,
    roof: oneOf(DECOR_ROOF_KINDS, value.roof, `${field}.roof`),
    roofMaterial: oneOf(
      DECOR_ROOF_MATERIALS,
      value.roofMaterial,
      `${field}.roofMaterial`,
    ),
    wallMaterial: oneOf(
      DECOR_WALL_MATERIALS,
      value.wallMaterial,
      `${field}.wallMaterial`,
    ),
    party,
    street: wallIndex(value.street, `${field}.street`),
  };
};

const parseTree = (value: unknown, i: number): DecorTree => {
  const field = `decor.trees[${i}]`;
  if (!isObject(value) || !isObject(value.position))
    return fail(field, "doit être un arbre");
  const kind = DECOR_TREE_KINDS.find((k) => k === value.kind);
  if (kind === undefined)
    return fail(`${field}.kind`, `doit être ${DECOR_TREE_KINDS.join(", ")}`);
  const scale = finite(value.scale, `${field}.scale`);
  if (scale <= 0) fail(`${field}.scale`, "doit rester positif");
  return {
    kind,
    position: {
      x: finite(value.position.x, `${field}.position.x`),
      y: finite(value.position.y, `${field}.position.y`),
      z: finite(value.position.z, `${field}.position.z`),
    },
    yaw: finite(value.yaw, `${field}.yaw`),
    scale,
  };
};

const parseWater = (value: unknown, i: number): DecorWater => {
  const field = `decor.water[${i}]`;
  if (!isObject(value)) return fail(field, "doit être une surface d'eau");
  const outline = parseOutline(value.outline, `${field}.outline`);
  const y = finite(value.y, `${field}.y`);
  // Absent sur une surface sans île : la clé n'est pas recréée, l'empreinte reste la même.
  if (value.holes === undefined) return { outline, y };
  if (!Array.isArray(value.holes))
    return fail(`${field}.holes`, "doit être un tableau");
  const holes = value.holes.map((hole: unknown, k) =>
    parseOutline(hole, `${field}.holes[${k}]`),
  );
  return { outline, holes, y };
};

/** Des listes vides sont permises : un tracé en pleine plaine n'a ni bâtiment ni eau. L'ordre est gardé tel quel, il fait le déterminisme. */
const parseDecor = (value: unknown): StageDecor => {
  if (!isObject(value))
    return fail("decor", "doit être { buildings, trees, water }");
  const decor = value;
  const list = (key: string): unknown[] =>
    Array.isArray(decor[key])
      ? (decor[key] as unknown[])
      : fail(`decor.${key}`, "doit être un tableau");
  return {
    buildings: list("buildings").map(parseBuilding),
    trees: list("trees").map(parseTree),
    water: list("water").map(parseWater),
  };
};

/** Valide une spéciale lue en JSON. Toute donnée inattendue, vieille version comprise, lève une erreur claire. */
export const parseStage = (json: unknown): StageData => {
  if (!isObject(json)) return fail("le fichier", "doit contenir un objet");
  if (!isObject(json.origin)) return fail("origin", "doit être { lat, lon }");
  if (!Array.isArray(json.points))
    return fail("points", "doit être un tableau");
  if (json.points.length < 2) fail("points", "doit contenir au moins 2 points");
  const points = json.points.map(parsePoint);

  const widths = numbers(json.widths, "widths");
  if (widths.length !== points.length)
    fail("widths", "doit avoir une largeur par point");
  if (widths.some((w) => w <= 0)) fail("widths", "doit rester positif");

  const startS = finite(json.startS, "startS");
  const finishS = finite(json.finishS, "finishS");
  if (startS < 0 || finishS <= startS)
    fail("finishS", "doit être après startS, lui-même positif");

  if (!("terrain" in json)) fail("terrain", "est absent");

  return {
    name: text(json.name, "name"),
    origin: {
      lat: finite(json.origin.lat, "origin.lat"),
      lon: finite(json.origin.lon, "origin.lon"),
    },
    baseAltitude: finite(json.baseAltitude, "baseAltitude"),
    points,
    widths,
    startS,
    finishS,
    ...(json.shared !== undefined && {
      shared: parseShared(json.shared, points, widths),
    }),
    ...(json.obstacles !== undefined && {
      obstacles: parseObstacles(json.obstacles),
    }),
    ...(json.lanes !== undefined && {
      lanes: parseLanes(json.lanes, points.length),
    }),
    ...(json.islands !== undefined && {
      islands: parseIslands(json.islands),
    }),
    ...(json.medians !== undefined && {
      medians: parseMedians(json.medians),
    }),
    terrain: parseTerrain(json.terrain),
    ...(json.bridges !== undefined && {
      bridges: parseBridges(json.bridges, points.length),
    }),
    // Absent : la spéciale reste celle d'avant l'epic 5, au bit près.
    ...(json.decor !== undefined && { decor: parseDecor(json.decor) }),
    pipelineVersion: finite(json.pipelineVersion, "pipelineVersion"),
    generatedAt: text(json.generatedAt, "generatedAt"),
    hash: text(json.hash, "hash"),
  };
};

/** Inverse de `parseStage` : les tableaux typés redeviennent de simples tableaux JSON. */
export const stageToJson = (stage: StageData): unknown => ({
  ...stage,
  terrain: stage.terrain && {
    positions: Array.from(stage.terrain.positions),
    indices: Array.from(stage.terrain.indices),
    ...(stage.terrain.colors && { colors: Array.from(stage.terrain.colors) }),
  },
});
