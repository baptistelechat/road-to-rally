// Spéciales déjà générées, dans IndexedDB. Les typed arrays y restent tels quels, sans passer par du JSON.
// Toute panne (navigation privée, stockage plein, entrée illisible) revient à ne pas avoir de cache.
import { sortChicaneRequests, type ChicaneRequest } from "@/geo/chicanes";
import { PIPELINE_VERSION } from "@/geo/config";
import { hashText } from "@/geo/stageHash";
import type { GeneratedStage } from "@/geo/stageWorkerClient";
import { parseStage } from "@/sim/track/stageCodec";
import type { StageData } from "@/sim/types";

const DB_NAME = "rally";
const STORE = "stages";

/** Changer un seuil du pipeline change la version, donc la clé. */
// ponytail: les entrées des anciennes versions restent sur le disque, aucune éviction.
export const stageCacheKey = (
  gpx: string,
  chicanes: ChicaneRequest[] = [],
): string => {
  const key = `${hashText(gpx)}:${PIPELINE_VERSION}`;
  // Sans chicane, la clé d'avant : les spéciales déjà rangées restent valables.
  return chicanes.length === 0
    ? key
    : `${key}:${hashText(JSON.stringify(sortChicaneRequests(chicanes)))}`;
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB bloqué"));
  });

/** `parseStage` valide le reste : le terrain en typed arrays, lui, se vérifie ici sans le recopier. */
const validEntry = (value: unknown): StageData | null => {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Partial<StageData>;
  const { terrain = null } = entry;
  if (
    entry.pipelineVersion !== PIPELINE_VERSION ||
    !entry.hash ||
    (terrain !== null &&
      (!(terrain.positions instanceof Float32Array) ||
        !(terrain.indices instanceof Uint32Array) ||
        terrain.positions.length % 3 !== 0 ||
        terrain.indices.length % 3 !== 0))
  )
    return null;
  return { ...parseStage({ ...entry, terrain: null }), terrain };
};

const readEntry = async (key: string): Promise<unknown> => {
  const db = await openDatabase();
  const value = await new Promise<unknown>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
};

export const readCachedStage = async (
  key: string,
): Promise<StageData | null> => {
  try {
    return validEntry(await readEntry(key));
  } catch (error) {
    console.warn("Cache des spéciales illisible", error);
    return null;
  }
};

/** `false` si la spéciale n'a pas pu être écrite, ce qui n'empêche pas de la jouer sur place. */
export const writeCachedStage = async (
  key: string,
  stage: StageData,
): Promise<boolean> => {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(stage, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
    return true;
  } catch (error) {
    console.warn("Spéciale non mise en cache", error);
    return false;
  }
};

/** Une spéciale dégradée n'a pas la clé normale : `loadStage` ne la reprend pas et retentera Overpass (règle de 2.7). */
const DEGRADED_SUFFIX = ":degraded";

interface DegradedEntry extends StageData {
  warnings: string[];
}

/**
 * Range une spéciale de l'éditeur pour le passage au jeu, qui se fait par une vraie navigation : seul le disque y survit.
 * Renvoie la clé à mettre dans l'URL, `null` si le stockage a refusé.
 */
export const storeCustomStage = async (
  gpx: string,
  {
    stage,
    warnings,
    chicanes,
  }: GeneratedStage & { chicanes?: ChicaneRequest[] },
): Promise<string | null> => {
  const base = stageCacheKey(gpx, chicanes);
  const degraded = warnings.length > 0;
  const key = degraded ? `${base}${DEGRADED_SUFFIX}` : base;
  const entry: StageData | DegradedEntry = degraded
    ? { ...stage, warnings }
    : stage;
  return (await writeCachedStage(key, entry)) ? key : null;
};

/** Absente, d'une ancienne version du pipeline ou illisible : `null`, jamais une erreur. */
export const readCustomStage = async (
  key: string,
): Promise<GeneratedStage | null> => {
  try {
    const value = await readEntry(key);
    const stage = validEntry(value);
    if (!stage) return null;
    const { warnings } = value as Partial<DegradedEntry>;
    return {
      stage,
      warnings: Array.isArray(warnings)
        ? warnings.filter((warning) => typeof warning === "string")
        : [],
    };
  } catch (error) {
    console.warn("Cache des spéciales illisible", error);
    return null;
  }
};
