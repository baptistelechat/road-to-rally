"use client";

import { AnchorMarkers } from "./AnchorMarkers";
import { ChicaneMarkers } from "./ChicaneMarkers";
import { HoverMarker } from "./HoverMarker";
import { InsertHandle } from "./InsertHandle";
import { IssueMarkers } from "./IssueMarkers";
import { MapFocus } from "./MapFocus";
import { ReturnLayer } from "./ReturnLayer";
import { TraceLayers } from "./TraceLayers";
import { VariantRoutes } from "./VariantRoutes";

/** Tout ce que l'éditeur dessine sur la carte. L'ordre fixe l'empilement : la route d'abord, les marqueurs au-dessus. */
export const MapLayers = () => (
  <>
    <MapFocus />
    <TraceLayers />
    <ReturnLayer />
    <VariantRoutes />
    <IssueMarkers />
    <ChicaneMarkers />
    <InsertHandle />
    <AnchorMarkers />
    <HoverMarker />
  </>
);
