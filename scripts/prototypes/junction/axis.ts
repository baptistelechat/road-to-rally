// Axe d'un aller-retour : bras + boucle, traités une seule fois, la jonction épinglée.
import { CatmullRomCurve3, Vector3 } from "three";
import {
  MIN_RADIUS,
  RADIUS_MARGIN,
  STEP,
  WIDEN_GAIN,
  WIDEN_MAX_ITERATIONS,
  WIDEN_SMOOTH_RADIUS,
} from "../../../src/geo/config";
import { curvatureAt, roundMm, type PlanePoint } from "../../../src/geo/gpx";
import { buildProfile } from "../../../src/geo/profile";
import { boxSmooth } from "../../../src/geo/smooth";
import type { Vec3 } from "../../../src/sim/types";
import { polylineLength, resampleBy } from "./geometry";

/** Points du bras gardés de part et d'autre de la boucle pour y mesurer la courbure : la jonction n'est pas un bout. */
const CONTEXT = 8;

const smoothCurve = (points: PlanePoint[]): PlanePoint[] => {
  const curve = new CatmullRomCurve3(
    points.map((p) => new Vector3(p.x, 0, p.z)),
    false,
    "centripetal",
  );
  curve.arcLengthDivisions = Math.ceil(polylineLength(points) / 0.25);
  const divisions = Math.max(2, Math.round(curve.getLength() / STEP));
  return curve.getSpacedPoints(divisions).map((p) => ({ x: p.x, z: p.z }));
};

const resampleCount = (points: PlanePoint[], count: number): PlanePoint[] => {
  const length = polylineLength(points);
  return resampleBy(points, length / count).slice(0, count + 1);
};

export interface WidenReport {
  iterations: number;
  /** Rayon mini avant et après, sur la boucle et ses raccords */
  before: number;
  after: number;
  /** Déplacement maximal de la boucle */
  moved: number;
  loopBefore: number;
  loopAfter: number;
}

/**
 * Copie de `widenTightTurns` : seuls les points intérieurs de la boucle bougent, la jonction reste en place,
 * et la courbure à ses deux bouts se mesure avec le bras comme voisin. Le jeu aurait besoin de ce même épinglage.
 */
export const widenLoop = (
  arm: PlanePoint[],
  loop: PlanePoint[],
  minRadius: number = MIN_RADIUS,
): { loop: PlanePoint[]; report: WidenReport } => {
  const target = minRadius * RADIUS_MARGIN;
  const tail = arm.slice(-CONTEXT - 1, -1);
  const head = [...tail].reverse();
  const assemble = (l: PlanePoint[]): PlanePoint[] => [...tail, ...l, ...head];
  const radius = (l: PlanePoint[]): number => {
    const all = assemble(l);
    let max = 0;
    for (let i = 1; i < all.length - 1; i++)
      max = Math.max(max, Math.abs(curvatureAt(all, i)));
    return max > 0 ? 1 / max : Infinity;
  };
  const count = loop.length - 1;
  let points = loop;
  let iteration = 0;
  const before = radius(loop);
  for (; iteration < WIDEN_MAX_ITERATIONS; iteration++) {
    const all = assemble(points);
    const deficit = new Array<number>(all.length).fill(0);
    let tight = false;
    for (let i = 1; i < all.length - 1; i++) {
      const curvature = curvatureAt(all, i);
      if (Math.abs(curvature) * target <= 1) continue;
      tight = true;
      deficit[i] = Math.sign(curvature) * (target - 1 / Math.abs(curvature));
    }
    if (!tight) break;
    const push = boxSmooth(
      boxSmooth(deficit, WIDEN_SMOOTH_RADIUS),
      WIDEN_SMOOTH_RADIUS,
    );
    const offset = tail.length;
    const moved = points.map((point, k) => {
      if (k === 0 || k === points.length - 1) return point;
      const i = k + offset;
      const previous = all[i - 1];
      const next = all[i + 1];
      const tx = next.x - previous.x;
      const tz = next.z - previous.z;
      const norm = Math.hypot(tx, tz) || 1;
      const corner = deficit[i] !== 0 ? 0.25 : 0;
      const shift = WIDEN_GAIN * push[i];
      return {
        x:
          point.x +
          corner * ((previous.x + next.x) / 2 - point.x) +
          (shift * tz) / norm,
        z:
          point.z +
          corner * ((previous.z + next.z) / 2 - point.z) -
          (shift * tx) / norm,
      };
    });
    points = resampleCount(moved, count);
    points[points.length - 1] = loop[loop.length - 1];
    points[0] = loop[0];
  }
  let movedMax = 0;
  for (const p of points) {
    let best = Infinity;
    for (const q of loop)
      best = Math.min(best, Math.hypot(p.x - q.x, p.z - q.z));
    movedMax = Math.max(movedMax, best);
  }
  return {
    loop: points,
    report: {
      iterations: iteration,
      before,
      after: radius(points),
      moved: movedMax,
      loopBefore: polylineLength(loop),
      loopAfter: polylineLength(points),
    },
  };
};

export interface LollipopAxis {
  /** Bras puis boucle ; le dernier point est le point de jonction `points[armEnd]`, aux mêmes coordonnées */
  plan: PlanePoint[];
  armEnd: number;
  widen: WidenReport;
}

