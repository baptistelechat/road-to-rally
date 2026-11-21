// Cartes proposées par le menu de départ et le road-book de la pause, et leurs navigations.
import { readDraftStage } from "@/editor/draft";
import {
  CUSTOM_MAP_ID,
  EDITOR_TRACE_URL,
  EDITOR_URL,
  IMPORTED_MAP_ID,
  MAPS,
  mapSearch,
} from "@/game/maps";

export interface MapChoice {
  id: string;
  name: string;
  /** Sous-titre de la carte : « Spéciale », « Boucle »… */
  kind: string;
}

/** Ordre et sous-titres de la maquette R-Menu. Une carte absente d'ici passe à la fin. */
const SHOWCASE: readonly Omit<MapChoice, "name">[] = [
  { id: "mountain", kind: "Spéciale" },
  { id: "road", kind: "Spéciale" },
  { id: "notes", kind: "Spéciale" },
  { id: "track", kind: "Boucle" },
];

const rank = (id: string): number => {
  const index = SHOWCASE.findIndex((entry) => entry.id === id);
  return index < 0 ? SHOWCASE.length : index;
};

/** Les cartes livrées, plus la spéciale importée ou créée si c'est la carte en cours. */
export const mapChoices = (map: string, mapLabel: string): MapChoice[] => [
  ...[...MAPS]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map(({ id, label }) => ({
      id,
      name: label,
      kind: SHOWCASE[rank(id)]?.kind ?? "Spéciale",
    })),
  ...(map === IMPORTED_MAP_ID || map === CUSTOM_MAP_ID
    ? [{ id: map, name: mapLabel, kind: map === CUSTOM_MAP_ID ? "Éditeur" : "GPX" }]
    : []),
];

/** Paramètre d'URL posé par un changement de carte en pause : la nouvelle carte s'ouvre sur l'écran « Prêt ». */
export const READY_PARAM = "pret";

/** La page vient-elle d'un changement de carte en pause ? `ReadyScreen` retire le paramètre une fois affiché. */
export const readyRequested = (): boolean =>
  new URLSearchParams(window.location.search).has(READY_PARAM);

/**
 * Changer de carte recharge la page : l'ancien monde Rapier et l'audio sont libérés sans code de plus.
 * La carte en cours ne recharge rien : une spéciale importée n'a pas d'URL.
 * `ready` : depuis la pause, la carte chargée attend sur l'écran « Prêt » au lieu du menu de départ.
 */
export const chooseMap = (map: string, id: string, ready = false): void => {
  if (id === map) return;
  const search = mapSearch(id);
  window.location.assign(ready ? `${search}&${READY_PARAM}=1` : search);
};

/** Une vraie navigation : la scène 3D et son contexte WebGL sont libérés avant la page suivante. */
export const leaveFor = (path: string): void =>
  // Voulu : `router.push` garderait la scène, le monde Rapier et l'audio en mémoire.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${window.location.origin}${path}`);

/** Retour sur la carte si le brouillon est bien le tracé de cette spéciale, sinon à l'accueil de l'éditeur. */
export const returnToEditor = (): void => {
  window.location.href =
    new URLSearchParams(window.location.search).get("stage") ===
    readDraftStage()
      ? EDITOR_TRACE_URL
      : EDITOR_URL;
};
