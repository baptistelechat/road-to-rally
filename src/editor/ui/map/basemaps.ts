// Fonds de carte de l'éditeur. Satellite : orthophotos IGN (licence ouverte, sans clé), le jeu se trace en France.
import type {
  ExpressionSpecification,
  FilterSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { createContext, useContext } from "react";

export const BASEMAP_IDS = ["satellite", "light", "dark"] as const;
export type BasemapId = (typeof BASEMAP_IDS)[number];

/** Le fond affiché, pour les calques dont la couleur doit trancher dessus. */
export const BasemapContext = createContext<BasemapId>("dark");
export const useBasemap = (): BasemapId => useContext(BasemapContext);

interface RoadsState {
  showRoads: boolean;
  setShowRoads: (show: boolean) => void;
}
/** Les routes sur la photo : réglées par le bouton près de la légende, appliquées par la carte. */
export const RoadsContext = createContext<RoadsState>({
  showRoads: true,
  setShowRoads: () => {},
});
export const useRoads = (): RoadsState => useContext(RoadsContext);

const ignTiles = (layer: string, format: string): string[] => [
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&FORMAT=${format}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`,
];

const MAJOR = ["motorway", "trunk", "primary", "secondary", "tertiary"];
const TRAILS = ["track", "path"];
const ROAD_FILTER: FilterSpecification = [
  "all",
  ["in", ["get", "class"], ["literal", [...MAJOR, "minor", "service", ...TRAILS]]],
  ["!=", ["get", "brunnel"], "tunnel"],
];

/** Les routes s'effacent quand on zoome : de près, la photo les montre déjà. */
const fadeWithZoom = (near: number, far: number): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  far,
  17,
  near,
];
const widthByClass = (
  major: number,
  minor: number,
  trail: number,
): ExpressionSpecification => [
    "interpolate",
    ["exponential", 1.6],
    ["zoom"],
    10,
    [
      "match",
      ["get", "class"],
      MAJOR,
      major * 0.4,
      TRAILS,
      trail * 0.4,
      minor * 0.4,
    ],
    17,
    ["match", ["get", "class"], MAJOR, major, TRAILS, trail, minor],
  ];

/** Calques des routes OSM sur la photo, ceux que le bouton routes masque. */
export const SATELLITE_ROAD_LAYERS = ["roads-casing", "roads", "road-names"];

const SATELLITE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    ortho: {
      type: "raster",
      tiles: ignTiles("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg"),
      tileSize: 256,
      maxzoom: 19,
      attribution: "© IGN Géoplateforme",
    },
    // Routes OSM en vecteur, sans clé : celles dont le jeu tire la route, et dont on choisit les noms affichés.
    osm: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    { id: "ortho", type: "raster", source: "ortho" },
    {
      id: "roads-casing",
      type: "line",
      source: "osm",
      "source-layer": "transportation",
      filter: ROAD_FILTER,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#000000",
        "line-width": widthByClass(7, 4.5, 3),
        "line-opacity": fadeWithZoom(0.2, 0.4),
      },
    },
    {
      id: "roads",
      type: "line",
      source: "osm",
      "source-layer": "transportation",
      filter: ROAD_FILTER,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": [
          "match",
          ["get", "class"],
          MAJOR,
          "#fde68a",
          "#ffffff",
        ],
        "line-width": widthByClass(3.5, 2, 1.5),
        "line-opacity": fadeWithZoom(0.45, 0.85),
      },
    },
    {
      // Noms seulement de près, en petit : de loin ils masquaient la photo.
      id: "road-names",
      type: "symbol",
      source: "osm",
      "source-layer": "transportation_name",
      minzoom: 16,
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-rotation-alignment": "map",
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(0, 0, 0, 0.7)",
        "text-halo-width": 1.2,
        "text-opacity": 0.85,
      },
    },
  ],
};

export const BASEMAP_STYLES: Record<BasemapId, string | StyleSpecification> = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  // Voyager plutôt que Positron : ses routes sont colorées et se lisent jusqu'aux petites.
  light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  satellite: SATELLITE,
};

const STORAGE_KEY = "rally-editor-basemap";

/** Une préférence seulement : stockage bloqué ou valeur inconnue redonnent le fond par défaut, le premier. */
export const readBasemap = (): BasemapId => {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return BASEMAP_IDS.find((id) => id === stored) ?? BASEMAP_IDS[0];
  } catch {
    return BASEMAP_IDS[0];
  }
};

export const writeBasemap = (id: BasemapId): void => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, id);
  } catch {
    // Le choix vaudra pour cette page.
  }
};
