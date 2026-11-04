"use client";

import { useState, type ReactNode } from "react";
import { Map as MapView, MapControls } from "@/components/ui/map";
import type { LatLon } from "@/geo/gpx";
import { BasemapSwitch } from "./map/BasemapSwitch";
import { BasemapTuning } from "./map/BasemapTuning";
import {
  BASEMAP_STYLES,
  readBasemap,
  writeBasemap,
  BasemapContext,
  type BasemapId,
} from "./map/basemaps";
import { MapClickHandler } from "./MapClickHandler";
import { PlaceSearch } from "./PlaceSearch";

/** La France entière à l'ouverture, en [longitude, latitude] */
const FRANCE_CENTER: [number, number] = [2.5, 46.6];
const FRANCE_ZOOM = 5;

interface EditorMapProps {
  onMapClick?: (position: LatLon) => void;
  children?: ReactNode;
}

export const EditorMap = ({ onMapClick, children }: EditorMapProps) => {
  const [basemap, setBasemap] = useState<BasemapId>(readBasemap);

  return (
    <MapView
      // Le panneau reste sombre : `theme` ne fait que désigner l'entrée de `styles`.
      theme="dark"
      styles={{ dark: BASEMAP_STYLES[basemap] }}
      center={FRANCE_CENTER}
      zoom={FRANCE_ZOOM}
      // Replié, le crédit des tuiles disparaîtrait au premier déplacement de la carte.
      attributionControl={{ compact: false }}
      // Le clic droit pose une chicane : il ne doit pas aussi faire tourner la carte.
      dragRotate={false}
      // Au-delà de 3 px, MapLibre y voit un clic : une main qui déplace la carte posait un point.
      clickTolerance={8}
    >
      <BasemapTuning basemap={basemap} />
      <PlaceSearch />
      <BasemapSwitch
        value={basemap}
        onChange={(id) => {
          setBasemap(id);
          writeBasemap(id);
        }}
      />
      <MapControls showCompass showLocate />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
      <BasemapContext.Provider value={basemap}>
        {children}
      </BasemapContext.Provider>
    </MapView>
  );
};
