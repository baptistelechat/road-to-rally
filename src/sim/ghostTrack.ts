import type { InputFrames } from "../input/recorder";
import { FIXED_DT } from "./fixedStep";
import { carConfig } from "./carConfig";
import type { Pose, Track } from "./types";

/** Un échantillon tous les 6 pas, soit 10 Hz : l'interpolation rattrape le reste (voir la fiche 4.5). */
export const GHOST_PERIOD = 6;
/** Position au centimètre */
const POS_SCALE = 100;
/** Quaternion au dix-millième, renormalisé à la lecture */
const ROT_SCALE = 10000;
const SAMPLE_SIZE = 7;
/** Au-delà, les entrées ne sont pas gardées : une manette analogique les gonfle, et un dépassement de quota perdrait le record. */
const INPUT_BUDGET = 400_000;
const STEP_MS = FIXED_DT * 1000;

/**
 * Fantôme d'une course, sérialisable tel quel en JSON.
 * `samples` : par échantillon, écarts entiers au précédent (x, y, z en cm, puis quaternion × 10000).
 * L'échantillon `i` est la pose après le pas `i × period + 1` depuis le GO, le dernier tombe sur le pas d'arrivée.
 */
export interface GhostData {
  /** 2 : pénalités notées. Un fantôme de version 1 ne les a pas, il est ignoré (fantôme de secours à la place). */
  version: 2;
  period: number;
  /** Nombre de pas chronométrés enregistrés */
  steps: number;
  samples: number[];
  /** Échantillons atteints par une remise en piste : pas d'interpolation depuis le précédent */
  cuts: number[];
  /**
   * Pénalités, par paires : nombre de pas enregistrés au moment de la pénalité, puis sa durée en ms. Le fantôme s'y
   * arrête le temps de la pénalité : il suit le chrono officiel, pas seulement le temps de conduite.
   */
  penalties: number[];
  /** Entrées depuis le redémarrage, format canonique du rejeu. Absentes si trop volumineuses. */
  inputs?: InputFrames;
}

export interface PoseRecorder {
  /** Un appel par pas, après `sim.step`, tant que le chrono tourne */
  record: (pose: Pose, respawnCount: number) => void;
  /** Pénalité tombée au dernier pas enregistré */
  penalty: (ms: number) => void;
  /** Pas chronométrés enregistrés */
  count: () => number;
  build: (inputs?: InputFrames) => GhostData | null;
}

export interface GhostPlayer {
  /** Pose à l'instant du chrono officiel (ms depuis le GO, pénalités comprises), `null` après la fin. Objet réutilisé. */
  poseAt: (elapsedMs: number) => Pose | null;
  /** Temps officiel du fantôme en ms, pénalités comprises */
  durationMs: number;
}

const sampleCount = (steps: number, period: number): number => {
  const last = steps - 1;
  return Math.floor(last / period) + 1 + (last % period ? 1 : 0);
};

export const createPoseRecorder = (
  period: number = GHOST_PERIOD,
): PoseRecorder => {
  const samples: number[] = [];
  const cuts: number[] = [];
  // Dernière valeur quantifiée émise, pour les écarts.
  const prev = [0, 0, 0, 0, 0, 0, 0];
  const last = [0, 0, 0, 0, 0, 0, 0];
  const penalties: number[] = [];
  let steps = 0;
  let lastRespawns: number | null = null;
  let pendingCut = false;

  const quantize = (
    { position: p, rotation: r }: Pose,
    out: number[],
  ): void => {
    // q et -q sont la même rotation : on reste dans l'hémisphère du précédent, écarts petits et interpolation directe.
    const sign =
      prev[3] * r.x + prev[4] * r.y + prev[5] * r.z + prev[6] * r.w < 0
        ? -1
        : 1;
    out[0] = Math.round(p.x * POS_SCALE);
    out[1] = Math.round(p.y * POS_SCALE);
    out[2] = Math.round(p.z * POS_SCALE);
    out[3] = Math.round(sign * r.x * ROT_SCALE);
    out[4] = Math.round(sign * r.y * ROT_SCALE);
    out[5] = Math.round(sign * r.z * ROT_SCALE);
    out[6] = Math.round(sign * r.w * ROT_SCALE);
  };

  const emit = (values: number[]): void => {
    if (pendingCut && samples.length) cuts.push(samples.length / SAMPLE_SIZE);
    pendingCut = false;
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      samples.push(values[i] - prev[i]);
      prev[i] = values[i];
    }
  };

  return {
    record: (pose, respawnCount) => {
      if (lastRespawns !== null && respawnCount !== lastRespawns)
        pendingCut = true;
      lastRespawns = respawnCount;
      quantize(pose, last);
      if (steps % period === 0) emit(last);
      steps++;
    },
    penalty: (ms) => {
      penalties.push(steps, ms);
    },
    count: () => steps,
    build: (inputs) => {
      if (!steps) return null;
      const data: GhostData = {
        version: 2,
        period,
        steps,
        samples: samples.slice(),
        cuts: cuts.slice(),
        penalties: penalties.slice(),
      };
      // Le pas d'arrivée, hors grille : le fantôme franchit bien la ligne. Sans toucher à l'état, `build` reste rejouable.
      if ((steps - 1) % period) {
        if (pendingCut) data.cuts.push(samples.length / SAMPLE_SIZE);
        for (let i = 0; i < SAMPLE_SIZE; i++)
          data.samples.push(last[i] - prev[i]);
      }
      if (inputs && JSON.stringify(inputs).length <= INPUT_BUDGET)
        data.inputs = inputs;
      return data;
    },
  };
};

const isIntArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((n) => Number.isInteger(n));

const isInputFrames = (value: unknown): value is InputFrames => {
  if (typeof value !== "object" || value === null) return false;
  const { runs, count } = value as { runs?: unknown; count?: unknown };
  return (
    Array.isArray(runs) &&
    runs.length % 5 === 0 &&
    runs.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Number.isInteger(count)
  );
};

/** Relit un fantôme stocké : `null` s'il est absent, d'une autre version ou abîmé. */
export const parseGhost = (value: unknown): GhostData | null => {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<Record<keyof GhostData, unknown>>;
  if (v.version !== 2) return null;
  const { period, steps, samples, cuts, penalties, inputs } = v;
  if (typeof period !== "number" || !Number.isInteger(period) || period < 1)
    return null;
  if (typeof steps !== "number" || !Number.isInteger(steps) || steps < 1)
    return null;
  if (!isIntArray(samples) || !isIntArray(cuts)) return null;
  const count = sampleCount(steps, period);
  if (samples.length !== count * SAMPLE_SIZE) return null;
  if (cuts.some((c) => c < 1 || c >= count)) return null;
  if (
    !isIntArray(penalties) ||
    penalties.length % 2 !== 0 ||
    penalties.some((n, i) => (i % 2 ? n < 0 : n < 1 || n > steps))
  )
    return null;
  if (inputs !== undefined && !isInputFrames(inputs)) return null;
  return {
    version: 2,
    period,
    steps,
    samples,
    cuts,
    penalties,
    ...(inputs !== undefined ? { inputs } : {}),
  };
};

