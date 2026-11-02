"use client";

import { MapMarker, MarkerContent } from "@/components/ui/map";
import { axisIndex, useEditor } from "../../store";

/** Repère sur la carte de l'abscisse survolée, depuis le graphique ou le tracé. */
export const HoverMarker = () => {
  const position = useEditor((state) => {
    const axis = state.analysis?.axis;
    if (!axis || state.hoverS === null) return null;
    return axis.latLon[axisIndex(state.hoverS, axis.latLon.length)];
  });
  if (!position) return null;
  return (
    <MapMarker longitude={position.lon} latitude={position.lat}>
      <MarkerContent className="pointer-events-none">
        <span className="block size-3 rounded-full border-2 border-neutral-900 bg-amber-300" />
      </MarkerContent>
    </MapMarker>
  );
};
