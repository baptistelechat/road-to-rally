// Les cartes du jeu. L'identifiant vit dans l'URL (`?map=`), le nom de la piste s'affiche en anglais.
import type { GeneratedStage } from "@/geo/stageWorkerClient";
import type { StageData } from "@/sim/types";

export interface GameMap {
  id: string;
  label: string;
  /** `null` : le circuit du sandbox, sans fichier à charger */
  stageUrl: string | null;
  bestLapKey: string;
  /** Spéciale de l'éditeur, déjà relue depuis le cache */
  custom?: GeneratedStage;
}

const CIRCUIT: GameMap = {
  id: "track",
  label: "Track",
  stageUrl: null,
  // Clé d'avant le choix de carte : le record du circuit survit à la mise à jour.
  bestLapKey: "rally:best-lap-ms",
};

export const MAPS: readonly GameMap[] = [
  CIRCUIT,
  {
    id: "road",
    label: "Road",
    stageUrl: "/stages/road.json",
    bestLapKey: "rally:best-lap-ms:road",
  },
  {
    id: "mountain",
    label: "Mountain",
    stageUrl: "/stages/mountain.json",
    bestLapKey: "rally:best-lap-ms:mountain",
  },
];

/** Entrée du sélecteur qui ouvre l'import : jamais une carte, jamais dans l'URL. */
export const IMPORT_OPTION = "import";
export const IMPORTED_MAP_ID = "imported";
/** Entrée du sélecteur qui ouvre l'éditeur : une autre page, jamais une carte. */
export const EDITOR_OPTION = "editor";

/** Le record suit l'empreinte : une spéciale qui change ne reprend pas l'ancien temps. */
export const importedMap = ({ name, hash }: StageData): GameMap => ({
  id: IMPORTED_MAP_ID,
  label: name,
  stageUrl: null,
  bestLapKey: `rally:best-lap-ms:${hash}`,
});

/** Une spéciale créée dans l'éditeur : `?map=custom&stage=<clé du cache>`. */
export const CUSTOM_MAP_ID = "custom";
export const EDITOR_URL = "/editor";

export const customStageUrl = (key: string): string =>
  `/?map=${CUSTOM_MAP_ID}&stage=${encodeURIComponent(key)}`;

export const customMap = (custom: GeneratedStage): GameMap => ({
  ...importedMap(custom.stage),
  id: CUSTOM_MAP_ID,
  custom,
});

/** Valeur absente ou inconnue : retour au circuit. */
export const mapFromParam = (value: string | null): GameMap =>
  MAPS.find((map) => map.id === value) ?? CIRCUIT;

/** Paramètres de l'URL pour une autre carte, les autres (`bot`, `debug`) conservés. */
export const mapSearch = (id: string): string => {
  const params = new URLSearchParams(window.location.search);
  params.set("map", id);
  params.delete("stage");
  return `?${params}`;
};
