import type { Track, Vec3 } from "@/sim/types";

/** Plafond de points du tracé : à cette taille, 15 km sur 7 500 points n'apporteraient rien */
const MAX_POINTS = 240;
/** Un point sur deux au moins : 4 m d'écart sur un axe à 2 m de pas */
const MIN_STRIDE = 2;

export interface MiniMapOutline {
  path: string;
  viewBox: string;
  start: Vec3;
  finish: Vec3;
  /** 1 % du plus grand côté, pour des marqueurs de même taille sur toutes les cartes */
  unit: number;
}

/** Du départ à l'arrivée, sans les prolongements d'une spéciale. Nord en haut : (x, z) se lisent tels quels. */
export const miniMapOutline = (track: Track): MiniMapOutline => {
  const { points, closed } = track;
  const from = closed ? 0 : track.indexAt(track.startS);
  const to = closed ? points.length - 1 : track.indexAt(track.finishS);
  const count = to - from + 1;
  const stride = Math.max(MIN_STRIDE, Math.ceil(count / MAX_POINTS));
  const kept = points.filter(
    (_, i) => i === to || (i >= from && i < to && (i - from) % stride === 0),
  );
  const xs = kept.map((point) => point.x);
  const zs = kept.map((point) => point.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...zs) - minZ;
  const unit = Math.max(width, height) / 100;
  const margin = unit * 6;
  return {
    path: `${kept.map((point, i) => `${i ? "L" : "M"}${Math.round(point.x)} ${Math.round(point.z)}`).join("")}${closed ? "Z" : ""}`,
    viewBox: `${minX - margin} ${minZ - margin} ${width + 2 * margin} ${height + 2 * margin}`,
    start: points[from],
    finish: points[to],
    unit,
  };
};
