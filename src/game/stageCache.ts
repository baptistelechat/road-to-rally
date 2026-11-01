// Spéciales déjà générées, dans IndexedDB. Les typed arrays y restent tels quels, sans passer par du JSON.
// Toute panne (navigation privée, stockage plein, entrée illisible) revient à ne pas avoir de cache.
import { PIPELINE_VERSION } from "@/geo/config";
import { hashText } from "@/geo/stageHash";
import { parseStage } from "@/sim/track/stageCodec";
import type { StageData } from "@/sim/types";

const DB_NAME = "rally";
const STORE = "stages";

/** Changer un seuil du pipeline change la version, donc la clé. */
// ponytail: les entrées des anciennes versions restent sur le disque, aucune éviction.
export const stageCacheKey = (gpx: string): string =>
  `${hashText(gpx)}:${PIPELINE_VERSION}`;

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

export const readCachedStage = async (
  key: string,
): Promise<StageData | null> => {
  try {
    const db = await openDatabase();
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return validEntry(value);
  } catch (error) {
    console.warn("Cache des spéciales illisible", error);
    return null;
  }
};

export const writeCachedStage = async (
  key: string,
  stage: StageData,
): Promise<void> => {
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
  } catch (error) {
    console.warn("Spéciale non mise en cache", error);
  }
};
