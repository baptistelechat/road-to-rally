// Fonds de carte de l'éditeur. Satellite : orthophotos IGN (licence ouverte, sans clé), le jeu se trace en France.
import type { StyleSpecification } from "maplibre-gl";

export const BASEMAP_IDS = ["satellite", "light", "dark"] as const;
export type BasemapId = (typeof BASEMAP_IDS)[number];

const ignTiles = (layer: string, format: string): string[] => [
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&FORMAT=${format}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`,
];

const SATELLITE: StyleSpecification = {
  version: 8,
  sources: {
    ortho: {
      type: "raster",
      tiles: ignTiles("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg"),
      tileSize: 256,
      maxzoom: 19,
      attribution: "© IGN Géoplateforme",
    },
    // Noms de lieux sur la photo : sans eux, on ne sait plus où on est en dézoomant.
    labels: {
      type: "raster",
      tiles: ignTiles("GEOGRAPHICALNAMES.NAMES", "image/png"),
      tileSize: 256,
      maxzoom: 18,
    },
  },
  layers: [
    { id: "ortho", type: "raster", source: "ortho" },
    { id: "labels", type: "raster", source: "labels" },
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
