"use client";

import { Flag } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerLabel,
  useMap,
} from "@/components/ui/map";
import type { LatLon } from "@/geo/gpx";
import { toCoordinates } from "../../hover";
import { axisIndex, useEditor } from "../../store";
import { assembleTrace, inventedEnds } from "../../trace";

const NO_POINTS: LatLon[] = [];

/** Hachures : des tirets très courts sur un trait large, à bouts droits, soit des rayures en travers de la route. */
const HatchedRoute = ({ id, points }: { id: string; points: LatLon[] }) => {
  const { map, isLoaded } = useMap();
  const coordinates = useMemo(() => toCoordinates(points), [points]);

  // Après l'effet de `MapRoute`, qui crée la couche : les effets d'un parent passent après ceux de ses enfants.
  useEffect(() => {
    const layer = `route-layer-${id}`;
    if (isLoaded && map?.getLayer(layer))
      map.setLayoutProperty(layer, "line-cap", "butt");
  }, [id, isLoaded, map]);

  return (
    <MapRoute
      id={id}
      coordinates={coordinates}
      color="#e5e5e5"
      width={10}
      opacity={0.9}
      dashArray={[0.25, 0.35]}
      interactive={false}
    />
  );
};

const LineFlag = ({ position, label }: { position: LatLon; label: string }) => (
  // Au-dessus de la ligne et sans prise : le drapeau tombe pile sur le premier ou le dernier point, qu'il ne doit ni cacher ni bloquer.
  <MapMarker
    longitude={position.lon}
    latitude={position.lat}
    offset={[0, -26]}
    className="pointer-events-none"
  >
    <MarkerContent className="cursor-default">
      <span className="grid size-6 place-items-center rounded-full border border-white bg-neutral-900 text-white shadow-md">
        <Flag aria-hidden="true" className="size-3.5" />
      </span>
      <MarkerLabel className="rounded bg-neutral-900 px-1 text-white">
        {label}
      </MarkerLabel>
    </MarkerContent>
  </MapMarker>
);

/** Le tracé et l'axe analysé : la route réelle en large, l'axe qui sera roulé en fin par-dessus. */
export const TraceLayers = () => {
  const trace = useEditor((state) => state.history.present);
  const axis = useEditor((state) => state.analysis?.axis ?? null);
  const straight = useEditor((state) =>
    state.highlightStraight ? state.stats?.longestStraight : undefined,
  );

  // Une ligne droite provisoire n'est jamais montrée : la carte ne dessine pas une route qui n'existe pas.
  const ends = useMemo(() => inventedEnds(trace), [trace]);
  const route = useMemo(() => {
    const points = assembleTrace(trace);
    return toCoordinates(
      points.slice(
        ends.before ? 1 : 0,
        ends.after ? points.length - 1 : points.length,
      ),
    );
  }, [trace, ends]);
  const rolled = useMemo(() => {
    if (!axis) return toCoordinates(NO_POINTS);
    const { latLon, runoffPoints } = axis;
    return toCoordinates(
      latLon.slice(
        ends.before ? runoffPoints : 0,
        ends.after ? latLon.length - runoffPoints : latLon.length,
      ),
    );
  }, [axis, ends]);
  const [before, after] = useMemo(() => {
    if (!axis) return [NO_POINTS, NO_POINTS];
    const { latLon, runoffPoints } = axis;
    return [
      ends.before ? NO_POINTS : latLon.slice(0, runoffPoints + 1),
      ends.after ? NO_POINTS : latLon.slice(latLon.length - 1 - runoffPoints),
    ];
  }, [axis, ends]);
  const straightLine = useMemo(() => {
    if (!axis || !straight) return toCoordinates(NO_POINTS);
    const count = axis.latLon.length;
    return toCoordinates(
      axis.latLon.slice(
        axisIndex(straight.fromS, count),
        axisIndex(straight.toS, count) + 1,
      ),
    );
  }, [axis, straight]);

  return (
    <>
      <MapRoute
        id="trace"
        coordinates={route}
        color="#38bdf8"
        width={7}
        opacity={0.55}
        interactive={false}
      />
      <MapRoute
        id="axis"
        coordinates={rolled}
        color="#f8fafc"
        width={2}
        opacity={1}
        interactive={false}
      />
      <HatchedRoute id="runoff-before" points={before} />
      <HatchedRoute id="runoff-after" points={after} />
      <MapRoute
        id="straight"
        coordinates={straightLine}
        color="#fbbf24"
        width={6}
        opacity={1}
        interactive={false}
      />
      {axis &&
        (axis.roundTrip ? (
          // L'arrivée recopie le départ : deux drapeaux au même endroit seraient illisibles.
          <LineFlag
            position={axis.latLon[axis.runoffPoints]}
            label="Départ et arrivée"
          />
        ) : (
          <>
            <LineFlag
              position={axis.latLon[axis.runoffPoints]}
              label="Départ"
            />
            <LineFlag
              position={axis.latLon[axis.latLon.length - 1 - axis.runoffPoints]}
              label="Arrivée"
            />
          </>
        ))}
    </>
  );
};
