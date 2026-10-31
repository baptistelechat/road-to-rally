import { COLUMN, type DiagData } from "./recorder";

// Résumé lisible d'une capture : ce qui décroche, et si les décrochages coïncident avec l'appui.
const FRAME_STALL_MS = 50;
const PAD_SILENCE_MS = 300;
const HEAP_DROP_MB = 15;
const MARK_WINDOW_MS = 10_000;

export interface DiagWindow {
  t: number;
  durationMs: number;
}

export interface DiagSummary {
  durationS: number;
  frames: number;
  fps: number;
  frameGap: { p50: number; p99: number; max: number };
  frameMs: { p50: number; p99: number; max: number };
  /** Images espacées de plus de 50 ms : tout le navigateur ou le fil principal a calé */
  frameStalls: DiagWindow[];
  /** Manette branchée et sollicitée, mais qui n'envoie plus rien. Le stick et les gâchettes bougent sans cesse quand on joue. */
  padSilences: DiagWindow[];
  /** Pauses de nettoyage mémoire : chute brutale du tas JS */
  heapDrops: { t: number; mb: number }[];
  heapMb: { min: number; max: number };
  allocMbPerS: number;
  audioUnderruns: number;
  audioWritesPerS: number;
  rumbleSendsPerS: number;
  eventCounts: Record<string, number>;
  /** Les 10 secondes avant chaque appui sur le bouton */
  beforeMarks: {
    t: number;
    frameGapMax: number;
    padSilenceMax: number;
    underruns: number;
    workerStalls: number;
    longTasks: number;
  }[];
}

const percentile = (sorted: number[], ratio: number): number =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
    : 0;

const spread = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5),
    p99: percentile(sorted, 0.99),
    max: sorted.at(-1) ?? 0,
  };
};

export const analyzeDiag = ({ rows, events }: DiagData): DiagSummary => {
  const col = (name: keyof typeof COLUMN): number[] =>
    rows.map((row) => row[COLUMN[name]]);
  const t = col("t");
  const gaps = col("frameGap");
  const durationMs = t.length > 1 ? t[t.length - 1] - t[0] : 0;
  const perS = (name: keyof typeof COLUMN): number => {
    const values = col(name);
    return durationMs > 0 && values.length
      ? Math.round(
          ((values[values.length - 1] - values[0]) / durationMs) * 10000,
        ) / 10
      : 0;
  };

  const frameStalls: DiagWindow[] = [];
  gaps.forEach((gap, i) => {
    if (gap > FRAME_STALL_MS) frameStalls.push({ t: t[i], durationMs: gap });
  });

  // Silence manette : à la main, un stick ou une gâchette analogique change presque à chaque relevé.
  const padSilences: DiagWindow[] = [];
  let silentSince: number | null = null;
  let silentPeak = 0;
  rows.forEach((row, i) => {
    const age = row[COLUMN.padAge];
    const held =
      Math.abs(row[COLUMN.steer]) + row[COLUMN.throttle] + row[COLUMN.brake] >
      0.05;
    if (row[COLUMN.padConnected] && held && age > PAD_SILENCE_MS) {
      silentSince ??= t[i];
      silentPeak = Math.max(silentPeak, age);
    } else if (silentSince !== null) {
      padSilences.push({ t: silentSince, durationMs: silentPeak });
      silentSince = null;
      silentPeak = 0;
    }
  });
  if (silentSince !== null)
    padSilences.push({ t: silentSince, durationMs: silentPeak });

  const heap = col("heapMb");
  const heapDrops: { t: number; mb: number }[] = [];
  let allocated = 0;
  for (let i = 1; i < heap.length; i++) {
    const change = heap[i] - heap[i - 1];
    if (change > 0) allocated += change;
    if (-change > HEAP_DROP_MB) heapDrops.push({ t: t[i], mb: -change });
  }

  const eventCounts: Record<string, number> = {};
  for (const event of events)
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;

  const countEvents = (type: string, from: number, to: number): number =>
    events.filter((e) => e.type === type && e.t >= from && e.t <= to).length;

  const beforeMarks = events
    .filter((event) => event.type === "mark")
    .map((mark) => {
      const from = mark.t - MARK_WINDOW_MS;
      const inside = rows.filter(
        (row) => row[COLUMN.t] >= from && row[COLUMN.t] <= mark.t,
      );
      const firstUnderrun = inside[0]?.[COLUMN.audioUnderruns] ?? 0;
      const lastUnderrun = inside.at(-1)?.[COLUMN.audioUnderruns] ?? 0;
      return {
        t: mark.t,
        frameGapMax: Math.max(0, ...inside.map((r) => r[COLUMN.frameGap])),
        padSilenceMax: Math.max(
          0,
          ...padSilences
            .filter((s) => s.t >= from && s.t <= mark.t)
            .map((s) => s.durationMs),
        ),
        underruns: lastUnderrun - firstUnderrun,
        workerStalls: countEvents("workerStall", from, mark.t),
        longTasks: countEvents("longTask", from, mark.t),
      };
    });

  return {
    durationS: Math.round(durationMs / 100) / 10,
    frames: rows.length,
    fps: durationMs > 0 ? Math.round((rows.length / durationMs) * 1000) : 0,
    frameGap: spread(gaps),
    frameMs: spread(col("frameMs")),
    frameStalls: frameStalls.slice(-30),
    padSilences: padSilences.slice(-30),
    heapDrops: heapDrops.slice(-30),
    heapMb: {
      min: heap.length ? Math.min(...heap) : 0,
      max: heap.length ? Math.max(...heap) : 0,
    },
    allocMbPerS:
      durationMs > 0 ? Math.round((allocated / durationMs) * 10000) / 10 : 0,
    audioUnderruns:
      (rows.at(-1)?.[COLUMN.audioUnderruns] ?? 0) -
      (rows[0]?.[COLUMN.audioUnderruns] ?? 0),
    audioWritesPerS: perS("audioWrites"),
    rumbleSendsPerS: perS("rumbleSends"),
    eventCounts,
    beforeMarks,
  };
};
