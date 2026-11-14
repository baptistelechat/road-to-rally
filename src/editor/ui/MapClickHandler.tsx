"use client";

import type { MapMouseEvent } from "maplibre-gl";
import { useEffect } from "react";
import { useMap } from "@/components/ui/map";
import type { LatLon } from "@/geo/gpx";
import { ZONE_LAYER_PREFIX } from "./map/AxisZones";

interface MapClickHandlerProps {
  /** À stabiliser avec `useCallback` : un nouveau callback réabonne la carte */
  onMapClick: (position: LatLon) => void;
}

/** Un clic à moins de cette distance du centre d'un marqueur, en pixels, le visait : il ne crée rien. */
const MARKER_MARGIN = 22;

const nearMarker = (container: HTMLElement, x: number, y: number): boolean =>
  [...container.querySelectorAll(".maplibregl-marker")].some((marker) => {
    const box = marker.getBoundingClientRect();
    return (
      Math.hypot(box.left + box.width / 2 - x, box.top + box.height / 2 - y) <
      MARKER_MARGIN
    );
  });

/** À placer dans `Map`. Le fond de carte seul : la recherche et les contrôles sont hors du canevas. */
export const MapClickHandler = ({ onMapClick }: MapClickHandlerProps) => {
  const { map } = useMap();

  useEffect(() => {
    if (!map) return;
    // Lu à l'appui : au clic, MapLibre a peut-être déjà fermé le menu.
    let menuOpen = false;
    const handleDown = (): void => {
      menuOpen = map.getContainer().querySelector(".maplibregl-popup") !== null;
    };
    const handleClick = ({ lngLat, point, originalEvent }: MapMouseEvent) => {
      // Un clic dans le vide ferme le menu d'un point ou d'une chicane, sans rien poser.
      if (menuOpen) return;
      // Un marqueur vit dans le conteneur du canevas : sans ce filtre, cliquer dessus poserait aussi un point.
      const { target } = originalEvent;
      if (target instanceof Element && target.closest(".maplibregl-marker"))
        return;
      // Une bande de chicane a sa propre action : ouvrir le menu.
      if (
        map
          .queryRenderedFeatures(point)
          .some(({ layer }) => layer.id.startsWith(ZONE_LAYER_PREFIX))
      )
        return;
      if (
        originalEvent instanceof MouseEvent &&
        nearMarker(
          map.getCanvasContainer(),
          originalEvent.clientX,
          originalEvent.clientY,
        )
      )
        return;
      onMapClick({ lat: lngLat.lat, lon: lngLat.lng });
    };
    map.on("mousedown", handleDown);
    map.on("touchstart", handleDown);
    map.on("click", handleClick);
    return () => {
      map.off("mousedown", handleDown);
      map.off("touchstart", handleDown);
      map.off("click", handleClick);
    };
  }, [map, onMapClick]);

  return null;
};
