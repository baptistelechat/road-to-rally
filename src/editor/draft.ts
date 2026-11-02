// Brouillon dans `localStorage` : une entrée illisible redonne un brouillon vide, une panne de stockage ne lève jamais.
import type { LatLon } from "@/geo/gpx";
import {
  EMPTY_TRACE,
  type Anchor,
  type ChicaneElement,
  type EditorTrace,
  type ReturnRoute,
  type Segment,
  type SegmentWay,
} from "./types";

export const DRAFT_KEY = "rally-editor-draft";

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isLatLon = (value: unknown): value is LatLon =>
  isRecord(value) &&
  typeof value.lat === "number" &&
  typeof value.lon === "number" &&
  Math.abs(value.lat) <= 90 &&
  Math.abs(value.lon) <= 180;

const isOptionalString = (value: unknown): boolean =>
  value === undefined || typeof value === "string";

const isAnchor = (value: unknown): value is Anchor =>
  isRecord(value) && typeof value.id === "string" && isLatLon(value.position);

const isWay = (value: unknown): value is SegmentWay =>
  isRecord(value) &&
  Number.isInteger(value.fromIndex) &&
  isOptionalString(value.highway) &&
  isOptionalString(value.surface);

const isSegment = (value: unknown): value is Segment => {
  if (
    !isRecord(value) ||
    typeof value.fromAnchorId !== "string" ||
    typeof value.toAnchorId !== "string" ||
    typeof value.length !== "number" ||
    !(value.length >= 0) ||
    !Array.isArray(value.points) ||
    value.points.length < 2 ||
    !value.points.every(isLatLon) ||
    !Array.isArray(value.ways) ||
    !value.ways.every(isWay)
  )
    return false;
  const lastIndex = value.points.length - 1;
  return (value.ways as SegmentWay[]).every(
    (way, i, ways) =>
      way.fromIndex >= 0 &&
      way.fromIndex <= lastIndex &&
      (i === 0 || way.fromIndex > ways[i - 1].fromIndex),
  );
};

const isChicane = (value: unknown): value is ChicaneElement =>
  isRecord(value) &&
  typeof value.id === "string" &&
  isLatLon(value.position) &&
  (value.side === "left" || value.side === "right") &&
  (value.origin === "auto" || value.origin === "player");

const isReturnRoute = (value: unknown): value is ReturnRoute =>
  isRecord(value) &&
  Array.isArray(value.path) &&
  value.path.length >= 3 &&
  value.path.every(isLatLon) &&
  Array.isArray(value.realReturn) &&
  value.realReturn.every(isLatLon);

/** Un segment par paire de points voisins, dans l'ordre, sans quoi le tracé ne s'assemble pas. */
const isTrace = (value: unknown): value is EditorTrace => {
  if (
    !isRecord(value) ||
    (value.returnRoute !== null && !isReturnRoute(value.returnRoute)) ||
    typeof value.chicanesEnabled !== "boolean" ||
    typeof value.name !== "string" ||
    !Array.isArray(value.anchors) ||
    !value.anchors.every(isAnchor) ||
    !Array.isArray(value.segments) ||
    !value.segments.every(isSegment) ||
    !Array.isArray(value.chicanes) ||
    !value.chicanes.every(isChicane) ||
    !Array.isArray(value.removedChicanes) ||
    !value.removedChicanes.every(isLatLon)
  )
    return false;
  const anchors = value.anchors as Anchor[];
  const segments = value.segments as Segment[];
  const returnIndex = value.returnFromAnchorIndex;
  return (
    new Set(anchors.map((anchor) => anchor.id)).size === anchors.length &&
    segments.length === Math.max(0, anchors.length - 1) &&
    segments.every(
      (segment, i) =>
        segment.fromAnchorId === anchors[i].id &&
        segment.toAnchorId === anchors[i + 1].id,
    ) &&
    (returnIndex === null) === (value.returnRoute === null) &&
    (returnIndex === null ||
      (typeof returnIndex === "number" &&
        Number.isInteger(returnIndex) &&
        returnIndex >= 0 &&
        returnIndex < anchors.length))
  );
};

/** Un brouillon d'avant ces champs reste lisible : le joueur n'y avait encore rien choisi. */
const withDefaults = (value: unknown): unknown =>
  isRecord(value) && !Array.isArray(value)
    ? { returnRoute: null, chicanesEnabled: true, ...value }
    : value;

/** L'accès à `localStorage` lui-même peut lever, et il n'existe pas côté serveur. */
const defaultStorage = (): DraftStorage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const readDraft = (
  storage: DraftStorage | null = defaultStorage(),
): EditorTrace => {
  try {
    const parsed = withDefaults(
      JSON.parse(storage?.getItem(DRAFT_KEY) ?? "null"),
    );
    if (isTrace(parsed)) return parsed;
  } catch {
    // Brouillon vide ci-dessous.
  }
  return { ...EMPTY_TRACE };
};

/** Renvoie `false` si le stockage a refusé, plein ou bloqué : le tracé reste en mémoire. */
export const writeDraft = (
  trace: EditorTrace,
  storage: DraftStorage | null = defaultStorage(),
): boolean => {
  try {
    storage?.setItem(DRAFT_KEY, JSON.stringify(trace));
    return storage !== null;
  } catch {
    return false;
  }
};

export const clearDraft = (
  storage: DraftStorage | null = defaultStorage(),
): void => {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    // Rien à sauver.
  }
};
