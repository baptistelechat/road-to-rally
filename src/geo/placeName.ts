// Nom de la commune sous un point, pour le nom par défaut d'une spéciale : un service de confort, sans reprise bruyante.
import type { LatLon } from "./gpx";
import { requestText, type HttpOptions, type RetryPolicy } from "./http";

const REVERSE_URL = "https://data.geopf.fr/geocodage/reverse";

const POLICY: RetryPolicy = {
  service: "La recherche de lieu de la Géoplateforme",
  retries: 1,
  delay: () => 500,
  timeout: 8000,
  shouldRetry: (status) => status === 429 || status >= 500,
};

/** Réponse illisible ou point loin de toute adresse : `null`. */
export const parsePlaceName = (body: string): string | null => {
  try {
    const { features } = JSON.parse(body) as {
      features?: { properties?: { city?: unknown } }[];
    };
    const city = features?.[0]?.properties?.city;
    return typeof city === "string" && city ? city : null;
  } catch {
    return null;
  }
};

export const fetchPlaceName = async (
  { lat, lon }: LatLon,
  options: HttpOptions = {},
): Promise<string | null> => {
  const params = new URLSearchParams({
    lon: String(lon),
    lat: String(lat),
    index: "address",
    limit: "1",
  });
  return parsePlaceName(
    await requestText(`${REVERSE_URL}?${params}`, {}, POLICY, options),
  );
};
