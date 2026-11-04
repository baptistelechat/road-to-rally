"use client";

import type { LatLon } from "@/geo/gpx";
import type {
  ProfileBand,
  ProfileBandKind,
  ProfileMarker,
} from "../profileMarkers";
import {
  ChicaneSymbol,
  MedianSymbol,
  PointSymbol,
  RoundaboutSymbol,
  StraightSymbol,
} from "./symbols";

/** Pas de graduation possibles, en mètres : le premier qui donne au plus `MAX_TICKS` traits */
const DISTANCE_STEPS = [100, 200, 500, 1000, 2000, 5000];
const MAX_TICKS = 10;
const ALTITUDE_STEPS = [5, 10, 20, 50, 100, 200, 500];
const MAX_ALTITUDE_LINES = 4;
/** Les couleurs de la carte : jaune pour la place d'une chicane, vert pour la ligne droite */
const BAND_COLORS: Record<ProfileBandKind, string> = {
  straight: "bg-green-500/20",
  chicane: "bg-amber-400/25",
  roundabout: "bg-red-500/25",
  rock: "bg-stone-400/35",
  median: "bg-pink-400/25",
};

/** Repère au centre de sa bande, en haut : la rangée du bas est celle des points et des chicanes. */
const BandIcon = ({ kind }: { kind: ProfileBandKind }) => {
  const place = "absolute top-5 left-1/2 -translate-x-1/2";
  if (kind === "straight")
    return (
      <span className={place}>
        <StraightSymbol size="sm" />
      </span>
    );
  if (kind === "roundabout" || kind === "rock")
    return (
      <span className={place}>
        <RoundaboutSymbol rock={kind === "rock"} />
      </span>
    );
  if (kind === "median")
    return (
      <span className={place}>
        <MedianSymbol />
      </span>
    );
  return null;
};

const pick = (steps: number[], span: number, max: number): number =>
  steps.find((step) => span / step <= max) ?? steps[steps.length - 1];

const km = (meters: number): string =>
  meters >= 1000 || meters === 0
    ? `${(meters / 1000).toFixed(meters % 1000 ? 1 : 0).replace(".", ",")} km`
    : `${meters} m`;

export interface ElevationMarksProps {
  startS: number;
  finishS: number;
  minAltitude: number;
  maxAltitude: number;
  /** Position horizontale d'une abscisse, en % de la largeur */
  xPercent: (s: number) => number;
  /** Position verticale d'une altitude, en % de la hauteur */
  yPercent: (altitude: number) => number;
  markers: ProfileMarker[];
  bands: ProfileBand[];
  onFocus: (position: LatLon) => void;
}

/** Graduations et repères, en HTML par-dessus la courbe : le SVG étiré déformerait le texte. */
export const ElevationMarks = ({
  startS,
  finishS,
  minAltitude,
  maxAltitude,
  xPercent,
  yPercent,
  markers,
  bands,
  onFocus,
}: ElevationMarksProps) => {
  const length = finishS - startS;
  const distanceStep = pick(DISTANCE_STEPS, length, MAX_TICKS);
  const distances = Array.from(
    { length: Math.floor(length / distanceStep) + 1 },
    (_, i) => i * distanceStep,
  );
  const altitudeStep = pick(
    ALTITUDE_STEPS,
    maxAltitude - minAltitude,
    MAX_ALTITUDE_LINES,
  );
  const altitudes: number[] = [];
  for (
    let a = Math.ceil(minAltitude / altitudeStep) * altitudeStep;
    a <= maxAltitude;
    a += altitudeStep
  )
    altitudes.push(a);

  const markerButton =
    "pointer-events-auto absolute -translate-x-1/2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <>
      {altitudes.map((a) => (
        <div
          key={`alt-${a}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-neutral-100/15"
          style={{ top: `${yPercent(a)}%` }}
        >
          <span className="absolute -top-2 left-1 text-[10px] text-neutral-400 tabular-nums">
            {a} m
          </span>
        </div>
      ))}
      {distances.map((d) => (
        <div
          key={`km-${d}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 border-l border-neutral-100/15"
          style={{ left: `${xPercent(startS + d)}%` }}
        >
          <span className="absolute top-full mt-0.5 -translate-x-1/2 text-[10px] whitespace-nowrap text-neutral-400 tabular-nums">
            {km(d)}
          </span>
        </div>
      ))}
      {bands.map((band) => (
        <button
          key={`${band.label}-${band.fromS}`}
          type="button"
          title={`${band.label}, ${km(Math.round(band.fromS - startS))}`}
          aria-label={`${band.label} à ${km(Math.round(band.fromS - startS))}, voir sur la carte`}
          onClick={() => onFocus(band.position)}
          className={`pointer-events-auto absolute inset-y-0 min-w-1 ${BAND_COLORS[band.kind]} focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
          style={{
            left: `${xPercent(band.fromS)}%`,
            width: `${xPercent(band.toS) - xPercent(band.fromS)}%`,
          }}
        >
          <BandIcon kind={band.kind} />
        </button>
      ))}
      {markers.map((marker) => {
        const at = km(Math.max(0, Math.round(marker.s - startS)));
        // L'intermédiaire coupe la courbe sur toute sa hauteur, comme les lignes : son repère en haut, sous « Départ ».
        if (marker.kind === "split")
          return (
            <button
              key={`${marker.kind}-${marker.label}`}
              type="button"
              title={`${marker.label}, ${at}`}
              aria-label={`${marker.label} à ${at}, voir sur la carte`}
              onClick={() => onFocus(marker.position)}
              className={`${markerButton} inset-y-0 w-4`}
              style={{ left: `${xPercent(marker.s)}%` }}
            >
              {/* Le trait traverse déjà le profil comme la route sur la carte : seul le numéro s'y ajoute. */}
              <span className="absolute inset-y-0 left-1/2 border-l-2 border-dashed border-white/80" />
              <span className="absolute top-4 left-1/2 ml-1 text-xs font-bold text-white [text-shadow:0_0_3px_black]">
                {marker.label.replace("Intermédiaire ", "")}
              </span>
            </button>
          );
        return (
          <button
            key={`${marker.kind}-${marker.label}`}
            type="button"
            title={`${marker.label}, ${at}`}
            aria-label={`${marker.label} à ${at}, voir sur la carte`}
            onClick={() => onFocus(marker.position)}
            className={`${markerButton} bottom-1 rounded-full`}
            style={{ left: `${xPercent(marker.s)}%` }}
          >
            {marker.kind === "point" ? (
              <PointSymbol
                rank={marker.label.replace("Point ", "")}
                size="sm"
              />
            ) : (
              <ChicaneSymbol
                side={marker.side ?? "left"}
                player={marker.player}
                size="sm"
              />
            )}
          </button>
        );
      })}
    </>
  );
};
