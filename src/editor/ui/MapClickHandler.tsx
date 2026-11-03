"use client";

import type { MapMouseEvent } from "maplibre-gl";
import { useEffect } from "react";
import { useMap } from "@/components/ui/map";
import type { LatLon } from "@/geo/gpx";

interface MapClickHandlerProps {
  /** À stabiliser avec `useCallback` : un nouveau callback réabonne la carte */
  onMapClick: (position: LatLon) => void;
}

/** À placer dans `Map`. Le fond de carte seul : la recherche et les contrôles sont hors du canevas. */
export const MapClickHandler = ({ onMapClick }: MapClickHandlerProps) => {
  const { map } = useMap();

  useEffect(() => {
    if (!map) return;
    const handleClick = ({ lngLat, originalEvent }: MapMouseEvent) => {
      // Un marqueur vit dans le conteneur du canevas : sans ce filtre, cliquer dessus poserait aussi un point.
      const { target } = originalEvent;
      if (target instanceof Element && target.closest(".maplibregl-marker"))
        return;
      onMapClick({ lat: lngLat.lat, lon: lngLat.lng });
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, onMapClick]);

  return null;
};
