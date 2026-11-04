import { raceCourse, splitGates } from "@/sim/splits";
import type { Quat, Track, Vec3 } from "@/sim/types";

/** Plafond de points du tracé entier : à cette taille, 15 km sur 7 500 points n'apporteraient rien */
export const MAX_POINTS = 240;
/** Vue zoomée : un point tous les 10 m sur 15 km, assez pour qu'un virage reste rond à 800 m de large */
export const ZOOM_MAX_POINTS = 1500;
/** Un point sur deux au moins : 4 m d'écart sur un axe à 2 m de pas */
const MIN_STRIDE = 2;

export interface MiniMapOutline {
  path: string;
  viewBox: string;
  start: Vec3;
  finish: Vec3;
  /** 1 % du plus grand côté, pour des marqueurs de même taille sur toutes les cartes */
  unit: number;
  /** Plus grand côté de `viewBox`, marges comprises */
  size: number;
  /** Intermédiaires : position et angle de la route en degrés, pour un trait en travers. Vide sur le circuit. */
  gates: { x: number; z: number; angle: number }[];
  /** Part du tracé dessiné parcourue à l'index `index` de `track.points`, de 0 à 1 */
  doneAt: (index: number) => number;
}

/** Du départ à l'arrivée, sans les prolongements d'une spéciale. Nord en haut : (x, z) se lisent tels quels. */
export const miniMapOutline = (
  track: Track,
  maxPoints = MAX_POINTS,
): MiniMapOutline => {
  const { points, closed } = track;
  const from = closed ? 0 : track.indexAt(track.startS);
  const to = closed ? points.length - 1 : track.indexAt(track.finishS);
  const count = to - from + 1;
  const stride = Math.max(MIN_STRIDE, Math.ceil(count / maxPoints));
  const keptIndices: number[] = [];
  for (let i = from; i < to; i += stride) keptIndices.push(i);
  keptIndices.push(to);
  const kept = keptIndices.map((i) => points[i]);
  // Longueur à plat le long du chemin dessiné : sur une pente, `s` en 3D avancerait plus vite que le trait.
  const lengths = [0];
  for (let k = 1; k < kept.length; k++) {
    const a = kept[k - 1];
    const b = kept[k];
    lengths.push(lengths[k - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const last = kept.length - 1;
  const total =
    lengths[last] +
    (closed ? Math.hypot(kept[0].x - kept[last].x, kept[0].z - kept[last].z) : 0);
  const doneAt = (index: number): number => {
    const i = Math.min(to, Math.max(from, index));
    const k = Math.min(last - 1, Math.floor((i - from) / stride));
    const t = (i - keptIndices[k]) / (keptIndices[k + 1] - keptIndices[k]);
    return (lengths[k] + t * (lengths[k + 1] - lengths[k])) / total;
  };
  const xs = kept.map((point) => point.x);
  const zs = kept.map((point) => point.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...zs) - minZ;
  const unit = Math.max(width, height) / 100;
  const margin = unit * 6;
  const course = raceCourse(track);
  const gates = splitGates(course.startS, course.finishS - course.startS).map((s) => {
    // Circuit : la portion d'un tour peut dépasser la fin de l'axe.
    const i = track.indexAt(s % track.length);
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    return {
      x: points[i].x,
      z: points[i].z,
      angle: (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI,
    };
  });
  return {
    path: `${kept.map((point, i) => `${i ? "L" : "M"}${Math.round(point.x)} ${Math.round(point.z)}`).join("")}${closed ? "Z" : ""}`,
    viewBox: `${minX - margin} ${minZ - margin} ${width + 2 * margin} ${height + 2 * margin}`,
    start: points[from],
    finish: points[to],
    unit,
    size: Math.max(width, height) + 2 * margin,
    gates,
    doneAt,
  };
};

/** Cap à l'écran en degrés, horaire, 0 = nord en haut. L'avant de la voiture est -Z local. */
export const screenHeading = ({ x, y, z, w }: Quat): number => {
  const forwardX = -2 * (x * z + w * y);
  const forwardZ = -(1 - 2 * (x * x + y * y));
  return (Math.atan2(forwardX, -forwardZ) * 180) / Math.PI;
};
