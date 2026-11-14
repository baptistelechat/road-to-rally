"use client";

import { MapRoute } from "@/components/ui/map";
import { toCoordinates } from "../../hover";
import { MEDIAN_COLOR } from "../symbols";
import { useMedians } from "../useMedians";

/** La glissière que la spéciale posera entre les deux chaussées d'un aller-retour : on ne passe pas d'un sens à l'autre. */
export const MedianLines = () =>
  useMedians().map((barrier) => {
    // L'id MapLibre suit la clé React : tiré du premier point, il reste attaché à sa glissière.
    const key = `${barrier[0].lat},${barrier[0].lon}`;
    return (
      <MapRoute
        key={key}
        id={`median-${key}`}
        coordinates={toCoordinates(barrier)}
        color={MEDIAN_COLOR}
        width={3}
        opacity={1}
        interactive={false}
      />
    );
  });
