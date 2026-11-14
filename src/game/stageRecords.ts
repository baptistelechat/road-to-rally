// Meilleur temps local, un par spéciale. L'identité vient de `GameMap.recordId` : l'empreinte du tracé pour une
// spéciale créée ou importée, donc un tracé modifié repart sans record.
import type { GameMap } from "./maps";

export interface StageRecord {
  version: 1;
  /** Pénalités comprises */
  totalMs: number;
  /** Temps de passage aux intermédiaires, vide sur le circuit */
  splitsMs: readonly number[];
  /** ISO, vide pour un record repris de l'ancienne clé */
  date: string;
  /** Rempli par le fantôme, typé plus tard */
  ghost?: unknown;
}

export type RecordIdentity = Pick<GameMap, "recordId" | "bestLapKey">;

const PREFIX = "rally:stage-record:";

export const stageRecordKey = ({ recordId }: RecordIdentity): string =>
  `${PREFIX}${recordId}`;

const isPositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** Ce qui sort du stockage n'est pas sûr : une valeur abîmée compte comme absente. */
const parseRecord = (text: string | null): StageRecord | null => {
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { version, totalMs, splitsMs, date, ghost } = value as Record<
    string,
    unknown
  >;
  if (version !== 1 || !isPositive(totalMs)) return null;
  if (!Array.isArray(splitsMs) || !splitsMs.every(isPositive)) return null;
  return {
    version: 1,
    totalMs,
    splitsMs,
    date: typeof date === "string" ? date : "",
    ...(ghost === undefined ? {} : { ghost }),
  };
};

/** Record de la spéciale, ou à défaut l'ancien meilleur temps seul. `null` si rien, ou stockage bloqué. */
export const readStageRecord = (map: RecordIdentity): StageRecord | null => {
  try {
    const record = parseRecord(localStorage.getItem(stageRecordKey(map)));
    if (record) return record;
    const legacy = Number(localStorage.getItem(map.bestLapKey));
    return isPositive(legacy)
      ? { version: 1, totalMs: legacy, splitsMs: [], date: "" }
      : null;
  } catch {
    return null;
  }
};

export const isNewRecord = (
  previous: StageRecord | null,
  totalMs: number,
): boolean => previous === null || totalMs < previous.totalMs;

/**
 * À n'appeler que pour un nouveau record : le fantôme pèsera des centaines de Ko. Quota dépassé : le temps est gardé
 * sans le fantôme plutôt que perdu. Renvoie ce qui a été écrit, `null` si rien (stockage bloqué).
 */
export const writeStageRecord = (
  map: RecordIdentity,
  record: StageRecord,
): StageRecord | null => {
  const key = stageRecordKey(map);
  try {
    localStorage.setItem(key, JSON.stringify(record));
    return record;
  } catch {
    if (record.ghost === undefined) return null;
  }
  const light: StageRecord = {
    version: 1,
    totalMs: record.totalMs,
    splitsMs: record.splitsMs,
    date: record.date,
  };
  try {
    localStorage.setItem(key, JSON.stringify(light));
    return light;
  } catch {
    return null;
  }
};
