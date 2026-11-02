"use client";

import type { ReactNode } from "react";
import { Map as MapView, MapControls } from "@/components/ui/map";
import type { LatLon } from "@/geo/gpx";
import { MapClickHandler } from "./MapClickHandler";
import { PlaceSearch } from "./PlaceSearch";

/** La France entière à l'ouverture, en [longitude, latitude] */
const FRANCE_CENTER: [number, number] = [2.5, 46.6];
const FRANCE_ZOOM = 5;

interface EditorMapProps {
  onMapClick?: (position: LatLon) => void;
  children?: ReactNode;
}

export const EditorMap = ({ onMapClick, children }: EditorMapProps) => (
  <MapView
    theme="dark"
    center={FRANCE_CENTER}
    zoom={FRANCE_ZOOM}
    // Replié, le crédit CARTO et OpenStreetMap disparaîtrait au premier déplacement de la carte.
    attributionControl={{ compact: false }}
  >
    <PlaceSearch />
    <MapControls />
    {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
    {children}
  </MapView>
);
