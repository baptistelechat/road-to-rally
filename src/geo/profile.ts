import {
  MAX_SLOPE,
  MIN_VERTICAL_RADIUS,
  PROFILE_MARGIN,
  PROFILE_MAX_ITERATIONS,
  PROFILE_MEDIAN_RADIUS,
  PROFILE_SMOOTH_RADIUS,
  STEP,
} from "./config";
import { boxSmooth, medianFilter } from "./smooth";

/** Sur un pont ou dans un tunnel, altitude interpolée entre les deux extrémités. Les bords de l'axe gardent leur valeur. */
const bridgeStructures = (
  altitudes: number[],
  structures: boolean[],
): number[] => {
  const result = [...altitudes];
  let i = 0;
  while (i < result.length) {
    if (!structures[i]) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < result.length && structures[end + 1]) end++;
    const before =
      i > 0 ? result[i - 1] : result[Math.min(end + 1, result.length - 1)];
    const after = end + 1 < result.length ? result[end + 1] : before;
    for (let k = i; k <= end; k++)
      result[k] = before + ((after - before) * (k - i + 1)) / (end - i + 2);
    i = end + 1;
  }
  return result;
};

/**
 * Pente et rayon vertical limités par petites corrections locales, chacune de norme minimale.
 * Une limite absolue qu'on écrêterait d'un seul sens ferait dériver le profil : ici les corrections s'équilibrent.
 */
const limitProfile = (input: number[]): number[] => {
  const y = [...input];
  const maxStep = MAX_SLOPE * STEP * PROFILE_MARGIN;
  const maxBend = ((STEP * STEP) / MIN_VERTICAL_RADIUS) * PROFILE_MARGIN;
  // ponytail: Gauss-Seidel sans preuve de convergence, plafonné ; le check le vérifie sur les fixtures, un solveur QP si un tracé réel y échappe.
  for (let iteration = 0; iteration < PROFILE_MAX_ITERATIONS; iteration++) {
    let clean = true;
    for (let i = 0; i + 1 < y.length; i++) {
      const rise = y[i + 1] - y[i];
      if (Math.abs(rise) <= maxStep) continue;
      clean = false;
      const excess = (rise - Math.sign(rise) * maxStep) / 2;
      y[i] += excess;
      y[i + 1] -= excess;
    }
    for (let i = 1; i + 1 < y.length; i++) {
      const bend = y[i - 1] - 2 * y[i] + y[i + 1];
      if (Math.abs(bend) <= maxBend) continue;
      clean = false;
      const excess = bend - Math.sign(bend) * maxBend;
      y[i - 1] -= excess / 6;
      y[i] += excess / 3;
      y[i + 1] -= excess / 6;
    }
    if (clean) break;
  }
  return y;
};

/** Altitudes absolutes de la route, en mètres : fidèles à la vraie pente, sans les bosses parasites du relief brut. */
export const buildProfile = (
  altitudes: number[],
  structures: boolean[],
): number[] => {
  const filtered = medianFilter(
    bridgeStructures(altitudes, structures),
    PROFILE_MEDIAN_RADIUS,
  );
  const smoothed = boxSmooth(
    boxSmooth(filtered, PROFILE_SMOOTH_RADIUS),
    PROFILE_SMOOTH_RADIUS,
  );
  return limitProfile(smoothed);
};
