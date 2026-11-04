"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MapMarker,
  MarkerContent,
  MarkerPopup,
  useMap,
  useMarkerContext,
} from "@/components/ui/map";
import { EDITOR_CHICANE_MIN_GAP } from "@/geo/config";
import type { LatLon } from "@/geo/gpx";
import { chicaneBends, snapToBand, type ListedChicane } from "../../chicanes";
import { nearestIndex, nearestOnTrace } from "../../hover";
import { editorStore, useEditor } from "../../store";
import type { AxisZone } from "../../zones";
import { AxisZones } from "./AxisZones";
import { ChicaneSymbol } from "../symbols";
import { useChicanes } from "../useChicanes";

/** Portée du clic droit autour du tracé, en pixels : la chicane se recale ensuite sur la route */
const ADD_PIXELS = 40;
/** Écart invisible, en degrés (0,1 mm), voir `ChicaneMarker` */
const REDRAW_NUDGE = 1e-9;

/** Ouvre le menu de ce marqueur quand sa zone est cliquée. Ne dessine rien. */
const MenuOnZoneClick = ({ id }: { id: string }) => {
  const { marker } = useMarkerContext();
  const request = useEditor((state) => state.chicaneMenu);
  useEffect(() => {
    if (request?.id === id && !marker.getPopup()?.isOpen())
      marker.togglePopup();
  }, [request, id, marker]);
  return null;
};

const ChicaneMarker = ({ chicane }: { chicane: ListedChicane }) => {
  const pending = useEditor((state) => state.status.pending);
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
      draggable={!pending && axis !== null}
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
      <MarkerContent className="cursor-grab">
        <span
          title={`Chicane ${chicaneBends(chicane.side)}, ${chicane.origin === "auto" ? "automatique" : "à toi"} : à glisser le long du tracé`}
          className="block"
        >
          <ChicaneSymbol
            side={chicane.side}
            player={chicane.origin === "player"}
          />
        </span>
      </MarkerContent>
      <MenuOnZoneClick id={chicane.id} />
      <MarkerPopup>
        <p className="mb-2 text-xs">Chicane {chicaneBends(chicane.side)}</p>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => flip(chicane.id)}>
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
      const { history, addChicaneAt } = editorStore.getState();
      const { left, top } = container.getBoundingClientRect();
      const hit = nearestOnTrace(
        history.present.segments,
        { x: event.clientX - left, y: event.clientY - top },
        ({ lat, lon }) => map.project([lon, lat]),
        ADD_PIXELS,
      );
      if (!hit) return;
      event.preventDefault();
      addChicaneAt(hit.position);
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
        ? chicanes.map(({ id, index }): AxisZone => ({
            id,
            index:
              dragged?.id === id ? nearestIndex(axis, dragged.position) : index,
            reach: EDITOR_CHICANE_MIN_GAP / 2,
          }))
        : [],
    [axis, chicanes, dragged],
  );
  return (
    axis && (
      <AxisZones
        zones={zones}
        axis={axis}
        onZoneClick={(id) => editorStore.setState({ chicaneMenu: { id } })}
      />
    )
  );
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
