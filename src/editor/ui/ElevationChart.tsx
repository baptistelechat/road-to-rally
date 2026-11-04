"use client";

import { useId, useMemo, type PointerEvent } from "react";
import type { LatLon } from "@/geo/gpx";
import { elevationStats } from "@/geo/previewProfile";
import type { ProfileBand, ProfileMarker } from "../profileMarkers";
import { ElevationMarks } from "./ElevationMarks";

export interface ElevationChartProps {
  /** Abscisse de chaque point, croissante, prolongement compris, en mètres */
  abscissas: number[];
  /** Altitude de chaque point, en mètres */
  altitudes: number[];
  startS: number;
  finishS: number;
  /** Abscisse du curseur, `null` s'il est caché */
  cursorS: number | null;
  /** Abscisse survolée, `null` quand le pointeur quitte le graphique */
  onHover: (s: number | null) => void;
  /** Points et chicanes, posés en pied de courbe */
  markers?: ProfileMarker[];
  /** Ronds-points, une bande par passage */
  bands?: ProfileBand[];
  /** Clic sur un repère : la carte va le montrer */
  onFocus?: (position: LatLon) => void;
  /** Mise en page uniquement */
  className?: string;
}

const WIDTH = 1000;
const HEIGHT = 200;
/** Marge haute et basse de la courbe, en unités du graphique */
const PADDING = 16;
/** Écart d'altitude minimal à l'échelle, en mètres : une route plate ne doit pas ressembler à un col */
const MIN_RANGE = 20;
const NO_MARKERS: ProfileMarker[] = [];
const NO_BANDS: ProfileBand[] = [];
const ignore = (): void => {};

const decimal = (value: number, digits: number): string =>
  value.toFixed(digits).replace(".", ",");

const describe = (
  altitudes: number[],
  from: number,
  to: number,
  length: number,
): string => {
  const stats = elevationStats(altitudes, from, to);
  return (
    `Spéciale de ${decimal(length / 1000, 1)} km, ` +
    `altitude de ${Math.round(stats.minAltitude)} à ${Math.round(stats.maxAltitude)} m, ` +
    `${Math.round(stats.ascent)} m de montée et ${Math.round(stats.descent)} m de descente, ` +
    `pente maximale de ${Math.round(stats.maxSlope * 100)} %.`
  );
};

/** Profil d'altitude : tout est mémorisé, seul le curseur suit la souris. */
export const ElevationChart = ({
  abscissas,
  altitudes,
  startS,
  finishS,
  cursorS,
  onHover,
  markers = NO_MARKERS,
  bands = NO_BANDS,
  onFocus = ignore,
  className,
}: ElevationChartProps) => {
  const summaryId = useId();
  const first = abscissas[0];
  const span = abscissas[abscissas.length - 1] - first;

  const { xOf, yOf, min, max } = useMemo(() => {
    const min = Math.min(...altitudes);
    const max = Math.max(...altitudes);
    const range = Math.max(max - min, MIN_RANGE);
    return {
      min,
      max,
      xOf: (s: number): number => ((s - first) / span) * WIDTH,
      yOf: (altitude: number): number =>
        HEIGHT - PADDING - ((altitude - min) / range) * (HEIGHT - 2 * PADDING),
    };
  }, [altitudes, first, span]);

  const summary = useMemo(() => {
    const from = abscissas.findIndex((s) => s >= startS);
    const to = abscissas.findLastIndex((s) => s <= finishS);
    return describe(altitudes, from, to, finishS - startS);
  }, [abscissas, altitudes, startS, finishS]);

  const drawing = useMemo(() => {
    const line = altitudes
      .map(
        (z, i) =>
          `${i ? "L" : "M"}${xOf(abscissas[i]).toFixed(1)} ${yOf(z).toFixed(1)}`,
      )
      .join("");
    const startX = xOf(startS);
    const finishX = xOf(finishS);
    return (
      <>
        <path
          d={`${line}L${WIDTH} ${HEIGHT}L0 ${HEIGHT}Z`}
          className="fill-sky-400/20"
        />
        <path
          d={line}
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-sky-300 stroke-2"
        />
        {/* Zones de dégagement */}
        <rect
          x={0}
          y={0}
          width={startX}
          height={HEIGHT}
          className="fill-neutral-900/60"
        />
        <rect
          x={finishX}
          y={0}
          width={WIDTH - finishX}
          height={HEIGHT}
          className="fill-neutral-900/60"
        />
        {[startX, finishX].map((x) => (
          <line
            key={x}
            x1={x}
            x2={x}
            y1={0}
            y2={HEIGHT}
            vectorEffect="non-scaling-stroke"
            className="stroke-neutral-100"
          />
        ))}
      </>
    );
  }, [abscissas, altitudes, startS, finishS, xOf, yOf]);

  const handleMove = (event: PointerEvent<HTMLDivElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - box.left) / box.width),
    );
    onHover(first + ratio * span);
  };

  // Le curseur peut venir de la carte : on le pose sur le point de l'axe le plus proche devant lui.
  const cursorIndex =
    cursorS === null ? -1 : abscissas.findIndex((s) => s >= cursorS);

  return (
    <figure className={className}>
      <div
        className="relative mb-4 h-32 w-full"
        onPointerMove={handleMove}
        onPointerLeave={() => onHover(null)}
      >
        <svg
          role="img"
          aria-label="Profil d'altitude de la spéciale"
          aria-describedby={summaryId}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="block size-full"
        >
          {drawing}
        </svg>
        <ElevationMarks
          startS={startS}
          finishS={finishS}
          minAltitude={min}
          maxAltitude={max}
          xPercent={(s) => (xOf(s) / WIDTH) * 100}
          yPercent={(altitude) => (yOf(altitude) / HEIGHT) * 100}
          markers={markers}
          bands={bands}
          onFocus={onFocus}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 pl-1 text-xs text-neutral-100"
          style={{ left: `${(xOf(startS) / WIDTH) * 100}%` }}
        >
          Départ
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 -translate-x-full pr-1 text-xs text-neutral-100"
          style={{ left: `${(xOf(finishS) / WIDTH) * 100}%` }}
        >
          Arrivée
        </span>
        {cursorIndex >= 0 && (
          <div
            aria-hidden="true"
            data-testid="elevation-cursor"
            className="pointer-events-none absolute inset-y-0 w-px bg-amber-300"
            style={{ left: `${(xOf(abscissas[cursorIndex]) / WIDTH) * 100}%` }}
          >
            <span
              className="absolute size-2 -translate-1/2 rounded-full bg-amber-300"
              style={{
                top: `${(yOf(altitudes[cursorIndex]) / HEIGHT) * 100}%`,
              }}
            />
          </div>
        )}
      </div>
      <figcaption id={summaryId} className="sr-only">
        {summary} Les zones de dégagement sont grisées, les ronds-points en rouge, les rochers en gris
        et les chicanes en triangles ambrés. Distances depuis le départ.
      </figcaption>
    </figure>
  );
};
