import type { Vec3 } from "../types";
import { createSpatialGrid } from "./spatialGrid";

/** Largeur plate à côté de la route, à hauteur de route, avant que le talus descende */
export const SHOULDER_WIDTH = 2.5;
/**
 * Deux points d'un même virage restent proches sans que leurs chaussées se touchent : sur un demi-cercle
 * de rayon l/2, l'écart reste sous la largeur l jusqu'à une abscisse de π/2 × l. Marge comprise pour la pente.
 */
const NEIGHBOUR_RATIO = 1.7;
/** Variation maximale du bas-côté rétréci, en mètres par mètre d'axe : pas de marche au bord */
const SHOULDER_TAPER = 0.2;
/**
 * Marge laissée de chaque côté entre deux bas-côtés rétrécis d'un tracé ouvert, en mètres. Sans elle, les deux bords
 * se touchent pile au milieu et se coupent de quelques millimètres, ce que le terrain contraint ne peut pas accepter.
 */
const OPEN_SHOULDER_GAP = 0.15;

/** Abscisse le long de l'axe en chaque point, longueur totale en dernière position si le tracé est fermé. */
const abscissas = (points: Vec3[], closed: boolean): number[] => {
  const n = points.length;
  const s = [0];
  for (let i = 1; i < (closed ? n + 1 : n); i++) {
    const a = points[i - 1];
    const b = points[i % n];
    s.push(s[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  return s;
};

/** Appelle `visit` pour chaque couple i < j à moins de `reach` sur le plan horizontal, ni plus ni moins. */
const forEachClosePair = (
  points: Vec3[],
  reach: number,
  visit: (i: number, j: number, d2: number) => void,
): void => {
  const grid = createSpatialGrid(reach);
  points.forEach((p, i) => grid.insert(i, p.x, p.z, p.x, p.z));
  const reach2 = reach * reach;
  points.forEach((a, i) => {
    const cx = Math.floor(a.x / reach);
    const cz = Math.floor(a.z / reach);
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++) {
        const cell = grid.at(cx + ox, cz + oz);
        if (!cell) continue;
        for (const j of cell) {
          if (j <= i) continue;
          const dx = points[j].x - a.x;
          const dz = points[j].z - a.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < reach2) visit(i, j, d2);
        }
      }
  });
};

/**
 * Endroit où deux portions non voisines de l'axe ont leurs chaussées qui se touchent, sur le plan horizontal.
 * Couvre aussi les croisements. `null` si tout est dégagé. Sinon, la première rencontre le long de l'axe.
 */
// ponytail: compare les points et non les segments : précis à quelques cm pour un pas de 2 m, à revoir si le pas grandit.
export const findRoadContact = (
  points: Vec3[],
  widths: number[],
): { sA: number; sB: number } | null => {
  const s = abscissas(points, false);
  let best: [number, number] | null = null;
  forEachClosePair(points, Math.max(...widths), (i, j, d2) => {
    const half = (widths[i] + widths[j]) / 2;
    if (d2 >= half * half || s[j] - s[i] <= NEIGHBOUR_RATIO * half) return;
    if (!best || i < best[0] || (i === best[0] && j < best[1])) best = [i, j];
  });
  // TypeScript ne suit pas l'affectation faite dans le rappel.
  const found = best as [number, number] | null;
  return found && { sA: s[found[0]], sB: s[found[1]] };
};

/**
 * Largeur du bas-côté en chaque point : `SHOULDER_WIDTH`, réduite de moitié du manque
 * là où deux portions non voisines n'ont pas la place pour deux bas-côtés entiers.
 */
export const shoulderWidths = (
  points: Vec3[],
  widths: number[],
  closed: boolean,
): number[] => {
  const n = points.length;
  const s = abscissas(points, closed);
  const total = s[s.length - 1];
  const shoulders = new Array<number>(n).fill(SHOULDER_WIDTH);
  let narrowed = false;
  const gap = closed ? 0 : OPEN_SHOULDER_GAP;
  forEachClosePair(
    points,
    Math.max(...widths) + 2 * (SHOULDER_WIDTH + gap),
    (i, j, d2) => {
      const half = (widths[i] + widths[j]) / 2;
      const reach = half + 2 * (SHOULDER_WIDTH + gap);
      const apart = s[j] - s[i];
      const along = closed ? Math.min(apart, total - apart) : apart;
      if (d2 >= reach * reach || along <= NEIGHBOUR_RATIO * reach) return;
      const free = Math.max(0, (Math.sqrt(d2) - half) / 2 - gap);
      if (free < shoulders[i]) shoulders[i] = free;
      if (free < shoulders[j]) shoulders[j] = free;
      narrowed = true;
    },
  );
  if (!narrowed) return shoulders;
  // ponytail: le raccord ne franchit pas la fermeture d'un tracé fermé, aucun tracé fermé ne se rétrécit aujourd'hui.
  for (let i = 1; i < n; i++)
    shoulders[i] = Math.min(
      shoulders[i],
      shoulders[i - 1] + SHOULDER_TAPER * (s[i] - s[i - 1]),
    );
  for (let i = n - 2; i >= 0; i--)
    shoulders[i] = Math.min(
      shoulders[i],
      shoulders[i + 1] + SHOULDER_TAPER * (s[i + 1] - s[i]),
    );
  return shoulders;
};
