import type { MeshData, StageData, Vec3 } from "../types";

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
