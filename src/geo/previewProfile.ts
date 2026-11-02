// Profil d'altitude de l'éditeur : l'IGN tous les 20 m, puis le même filtre que le pipeline (story 3.5).
import { IGN_NO_DATA, PREVIEW_ALTITUDE_SPACING, STEP } from "./config";
import { unproject, type LatLon, type PlanePoint } from "./gpx";
import { throwIfAborted, type HttpOptions } from "./http";
import { assertCovered, fetchAltitudes } from "./ign";
import { buildProfile } from "./profile";

export interface ElevationStats {
  /** Pente la plus forte, montée ou descente, vertical / horizontal */
  maxSlope: number;
  minAltitude: number;
  maxAltitude: number;
  /** Dénivelés cumulés positif et négatif, en mètres, tous deux positifs */
  ascent: number;
  descent: number;
}

export interface PreviewProfile extends ElevationStats {
  /** Abscisse horizontale de chaque point de l'axe, prolongement compris, en mètres */
  abscissas: number[];
  /** Altitude absolue de la route lissée, un point par point de l'axe, en mètres */
  altitudes: number[];
  /** Abscisses des lignes de départ et d'arrivée. Les statistiques ne comptent que ce qui est entre les deux. */
  startS: number;
  finishS: number;
}

export interface PreviewProfileOptions extends HttpOptions {
  /** Nombre de points de prolongement à chaque bout de l'axe */
  runoffPoints: number;
}

/** Indices des points à demander à l'IGN : un tous les 20 m, plus toujours le dernier. */
export const previewSampleIndices = (pointCount: number): number[] => {
  const stride = Math.round(PREVIEW_ALTITUDE_SPACING / STEP);
  const indices: number[] = [];
  for (let i = 0; i < pointCount - 1; i += stride) indices.push(i);
  indices.push(pointCount - 1);
  return indices;
};

/** Mesures sur les points `from` à `to` compris d'un profil à 2 m. */
export const elevationStats = (
  altitudes: number[],
  from: number,
  to: number,
): ElevationStats => {
  const stats: ElevationStats = {
    maxSlope: 0,
    minAltitude: altitudes[from],
    maxAltitude: altitudes[from],
    ascent: 0,
    descent: 0,
  };
  for (let i = from + 1; i <= to; i++) {
    const rise = altitudes[i] - altitudes[i - 1];
    if (rise > 0) stats.ascent += rise;
    else stats.descent -= rise;
    stats.maxSlope = Math.max(stats.maxSlope, Math.abs(rise) / STEP);
    stats.minAltitude = Math.min(stats.minAltitude, altitudes[i]);
    stats.maxAltitude = Math.max(stats.maxAltitude, altitudes[i]);
  }
  return stats;
};

/** À 2 m, comme le filtre l'attend. Un trou de l'IGN se propage au lieu de se mélanger à une vraie altitude. */
const interpolate = (samples: number[], indices: number[]): number[] => {
  const result = new Array<number>(indices[indices.length - 1] + 1);
  for (let k = 0; k + 1 < samples.length; k++) {
    const from = indices[k];
    const to = indices[k + 1];
    const hole = samples[k] === IGN_NO_DATA || samples[k + 1] === IGN_NO_DATA;
    for (let i = from; i < to; i++)
      result[i] = hole
        ? IGN_NO_DATA
        : samples[k] +
          ((samples[k + 1] - samples[k]) * (i - from)) / (to - from);
  }
  result[result.length - 1] = samples[samples.length - 1];
  return result;
};

/**
 * Pure. Les ponts restent inconnus ici, faute de données OSM : le profil suit le relief, sur un viaduc comme ailleurs.
 * Lève le refus « hors de France » si l'IGN n'a pas couvert un des points.
 */
export const buildPreviewProfile = (
  altitudes20m: number[],
  pointCount: number,
  runoffPoints: number,
): PreviewProfile => {
  const indices = previewSampleIndices(pointCount);
  if (altitudes20m.length !== indices.length)
    throw new Error(
      `${altitudes20m.length} altitudes pour ${indices.length} points demandés.`,
    );
  const raw = interpolate(altitudes20m, indices);
  assertCovered(raw, runoffPoints);
  const altitudes = buildProfile(
    raw,
    new Array<boolean>(pointCount).fill(false),
  );
  const finish = pointCount - 1 - runoffPoints;
  return {
    abscissas: altitudes.map((_, i) => i * STEP),
    altitudes,
    startS: runoffPoints * STEP,
    finishS: finish * STEP,
    ...elevationStats(altitudes, runoffPoints, finish),
  };
};

/** Annulable : une réponse arrivée après l'annulation est refusée, elle ne remplace donc jamais une plus récente. */
export const fetchPreviewProfile = async (
  axis: PlanePoint[],
  origin: LatLon,
  options: PreviewProfileOptions,
): Promise<PreviewProfile> => {
  const altitudes = await fetchAltitudes(
    previewSampleIndices(axis.length).map((i) => unproject(axis[i], origin)),
    options,
  );
  throwIfAborted(options.signal);
  return buildPreviewProfile(altitudes, axis.length, options.runoffPoints);
};
