// Contrat partagé de l'éditeur : de simples données, sans React, MapLibre ni réseau.
import type { LatLon } from "@/geo/gpx";

/** Point posé par le joueur, recalé sur la route trouvée par BRouter. */
export interface Anchor {
  id: string;
  position: LatLon;
}

/** Tags OSM d'une portion de segment, à partir de `fromIndex` dans `Segment.points`. */
export interface SegmentWay {
  fromIndex: number;
  highway?: string;
  surface?: string;
}

/** Route calculée entre deux points d'ancrage voisins. */
export interface Segment {
  fromAnchorId: string;
  toAnchorId: string;
  points: LatLon[];
  ways: SegmentWay[];
  /** Longueur en mètres */
  length: number;
}

export type ChicaneOrigin = "auto" | "player";
export type ChicaneSide = "left" | "right";

/** Une chicane dans l'éditeur : une position géographique, car l'abscisse change dès que le tracé bouge. */
export interface ChicaneElement {
  id: string;
  position: LatLon;
  /** Côté du premier bloc dans le sens de la route */
  side: ChicaneSide;
  origin: ChicaneOrigin;
}

/** Une chicane proposée par l'analyse du tracé. Hors du document : elle se recalcule à chaque changement du tracé. */
export interface AutoChicane {
  position: LatLon;
  side: ChicaneSide;
}

export interface AutoChicanes {
  chicanes: AutoChicane[];
  /** Lignes droites sans chicane, la route estimée y étant trop étroite */
  tooNarrow: number;
}

/** Le chemin complet d'un aller-retour, calculé depuis la vraie route du retournement (story 3.7). */
export interface ReturnRoute {
  /** Aller, retournement, puis aller recopié en sens inverse : le GPX s'écrit tel quel */
  path: LatLon[];
  /** Vraie route de retour : l'écart avec la recopie est signalé, jamais corrigé */
  realReturn: LatLon[];
}

/** La route au-delà d'une ligne, hors du chrono. Toujours dans le sens qui s'éloigne de la ligne. */
export interface Runoff {
  /** Le premier est le point posé par le joueur */
  points: LatLon[];
  /** Le point de la route d'où vient la direction : s'il change, ce prolongement ne vaut plus */
  probe: LatLon;
  /** Aucune route libre : une ligne droite provisoire, qui bloque « Rouler » */
  invented: boolean;
}

/** Document édité : ce que l'historique d'annulation et le brouillon conservent. */
export interface EditorTrace {
  name: string;
  anchors: Anchor[];
  /** Un segment par paire de points voisins, dans l'ordre. Ne décrit que l'aller d'un aller-retour. */
  segments: Segment[];
  /** Avant le premier point, qui est le départ */
  runIn: Runoff | null;
  /** Après le dernier point, qui est l'arrivée. Sans effet sur un aller-retour, qui finit sur son départ. */
  runOut: Runoff | null;
  /** Le retour part de ce point, toujours le dernier (story 3.7). `null` : pas d'aller-retour. */
  returnFromAnchorIndex: number | null;
  returnRoute: ReturnRoute | null;
  /** Seules les chicanes du joueur : les automatiques viennent de l'analyse du tracé */
  chicanes: ChicaneElement[];
  /** Positions des chicanes supprimées ou reprises par le joueur : elles ne reviennent pas sur une portion inchangée */
  removedChicanes: LatLon[];
  /** Faux : aucune chicane sur la spéciale, celles du joueur restant gardées pour le jour où il les remet */
  chicanesEnabled: boolean;
}

export const EMPTY_TRACE: Readonly<EditorTrace> = {
  name: "",
  anchors: [],
  segments: [],
  runIn: null,
  runOut: null,
  returnFromAnchorIndex: null,
  returnRoute: null,
  chicanes: [],
  removedChicanes: [],
  chicanesEnabled: true,
};
