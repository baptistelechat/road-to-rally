"use client";

import { useMemo } from "react";
import { MapRoute } from "@/components/ui/map";
import type { LatLon } from "@/geo/gpx";
import { toCoordinates } from "../../hover";
import { overlappingZones, zoneSpan, type AxisZone } from "../../zones";

const FREE_COLOR = "#fbbf24";
const OVERLAP_COLOR = "#ef4444";

const ZoneBand = ({
  zone,
  axis,
  overlapping,
}: {
  zone: AxisZone;
  axis: LatLon[];
  overlapping: boolean;
}) => {
  const coordinates = useMemo(() => {
    const [from, to] = zoneSpan(zone, axis.length);
    return toCoordinates(axis.slice(from, to + 1));
  }, [zone, axis]);
  return (
    <MapRoute
      id={`zone-${zone.id}`}
      coordinates={coordinates}
      color={overlapping ? OVERLAP_COLOR : FREE_COLOR}
      width={16}
      opacity={0.45}
      interactive={false}
    />
  );
};

/** Des bandes sur la route, à placer pour tout élément qui occupe une zone. Rouge : deux zones se recouvrent. */
export const AxisZones = ({
  zones,
  axis,
}: {
  zones: AxisZone[];
  axis: LatLon[];
}) => {
  const overlapping = useMemo(() => overlappingZones(zones), [zones]);
  return zones.map((zone) => (
    <ZoneBand
      key={zone.id}
      zone={zone}
      axis={axis}
      overlapping={overlapping.has(zone.id)}
    />
  ));
};
