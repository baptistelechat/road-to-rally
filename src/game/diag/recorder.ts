// Enregistreur en anneau des dernières images : mémoire préallouée, pour ne pas fausser ce qu'il mesure.
export const DIAG_COLUMNS = [
  "t",
  "frameGap",
  "loopMs",
  "frameMs",
  "steps",
  "padConnected",
  "padAge",
  "steer",
  "throttle",
  "brake",
  "speed",
  "rpm",
  "s",
  "audioTime",
  "audioRunning",
  "audioWrites",
  "audioUnderruns",
  "rumbleSends",
  "rumblePendingMs",
  "heapMb",
  "drawCalls",
  "triangles",
  "geometries",
  "textures",
] as const;

export type DiagColumn = (typeof DIAG_COLUMNS)[number];

export const COLUMN = Object.fromEntries(
  DIAG_COLUMNS.map((name, index) => [name, index]),
) as Record<DiagColumn, number>;

export interface DiagEvent {
  t: number;
  type: string;
  detail?: unknown;
}

export interface DiagData {
  columns: readonly string[];
  rows: number[][];
  events: DiagEvent[];
}

export interface DiagRecorder {
  /** Ligne en cours : à remplir avec `COLUMN`, puis à valider avec `commit` */
  row: Float64Array;
  commit: () => void;
  event: (t: number, type: string, detail?: unknown) => void;
  data: () => DiagData;
}

const MAX_EVENTS = 1000;
const round = (value: number): number => Math.round(value * 100) / 100;

export interface DiagBucket {
  /** Début de la tranche, en secondes depuis l'ouverture de la page */
  t: number;
  frames: number;
  gapMax: number;
  frameMsAvg: number;
  underruns: number;
  padAgeMax: number;
  workerStalls: number;
  workerStallMs: number;
  /** Meilleur temps d'un calcul fixe dans le Worker. S'il monte, le processeur ralentit. 0 si aucune mesure. */
  cpuMs: number;
}

export interface DiagHistory {
  frame: (
    t: number,
    gap: number,
    frameMs: number,
    underruns: number,
    padAge: number,
  ) => void;
  workerStall: (gap: number) => void;
  cpu: (ms: number) => void;
  rows: () => DiagBucket[];
}

/** Toute la session par tranches, depuis l'ouverture : l'anneau ne garde que les 90 dernières secondes. */
export const createDiagHistory = (
  periodMs = 10_000,
  // ponytail: 1 h à 10 s par tranche, au-delà on garde les plus récentes.
  maxBuckets = 360,
): DiagHistory => {
  const empty = (t: number): DiagBucket => ({
    t,
    frames: 0,
    gapMax: 0,
    frameMsAvg: 0,
    underruns: 0,
    padAgeMax: 0,
    workerStalls: 0,
    workerStallMs: 0,
    cpuMs: 0,
  });
  const done: DiagBucket[] = [];
  let current = empty(0);
  let lastUnderruns = 0;

  return {
    frame: (t, gap, frameMs, underruns, padAge) => {
      const start = Math.floor(t / periodMs) * periodMs;
      if (start !== current.t) {
        done.push(current);
        if (done.length > maxBuckets) done.shift();
        current = empty(start);
      }
      current.frames++;
      current.gapMax = Math.max(current.gapMax, gap);
      current.frameMsAvg += (frameMs - current.frameMsAvg) / current.frames;
      current.underruns += underruns - lastUnderruns;
      lastUnderruns = underruns;
      current.padAgeMax = Math.max(current.padAgeMax, padAge);
    },
    workerStall: (gap) => {
      current.workerStalls++;
      current.workerStallMs += gap;
    },
    cpu: (ms) => {
      current.cpuMs = current.cpuMs ? Math.min(current.cpuMs, ms) : ms;
    },
    rows: () =>
      [...done, current].map((bucket) => ({
        ...bucket,
        t: bucket.t / 1000,
        gapMax: round(bucket.gapMax),
        frameMsAvg: round(bucket.frameMsAvg),
        padAgeMax: round(bucket.padAgeMax),
        workerStallMs: round(bucket.workerStallMs),
        cpuMs: round(bucket.cpuMs),
      })),
  };
};

export const createDiagRecorder = (capacity: number): DiagRecorder => {
  const width = DIAG_COLUMNS.length;
  const ring = new Float64Array(capacity * width);
  const row = new Float64Array(width);
  let events: DiagEvent[] = [];
  let written = 0;

  return {
    row,
    commit: () => {
      ring.set(row, (written % capacity) * width);
      written++;
    },
    event: (t, type, detail) => {
      events.push(detail === undefined ? { t, type } : { t, type, detail });
      if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS / 2);
    },
    data: () => {
      const count = Math.min(written, capacity);
      const first = written - count;
      const rows: number[][] = [];
      for (let i = 0; i < count; i++) {
        const at = ((first + i) % capacity) * width;
        rows.push(Array.from(ring.subarray(at, at + width), round));
      }
      return { columns: DIAG_COLUMNS, rows, events: [...events] };
    },
  };
};
