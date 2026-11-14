"use client";

import { useMemo } from "react";
import { MapRoute } from "@/components/ui/map";
import { unproject, type LatLon } from "@/geo/gpx";
import { isRock } from "@/geo/roundabouts";
import { toCoordinates } from "../../hover";
import { useEditor } from "../../store";

/** Points par cercle : un îlot de 80 m garde un contour lisse. */
const SIDES = 48;
/** Rayon dessiné d'un rocher, en mètres : à sa vraie taille, il disparaîtrait sous le trait du tracé */
const ROCK_DRAWN_RADIUS = 1.5;

const IslandRing = ({
  id,
  position,
  radius,
}: {
  id: string;
  position: LatLon;
  radius: number;
}) => {
  const rock = isRock(radius);
  const drawn = rock ? ROCK_DRAWN_RADIUS : radius;
  const coordinates = useMemo(
    () =>
      toCoordinates(
        Array.from({ length: SIDES + 1 }, (_, i) => {
          const angle = (i * 2 * Math.PI) / SIDES;
          return unproject(
            { x: Math.cos(angle) * drawn, z: Math.sin(angle) * drawn },
            position,
          );
        }),
      ),
    [position, drawn],
  );
  return (
    <MapRoute
      id={id}
      coordinates={coordinates}
      color={rock ? "#a8a29e" : "#ef4444"}
      width={rock ? 5 : 3}
      opacity={1}
      dashArray={rock ? undefined : [2, 1]}
      interactive={false}
    />
  );
};

/** La barrière, ou le rocher d'un petit giratoire, que la spéciale posera au centre de chaque rond-point roulé : on ne coupe pas par là. */
export const RoundaboutIslands = () => {
  const roundabouts = useEditor((state) => state.analysis?.roundabouts);
  // L'id MapLibre suit la clé React : tiré de l'index, il passerait d'un îlot à l'autre dès qu'un rond-point s'insère avant.
  return roundabouts?.map(({ position, radius }) => {
    const key = `${position.lat},${position.lon}`;
    return (
      <IslandRing
        key={key}
        id={`island-${key}`}
        position={position}
        radius={radius}
      />
    );
  });
};
