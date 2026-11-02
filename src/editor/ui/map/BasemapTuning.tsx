"use client";

import { useEffect } from "react";
import { useMap } from "@/components/ui/map";
import type { BasemapId } from "./basemaps";

const DEM_SOURCE = "relief-dem";
const RELIEF_LAYER = "relief";
const DEM_TILES =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
/** Sur Dark Matter, chemins et routes de service sont presque noirs : ce sont pourtant ceux qu'on cherche pour un rallye. */
const ROAD_FILL = /^(road|bridge|tunnel)_(.*_fill|path)/;
const DARK_ROAD_COLOR = "#7c8596";

/** Relief ombré sous les routes et routes éclaircies sur le fond sombre. Sur le style courant : un changement de fond les efface, l'effet les remet. */
export const BasemapTuning = ({ basemap }: { basemap: BasemapId }) => {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || basemap === "satellite") return;
    const layers = map.getStyle().layers;
    if (basemap === "dark")
      for (const { id, type } of layers)
        if (type === "line" && ROAD_FILL.test(id))
          map.setPaintProperty(id, "line-color", DARK_ROAD_COLOR);
    if (map.getLayer(RELIEF_LAYER)) return;
    map.addSource(DEM_SOURCE, {
      type: "raster-dem",
      encoding: "terrarium",
      tiles: [DEM_TILES],
      tileSize: 256,
      maxzoom: 14,
      attribution: "Relief : Mapzen, AWS Terrain Tiles",
    });
    const firstLine = layers.find(({ type }) => type === "line");
    map.addLayer(
      {
        id: RELIEF_LAYER,
        type: "hillshade",
        source: DEM_SOURCE,
        paint: {
          "hillshade-exaggeration": basemap === "dark" ? 0.4 : 0.15,
          "hillshade-shadow-color": "#000000",
          "hillshade-highlight-color":
            basemap === "dark" ? "#4b5563" : "#ffffff",
        },
      },
      firstLine?.id,
    );
  }, [map, isLoaded, basemap]);

  return null;
};
