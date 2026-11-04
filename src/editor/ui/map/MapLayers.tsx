"use client";

import { AnchorMarkers } from "./AnchorMarkers";
import { ChicaneMarkers } from "./ChicaneMarkers";
import { HoverMarker } from "./HoverMarker";
import { InsertHandle } from "./InsertHandle";
import { MedianLines } from "./MedianLines";
import { IssueMarkers } from "./IssueMarkers";
import { MapFocus } from "./MapFocus";
import { ElementPanels, FirstHint, Legend, RouteStatus } from "./MapPanels";
import { ReturnLayer } from "./ReturnLayer";
import { RoundaboutIslands } from "./RoundaboutIslands";
import { TraceLayers } from "./TraceLayers";
import { VariantRoutes } from "./VariantRoutes";

/** Tout ce que l'éditeur dessine sur la carte. L'ordre fixe l'empilement : la route d'abord, les marqueurs au-dessus. */
export const MapLayers = () => (
  <>
    <MapFocus />
    <ElementPanels />
    <Legend />
    <FirstHint />
    <RouteStatus />
    <TraceLayers />
    <ReturnLayer />
    <VariantRoutes />
    <RoundaboutIslands />
    <MedianLines />
    <IssueMarkers />
    <ChicaneMarkers />
    <InsertHandle />
    <AnchorMarkers />
    <HoverMarker />
  </>
);
