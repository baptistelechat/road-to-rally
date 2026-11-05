"use client";

import { ArrowUpDown } from "lucide-react";
import { useMemo } from "react";
import { MapMarker, MapRoute, MarkerContent } from "@/components/ui/map";
import { STEP } from "@/geo/config";
import type { LatLon } from "@/geo/gpx";
import { toCoordinates } from "../../hover";
import { useEditor } from "../../store";

/** Une flèche double tous les tant de mètres le long de la portion roulée deux fois */
const ARROW_SPACING = 300;

const NO_POINTS: LatLon[] = [];

/** Cap en degrés, depuis le nord dans le sens horaire. */
const bearing = (a: LatLon, b: LatLon): number => {
  const east = (b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180);
  return (Math.atan2(east, b.lat - a.lat) * 180) / Math.PI;
};

/** La portion roulée dans les deux sens : sa propre couleur, et des flèches qui le disent. */
export const ReturnLayer = () => {
  const axis = useEditor((state) => state.analysis?.axis ?? null);
  const armEnd = axis?.roundTrip?.armEnd ?? 0;

  const shared = useMemo(
    () => (axis && armEnd > 0 ? axis.latLon.slice(0, armEnd + 1) : NO_POINTS),
    [axis, armEnd],
  );
  const coordinates = useMemo(() => toCoordinates(shared), [shared]);
  const arrows = useMemo(() => {
    const stride = Math.round(ARROW_SPACING / STEP);
    return shared.flatMap((position, i) =>
      i > 0 && i % stride === 0 && shared[i + 1]
        ? [{ position, rotation: bearing(shared[i - 1], shared[i + 1]) }]
        : [],
    );
  }, [shared]);

  return (
    <>
      <MapRoute
        id="return-shared"
        coordinates={coordinates}
        color="#c084fc"
        width={4}
        opacity={0.9}
        interactive={false}
      />
      {arrows.map(({ position, rotation }, i) => (
        <MapMarker
          key={i}
          longitude={position.lon}
          latitude={position.lat}
          rotation={rotation}
          rotationAlignment="map"
        >
          <MarkerContent className="pointer-events-none">
            <span className="grid size-5 place-items-center rounded-full bg-purple-600 text-foreground shadow">
              <ArrowUpDown aria-hidden="true" className="size-3.5" />
            </span>
          </MarkerContent>
        </MapMarker>
      ))}
    </>
  );
};