export const prepareAxis = (
  rawArm: PlanePoint[],
  rawLoop: PlanePoint[],
): LollipopAxis => {
  const arm = smoothCurve(rawArm);
  const j = arm[arm.length - 1];
  const smoothed = smoothCurve(rawLoop);
  smoothed[0] = j;
  smoothed[smoothed.length - 1] = j;
  const { loop, report } = widenLoop(arm, smoothed);
  const round = (p: PlanePoint): PlanePoint => ({
    x: roundMm(p.x),
    z: roundMm(p.z),
  });
  const plan = [...arm, ...loop.slice(1)].map(round);
  return { plan, armEnd: arm.length - 1, widen: report };
};

export interface Disc {
  x: number;
  z: number;
  r: number;
}

export interface ProfileReport {
  /** Écart d'altitude entre la fin de la boucle et la jonction avant correction */
  closure: number;
  /** Correction maximale due à la mise à plat */
  flatten: number;
  transition: number;
  maxSlope: number;
  minVerticalRadius: number;
}

const stats = (y: number[]): { slope: number; radius: number } => {
  let slope = 0;
  let bend = 0;
  for (let i = 0; i + 1 < y.length; i++)
    slope = Math.max(slope, Math.abs(y[i + 1] - y[i]) / STEP);
  for (let i = 1; i + 1 < y.length; i++)
    bend = Math.max(bend, Math.abs(y[i - 1] - 2 * y[i] + y[i + 1]));
  return { slope, radius: bend > 0 ? (STEP * STEP) / bend : Infinity };
};

/**
 * Altitudes absolues de l'axe : `buildProfile` du jeu sur bras + boucle, l'écart de fermeture étalé sur la boucle,
 * puis, si un disque est donné, palier plat dans le disque avec une transition assez longue pour tenir les limites du jeu.
 */
export const roadProfile = (
  axis: LollipopAxis,
  altitudeAt: (x: number, z: number) => number,
  flatDisc: Disc | null,
  flatReach: number,
): { y: number[]; report: ProfileReport } => {
  const { plan, armEnd } = axis;
  const raw = plan.map((p) => altitudeAt(p.x, p.z));
  const profile = buildProfile(
    raw,
    raw.map(() => false),
  );
  const last = plan.length - 1;
  const closure = profile[last] - profile[armEnd];
  const closed = profile.map((v, i) =>
    i > armEnd ? v - (closure * (i - armEnd)) / (last - armEnd) : v,
  );
  if (!flatDisc) {
    const s = stats(closed);
    return {
      y: closed,
      report: {
        closure,
        flatten: 0,
        transition: 0,
        maxSlope: s.slope,
        minVerticalRadius: s.radius,
      },
    };
  }
  const flat = plan.map(
    (p) =>
      Math.hypot(p.x - flatDisc.x, p.z - flatDisc.z) <
      flatDisc.r + flatReach,
  );
  // Distance à la zone plate, le long de l'axe, en points.
  const away = new Array<number>(plan.length).fill(Infinity);
  for (let i = 0; i < plan.length; i++)
    if (flat[i]) away[i] = 0;
    else if (i > 0) away[i] = away[i - 1] + 1;
  for (let i = plan.length - 2; i >= 0; i--)
    away[i] = Math.min(away[i], away[i + 1] + 1);
  const target = closed[armEnd];
  const blended = [...closed];
  // On intègre la pente en la multipliant par une rampe en sortant du palier : la pente réelle reste, décalée.
  // Le décalage ainsi créé s'efface ensuite doucement sur `fade` mètres, pour que la route retrouve le relief.
  const ramp = 20;
  const fade = 160;
  const walk = (indices: number[]): void => {
    let y = target;
    let previous: number | null = null;
    let offset = 0;
    let distance = 0;
    const available = indices.length * STEP;
    const fadeLength = Math.min(fade, Math.max(30, available - ramp));
    for (const i of indices) {
      if (flat[i]) {
        blended[i] = target;
        previous = i;
        continue;
      }
      if (previous === null) continue;
      distance += STEP;
      const t = Math.min(1, distance / ramp);
      const factor = t * t * (3 - 2 * t);
      y += (closed[i] - closed[previous]) * factor;
      if (distance <= ramp) offset = y - closed[i];
      const u = Math.min(1, Math.max(0, distance - ramp) / fadeLength);
      const keep = 1 - u * u * (3 - 2 * u);
      blended[i] = distance <= ramp ? y : closed[i] + offset * keep;
      previous = i;
    }
  };
  const middle = Math.floor((armEnd + last) / 2);
  walk(Array.from({ length: armEnd + 1 }, (_, i) => armEnd - i));
  walk(Array.from({ length: middle - armEnd }, (_, i) => armEnd + i + 1));
  walk(Array.from({ length: last - middle }, (_, i) => last - i));
  const s = stats(blended);
  return {
    y: blended,
    report: {
      closure,
      flatten: blended.reduce(
        (m, v, i) => Math.max(m, Math.abs(v - closed[i])),
        0,
      ),
      transition: ramp + fade,
      maxSlope: s.slope,
      minVerticalRadius: s.radius,
    },
  };
};

export const toPoints = (axis: LollipopAxis, y: number[]): Vec3[] => {
  const base = Math.min(...y);
  return axis.plan.map((p, i) => ({
    x: p.x,
    y: Math.max(0, roundMm(y[i] - base)),
    z: p.z,
  }));
};

export const baseOf = (y: number[]): number => roundMm(Math.min(...y));
