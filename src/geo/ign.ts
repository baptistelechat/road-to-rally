import {
  IGN_BATCH_SIZE,
  IGN_MAX_RETRIES,
  IGN_NO_DATA,
  IGN_RESOURCE,
  IGN_RETRY_DELAY,
  IGN_TIMEOUT,
  IGN_URL,
  STEP,
} from "./config";
import { StageError, formatKm } from "./errors";
import type { LatLon } from "./gpx";
import { requestText, type HttpOptions, type RetryPolicy } from "./http";

const POLICY: RetryPolicy = {
  service: "Le service d'altitude de l'IGN",
  retries: IGN_MAX_RETRIES,
  delay: (attempt) => IGN_RETRY_DELAY * 2 ** attempt,
  timeout: IGN_TIMEOUT,
  shouldRetry: (status) => status === 429 || status >= 500,
};

/** `-99999` passerait pour une altitude : le refus vit ici pour le réseau comme pour un cache rejoué. */
export const assertCovered = (
  altitudes: number[],
  runoffPoints: number,
): void => {
  const index = altitudes.indexOf(IGN_NO_DATA);
  if (index >= 0)
    throw new StageError(
      "outOfFrance",
      `Ce tracé sort de France (${formatKm((index - runoffPoints) * STEP)}) : le relief de l'IGN n'y est pas disponible.`,
    );
};

const parseElevations = (body: string, expected: number): number[] => {
  let elevations: unknown;
  try {
    elevations = (JSON.parse(body) as { elevations?: unknown }).elevations;
  } catch {
    elevations = undefined;
  }
  if (
    !Array.isArray(elevations) ||
    elevations.length !== expected ||
    !elevations.every((z) => typeof z === "number" && Number.isFinite(z))
  )
    throw new StageError(
      "service",
      "Le service d'altitude de l'IGN a renvoyé une réponse illisible. Réessaie dans un moment.",
    );
  return elevations as number[];
};

/** Altitudes brutes dans l'ordre des points. Requêtes une par une : le débit réel du service n'est pas clair. */
export const fetchAltitudes = async (
  points: LatLon[],
  options: HttpOptions,
): Promise<number[]> => {
  const altitudes: number[] = [];
  for (let start = 0; start < points.length; start += IGN_BATCH_SIZE) {
    const batch = points.slice(start, start + IGN_BATCH_SIZE);
    const body = await requestText(
      IGN_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lon: batch.map((p) => p.lon.toFixed(7)).join("|"),
          lat: batch.map((p) => p.lat.toFixed(7)).join("|"),
          resource: IGN_RESOURCE,
          // La chaîne, pas le booléen : le service refuse un booléen JSON en erreur 400.
          zonly: "true",
        }),
      },
      POLICY,
      options,
    );
    altitudes.push(...parseElevations(body, batch.length));
  }
  return altitudes;
};
