// Recherche de lieu par la Géoplateforme : adresses et communes de la BAN, plus les lieux-dits comme les cols.
import { StageError } from "./errors";
import type { LatLon } from "./gpx";
import { requestText, type HttpOptions, type RetryPolicy } from "./http";

const GEOCODE_URL = "https://data.geopf.fr/geocodage/search";
const GEOCODE_LIMIT = 5;
/** En dessous, le service répond par une erreur */
export const GEOCODE_MIN_LENGTH = 3;

const POLICY: RetryPolicy = {
  service: "La recherche de lieu de la Géoplateforme",
  retries: 1,
  delay: () => 500,
  timeout: 8000,
  shouldRetry: (status) => status === 429 || status >= 500,
};

export interface GeocodeResult {
  label: string;
  position: LatLon;
}

interface GeocodeFeature {
  geometry?: { coordinates?: unknown };
  properties?: { label?: unknown; toponym?: unknown; city?: unknown };
}

/** Une adresse a un `label` ; un lieu-dit n'a qu'un nom et une liste de communes. */
const featureLabel = ({ properties }: GeocodeFeature): string | null => {
  if (typeof properties?.label === "string") return properties.label;
  if (typeof properties?.toponym !== "string") return null;
  const city = Array.isArray(properties.city) ? properties.city[0] : null;
  return typeof city === "string"
    ? `${properties.toponym} (${city})`
    : properties.toponym;
};

/** Le service reste une source externe : une entrée incomplète est ignorée. */
export const parseGeocode = (body: string): GeocodeResult[] => {
  let features: unknown;
  try {
    features = (JSON.parse(body) as { features?: unknown }).features;
  } catch {
    features = null;
  }
  if (!Array.isArray(features))
    throw new StageError(
      "service",
      `${POLICY.service} a renvoyé une réponse illisible. Réessaie dans un moment.`,
    );
  return (features as GeocodeFeature[]).flatMap((feature) => {
    const label = featureLabel(feature);
    const coordinates = feature.geometry?.coordinates;
    if (!label || !Array.isArray(coordinates)) return [];
    const [lon, lat] = coordinates;
    if (typeof lon !== "number" || typeof lat !== "number") return [];
    return [{ label, position: { lat, lon } }];
  });
};

export const searchPlaces = async (
  query: string,
  options: HttpOptions = {},
): Promise<GeocodeResult[]> => {
  const params = new URLSearchParams({
    q: query,
    index: "address,poi",
    limit: String(GEOCODE_LIMIT),
  });
  const body = await requestText(
    `${GEOCODE_URL}?${params}`,
    {},
    POLICY,
    options,
  );
  return parseGeocode(body);
};
