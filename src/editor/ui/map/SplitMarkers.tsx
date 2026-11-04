"use client";

import { MapMarker, MarkerContent, MarkerTooltip } from "@/components/ui/map";
import { useSplits } from "../useSplits";

/**
 * Les intermédiaires du chrono, au même endroit qu'en course : un trait en travers de la route, comme sur la
 * mini-carte, et son numéro à côté. Le trait tourne avec la carte, le numéro reste droit.
 */
export const SplitMarkers = () =>
  useSplits().map(({ s, label, position, bearing = 0 }, i) => (
    <MapMarker
      key={s}
      longitude={position.lon}
      latitude={position.lat}
      rotation={bearing}
      rotationAlignment="map"
    >
      <MarkerContent className="cursor-help">
        <span className="block h-1.5 w-7 rounded-full border border-black/70 bg-white shadow" />
        <span
          className="absolute top-1/2 left-full ml-1 text-xs font-bold text-white [text-shadow:0_0_3px_black]"
          style={{ transform: `translateY(-50%) rotate(${-bearing}deg)` }}
        >
          {i + 1}
        </span>
      </MarkerContent>
      <MarkerTooltip>{label}</MarkerTooltip>
    </MapMarker>
  ));
