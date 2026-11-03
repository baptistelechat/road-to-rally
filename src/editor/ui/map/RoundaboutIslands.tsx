"use client";

import { useMemo } from "react";
import { MapRoute } from "@/components/ui/map";
import { unproject, type LatLon } from "@/geo/gpx";
import { toCoordinates } from "../../hover";
import { useEditor } from "../../store";

/** Points par cercle : un îlot de 80 m garde un contour lisse. */
const SIDES = 48;

const IslandRing = ({
  id,
  position,
  radius,
}: {
  id: string;
  position: LatLon;
  radius: number;
}) => {
  const coordinates = useMemo(
    () =>
      toCoordinates(
        Array.from({ length: SIDES + 1 }, (_, i) => {
          const angle = (i * 2 * Math.PI) / SIDES;
          return unproject(
            { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius },
            position,
          );
        }),
      ),
    [position, radius],
  );
  return (
    <MapRoute
      id={id}
      coordinates={coordinates}
      color="#ef4444"
      width={3}
      opacity={1}
      dashArray={[2, 1]}
      interactive={false}
    />
  );
};

/** La barrière que la spéciale posera au centre de chaque rond-point roulé : on ne coupe pas par là. */
export const RoundaboutIslands = () => {
  const roundabouts = useEditor((state) => state.analysis?.roundabouts);
  return roundabouts?.map(({ position, radius }, i) => (
    <IslandRing
      key={`${position.lat},${position.lon}`}
      id={`island-${i}`}
      position={position}
      radius={radius}
    />
  ));
};
