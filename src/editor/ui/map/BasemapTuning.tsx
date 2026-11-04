"use client";

import { useEffect } from "react";
import { useMap } from "@/components/ui/map";
import { SATELLITE_ROAD_LAYERS, type BasemapId } from "./basemaps";

const DEM_SOURCE = "relief-dem";
const RELIEF_LAYER = "relief";
const DEM_TILES =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
/** Sur Dark Matter, chemins et routes de service sont presque noirs : ce sont pourtant ceux qu'on cherche pour un rallye. */
const ROAD_FILL = /^(road|bridge|tunnel)_(.*_fill|path)/;
const DARK_ROAD_COLOR = "#7c8596";

interface BasemapTuningProps {
  basemap: BasemapId;
  showRoads: boolean;
}

/** Relief ombré sous les routes, routes éclaircies sur le fond sombre, routes masquables sur la photo. Sur le style courant : un changement de fond les efface, l'effet les remet. */
export const BasemapTuning = ({ basemap, showRoads }: BasemapTuningProps) => {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    if (basemap === "satellite") {
      // Juste après le clic sur Satellite, l'ancien style est encore là : l'effet repasse au chargement du nouveau.
      for (const id of SATELLITE_ROAD_LAYERS)
        if (map.getLayer(id))
          map.setLayoutProperty(id, "visibility", showRoads ? "visible" : "none");
      return;
    }
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
  }, [map, isLoaded, basemap, showRoads]);

  return null;
};