/** Décode une fois au chargement, puis lit sans allouer. */
export const createGhostPlayer = (data: GhostData): GhostPlayer => {
  const count = sampleCount(data.steps, data.period);
  const pos = new Float64Array(count * 3);
  const rot = new Float64Array(count * 4);
  const cut = new Uint8Array(count);
  for (const c of data.cuts) cut[c] = 1;
  const acc = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < SAMPLE_SIZE; k++)
      acc[k] += data.samples[i * SAMPLE_SIZE + k];
    pos[i * 3] = acc[0] / POS_SCALE;
    pos[i * 3 + 1] = acc[1] / POS_SCALE;
    pos[i * 3 + 2] = acc[2] / POS_SCALE;
    const n = Math.hypot(acc[3], acc[4], acc[5], acc[6]) || 1;
    for (let k = 0; k < 4; k++) rot[i * 4 + k] = acc[3 + k] / n;
  }
  // Pas (depuis le GO, à partir de 0) de chaque échantillon : grille régulière, sauf le dernier.
  const stepOf = (i: number): number =>
    Math.min(i * data.period, data.steps - 1);
  const out: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  // Pénalités en temps de conduite : le fantôme reste sur place pendant chacune.
  const pauses: { atMs: number; ms: number }[] = [];
  for (let k = 0; k < data.penalties.length; k += 2)
    pauses.push({ atMs: data.penalties[k] * STEP_MS, ms: data.penalties[k + 1] });
  const penaltyTotal = pauses.reduce((sum, { ms }) => sum + ms, 0);

  /** Temps de conduite à l'instant officiel donné */
  const drivenAt = (officialMs: number): number => {
    let added = 0;
    for (const { atMs, ms } of pauses) {
      const from = atMs + added;
      if (officialMs < from) break;
      if (officialMs < from + ms) return atMs;
      added += ms;
    }
    return officialMs - added;
  };

  const drivenPose = (elapsedMs: number): Pose | null => {
    // L'échantillon du pas k est la pose au temps (k + 1) pas.
    const raw = Math.max(0, elapsedMs / STEP_MS - 1);
    // Tolérance d'arrondi : l'instant exact du dernier pas montre encore le fantôme.
    if (raw > data.steps - 1 + 1e-6) return null;
    const step = Math.min(raw, data.steps - 1);
    const i = Math.min(Math.floor(step / data.period), count - 1);
    const j = Math.min(i + 1, count - 1);
    const span = stepOf(j) - stepOf(i);
    // Après une remise en piste, le fantôme saute au lieu de balayer le décor.
    const t = j === i || cut[j] ? 0 : Math.min(1, (step - stepOf(i)) / span);
    const p = out.position;
    p.x = pos[i * 3] + (pos[j * 3] - pos[i * 3]) * t;
    p.y = pos[i * 3 + 1] + (pos[j * 3 + 1] - pos[i * 3 + 1]) * t;
    p.z = pos[i * 3 + 2] + (pos[j * 3 + 2] - pos[i * 3 + 2]) * t;
    // nlerp : écart de 0,1 s au plus, indiscernable d'un slerp. Même hémisphère garanti à l'enregistrement.
    const r = out.rotation;
    const x = rot[i * 4] + (rot[j * 4] - rot[i * 4]) * t;
    const y = rot[i * 4 + 1] + (rot[j * 4 + 1] - rot[i * 4 + 1]) * t;
    const z = rot[i * 4 + 2] + (rot[j * 4 + 2] - rot[i * 4 + 2]) * t;
    const w = rot[i * 4 + 3] + (rot[j * 4 + 3] - rot[i * 4 + 3]) * t;
    const n = Math.hypot(x, y, z, w) || 1;
    r.x = x / n;
    r.y = y / n;
    r.z = z / n;
    r.w = w / n;
    return out;
  };

  return {
    durationMs: data.steps * STEP_MS + penaltyTotal,
    poseAt: (elapsedMs) => drivenPose(drivenAt(elapsedMs)),
  };
};

/**
 * Fantôme de secours quand le record n'a pas de poses (record repris de l'ancienne clé, ou écrit sans fantôme) :
 * il roule à allure constante sur l'axe de la route et passe la ligne au temps du record.
 */
export const createLinearGhost = (
  track: Pick<
    Track,
    "points" | "closed" | "length" | "startS" | "finishS" | "nearest" | "startPose"
  >,
  totalMs: number,
  rideHeight: number = carConfig.ride.height,
): GhostPlayer => {
  const { points, closed } = track;
  const n = points.length;
  const segments = closed ? n : n - 1;
  // Abscisses cumulées à partir des points : l'abscisse de la piste s'y ramène par une simple règle de trois.
  const cum = new Float64Array(segments + 1);
  for (let k = 0; k < segments; k++) {
    const a = points[k];
    const b = points[(k + 1) % n];
    cum[k + 1] = cum[k] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  const scale = cum[segments] / track.length;
  const course = closed ? track.length : track.finishS - track.startS;
  // Circuit : le tour part de la voiture posée au départ, comme le chrono (`createLapTimer`).
  const startS = closed
    ? track.nearest(track.startPose.position.x, track.startPose.position.z).s
    : track.startS;
  const out: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  return {
    durationMs: totalMs,
    poseAt: (elapsedMs) => {
      if (elapsedMs > totalMs) return null;
      let d = (startS + (course * Math.max(0, elapsedMs)) / totalMs) * scale;
      if (closed) d %= cum[segments];
      // Recherche dichotomique du segment.
      let lo = 0;
      let hi = segments - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cum[mid] <= d) lo = mid;
        else hi = mid - 1;
      }
      const a = points[lo];
      const b = points[(lo + 1) % n];
      const span = cum[lo + 1] - cum[lo] || 1;
      const t = Math.min(1, Math.max(0, (d - cum[lo]) / span));
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      out.position.x = a.x + dx * t;
      out.position.y = a.y + dy * t + rideHeight;
      out.position.z = a.z + dz * t;
      // Lacet puis tangage : l'avant (-Z local) suit le segment, pente comprise.
      const yaw = Math.atan2(-dx, -dz) / 2;
      const pitch = Math.atan2(dy, Math.hypot(dx, dz)) / 2;
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const cx = Math.cos(pitch);
      const sx = Math.sin(pitch);
      const r = out.rotation;
      r.x = cy * sx;
      r.y = sy * cx;
      r.z = -sy * sx;
      r.w = cy * cx;
      return out;
    },
  };
};
