"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MapMarker,
  MarkerContent,
  MarkerPopup,
  useMap,
} from "@/components/ui/map";
import { EDITOR_CHICANE_MIN_GAP } from "@/geo/config";
import type { LatLon } from "@/geo/gpx";
import {
  SIGN_ART_BENDS,
  SIGN_ART_BORDER,
  SIGN_ART_FIELD,
  SIGN_ART_HEIGHT,
  SIGN_ART_RIM,
  SIGN_ART_WIDTH,
  type SignOutline,
} from "@/render/scenery/chicaneSignArt";
import { chicaneBends, snapToBand, type ListedChicane } from "../../chicanes";
import { nearestIndex, nearestOnTrace } from "../../hover";
import { editorStore, useEditor } from "../../store";
import type { ChicaneSide } from "../../types";
import type { AxisZone } from "../../zones";
import { AxisZones } from "./AxisZones";
import { useChicanes } from "../useChicanes";

/** Portée du clic droit autour du tracé, en pixels : la chicane se recale ensuite sur la route */
const ADD_PIXELS = 40;
/** Écart invisible, en degrés (0,1 mm), voir `ChicaneMarker` */
const REDRAW_NUDGE = 1e-9;

const toPoints = (outline: SignOutline): string =>
  outline.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * Le panneau du jeu, comme sur un roadbook : il se lit dans le sens du pilote, quel que soit le sens de la route sur la carte.
 * Dessiné pour un premier virage à droite, donc un premier bloc à gauche. L'autre côté en est le miroir.
 */
const ChicaneSign = ({ side }: { side: ChicaneSide }) => (
  <svg
    viewBox={`0 0 ${SIGN_ART_WIDTH} ${SIGN_ART_HEIGHT}`}
    aria-hidden="true"
    className={`block h-8 w-9 drop-shadow-md ${side === "right" ? "-scale-x-100" : ""}`}
  >
    <polygon points={toPoints(SIGN_ART_RIM)} fill="#f5f4f0" />
    <polygon points={toPoints(SIGN_ART_BORDER)} fill="#d01c1f" />
    <polygon points={toPoints(SIGN_ART_FIELD)} fill="#f5f4f0" />
    <polygon points={toPoints(SIGN_ART_BENDS)} fill="#111111" />
  </svg>
);

const ChicaneMarker = ({ chicane }: { chicane: ListedChicane }) => {
  const pending = useEditor((state) => state.status.pending);
  const moving = useEditor((state) => state.mapMode === "move");
  const axis = useEditor((state) => state.analysis?.axis ?? null);
  const flip = useEditor((state) => state.flipChicaneSide);
  const remove = useEditor((state) => state.removeChicaneById);
  const move = useEditor((state) => state.moveChicaneTo);
  const [dragged, setDragged] = useState<LatLon | null>(null);
  const [tick, setTick] = useState(0);
  const [dropCount, setDropCount] = useState(0);
  const { lat: latitude, lon: longitude } = dragged ?? chicane.position;

  const snap = ({ lat, lng }: { lat: number; lng: number }): LatLon | null =>
    axis && snapToBand(axis, { lat, lon: lng });

  return (
    <MapMarker
      // Lâché, il garderait la place du pointeur si aucune prop ne change : une nouvelle clé le pose sur sa vraie position.
      key={dropCount}
      // MapLibre déplace le marqueur sous le pointeur, et le même point de route ne le ramènerait pas :
      // des props qui changent à chaque mouvement le remettent sur la route.
      longitude={longitude + (tick % 2) * REDRAW_NUDGE}
      latitude={latitude}
      draggable={moving && !pending && axis !== null}
      onDragStart={() => editorStore.setState({ dragging: true })}
      onDrag={(lngLat) => {
        const position = snap(lngLat);
        setDragged(position);
        setTick((value) => value + 1);
        // La zone suit : on voit où ça passe avant de lâcher.
        if (position)
          editorStore.setState({
            draggedChicane: { id: chicane.id, position },
          });
      }}
      onDragEnd={(lngLat) => {
        const position = snap(lngLat);
        editorStore.setState({ dragging: false, draggedChicane: null });
        if (position) move(chicane.id, position);
        setDragged(null);
        setDropCount((value) => value + 1);
      }}
    >
      <MarkerContent className={moving ? "cursor-grab" : undefined}>
        <span
          title={`Chicane ${chicaneBends(chicane.side)}, ${chicane.origin === "auto" ? "automatique" : "à toi"}${moving ? " : à glisser le long du tracé" : ""}`}
          className="relative block"
        >
          <ChicaneSign side={chicane.side} />
          {chicane.origin === "player" && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-foreground bg-orange-500" />
          )}
        </span>
      </MarkerContent>
      {!moving && (
        <MarkerPopup>
          <p className="mb-2 text-xs">Chicane {chicaneBends(chicane.side)}</p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => flip(chicane.id)}
            >
              Changer de côté
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => remove(chicane.id)}
            >
              Supprimer
            </Button>
          </div>
        </MarkerPopup>
      )}
    </MapMarker>
  );
};

/** Clic droit sur le tracé : une chicane à cet endroit. Le panneau offre la même chose au clavier. */
const AddOnContextMenu = () => {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    // L'événement du navigateur : celui de MapLibre se perd si la souris bouge d'un rien pendant le clic.
    const container = map.getCanvasContainer();
    const handle = (event: MouseEvent): void => {
      const { history, addChicaneAt, mapMode } = editorStore.getState();
      const { left, top } = container.getBoundingClientRect();
      const hit = nearestOnTrace(
        history.present.segments,
        { x: event.clientX - left, y: event.clientY - top },
        ({ lat, lon }) => map.project([lon, lat]),
        ADD_PIXELS,
      );
      if (!hit) return;
      event.preventDefault();
      if (mapMode === "edit") addChicaneAt(hit.position);
      else
        editorStore.setState({
          notice: "Passe en mode Éditer pour poser une chicane.",
        });
    };
    container.addEventListener("contextmenu", handle);
    return () => container.removeEventListener("contextmenu", handle);
  }, [map]);
  return null;
};

/** La place que prend chaque chicane sur la route : deux bandes qui se touchent, c'est l'écart minimal. */
const ChicaneZones = ({ chicanes }: { chicanes: ListedChicane[] }) => {
  const axis = useEditor((state) => state.analysis?.axis?.latLon ?? null);
  const dragged = useEditor((state) => state.draggedChicane);
  const zones = useMemo(
    () =>
      axis
        ? chicanes.map(
            ({ id, index }): AxisZone => ({
              id,
              index:
                dragged?.id === id
                  ? nearestIndex(axis, dragged.position)
                  : index,
              reach: EDITOR_CHICANE_MIN_GAP / 2,
            }),
          )
        : [],
    [axis, chicanes, dragged],
  );
  return axis && <AxisZones zones={zones} axis={axis} />;
};

export const ChicaneMarkers = () => {
  const chicanes = useChicanes();
  return (
    <>
      <ChicaneZones chicanes={chicanes} />
      <AddOnContextMenu />
      {chicanes.map((chicane) => (
        <ChicaneMarker key={chicane.id} chicane={chicane} />
      ))}
    </>
  );
};
