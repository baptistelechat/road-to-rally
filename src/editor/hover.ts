// Ce que le pointeur survole sur la carte. Pur : la projection à l'écran est fournie par l'appelant.
import type { LatLon } from "@/geo/gpx";
import type { Segment } from "./types";

/** Le format de `MapRoute` : [longitude, latitude]. */
export const toCoordinates = (points: LatLon[]): [number, number][] =>
  points.map(({ lat, lon }) => [lon, lat]);

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface TraceHit {
  segmentIndex: number;
  position: LatLon;
  /** Distance au pointeur, en pixels */
  pixels: number;
}

/** Le point du tracé le plus proche du pointeur, à moins de `maxPixels`. */
// ponytail: tout le tracé à chaque mouvement, quelques milliers de points BRouter tiennent ; découper par emprise sinon.
export const nearestOnTrace = (
  segments: Segment[],
  cursor: ScreenPoint,
  toScreen: (position: LatLon) => ScreenPoint,
  maxPixels: number,
): TraceHit | null => {
  let best: TraceHit | null = null;
  segments.forEach(({ points }, segmentIndex) => {
    let a = toScreen(points[0]);
    for (let i = 1; i < points.length; i++) {
      const b = toScreen(points[i]);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t =
        len2 > 0
          ? Math.max(
              0,
              Math.min(
                1,
                ((cursor.x - a.x) * dx + (cursor.y - a.y) * dy) / len2,
              ),
            )
          : 0;
      const pixels = Math.hypot(
        a.x + dx * t - cursor.x,
        a.y + dy * t - cursor.y,
      );
      if (pixels <= maxPixels && (!best || pixels < best.pixels))
        best = {
          segmentIndex,
          pixels,
          position: {
            lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t,
            lon: points[i - 1].lon + (points[i].lon - points[i - 1].lon) * t,
          },
        };
      a = b;
    }
  });
  return best;
};

/** L'indice du point le plus proche. Sur quelques kilomètres, la latitude et la longitude se comparent à plat. */
export const nearestIndex = (points: LatLon[], position: LatLon): number => {
  const cosLat = Math.cos((position.lat * Math.PI) / 180);
  let best = 0;
  let bestDistance = Infinity;
  points.forEach(({ lat, lon }, i) => {
    const distance =
      (lat - position.lat) ** 2 + ((lon - position.lon) * cosLat) ** 2;
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
};
