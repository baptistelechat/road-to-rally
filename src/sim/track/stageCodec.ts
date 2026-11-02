import type {
  ChicaneBlock,
  MeshData,
  SharedRange,
  StageData,
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
      fail(`points[${returnStart + k}]`, `ne recopie pas points[${armEnd - k}]`);
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
    terrain: parseTerrain(json.terrain),
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
