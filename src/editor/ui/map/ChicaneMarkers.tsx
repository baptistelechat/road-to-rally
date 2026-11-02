"use client";

import { Construction } from "lucide-react";
import type { MapMouseEvent } from "maplibre-gl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MapMarker,
  MarkerContent,
  MarkerPopup,
  useMap,
} from "@/components/ui/map";
import type { LatLon } from "@/geo/gpx";
import { snapToBand, type ListedChicane } from "../../chicanes";
import { nearestOnTrace } from "../../hover";
import { editorStore, useEditor } from "../../store";
import { useChicanes } from "../useChicanes";

/** Portée du clic droit autour du tracé, en pixels */
const ADD_PIXELS = 14;

const SIDE_LABEL = { left: "à gauche", right: "à droite" } as const;

const ChicaneMarker = ({ chicane }: { chicane: ListedChicane }) => {
  const pending = useEditor((state) => state.status.pending);
  const axis = useEditor((state) => state.analysis?.axis ?? null);
  const flip = useEditor((state) => state.flipChicaneSide);
  const remove = useEditor((state) => state.removeChicaneById);
  const move = useEditor((state) => state.moveChicaneTo);
  const [dragged, setDragged] = useState<LatLon | null>(null);
  const { lat: latitude, lon: longitude } = dragged ?? chicane.position;

  const snap = ({ lat, lng }: { lat: number; lng: number }): LatLon | null =>
    axis && snapToBand(axis, { lat, lon: lng });

  return (
    <MapMarker
      longitude={longitude}
      latitude={latitude}
      draggable={!pending && axis !== null}
      onDragStart={() => editorStore.setState({ dragging: true })}
      // La nouvelle position revient par les props : le marqueur reste sur la route pendant le glissement.
      onDrag={(lngLat) => setDragged(snap(lngLat))}
      onDragEnd={(lngLat) => {
        const position = snap(lngLat);
        editorStore.setState({ dragging: false });
        if (position) move(chicane.id, position);
        setDragged(null);
      }}
    >
      <MarkerContent>
        <span
          title={`Chicane ${chicane.origin === "auto" ? "automatique" : "à toi"} : à glisser le long du tracé`}
          className={`grid size-6 place-items-center rounded-sm border-2 shadow-md ${chicane.origin === "auto" ? "border-white bg-orange-500 text-neutral-900" : "border-orange-500 bg-white text-neutral-900"}`}
        >
          <Construction aria-hidden="true" className="size-3.5" />
        </span>
      </MarkerContent>
      <MarkerPopup>
        <p className="mb-2 text-xs">
          Chicane, premier bloc {SIDE_LABEL[chicane.side]}
        </p>
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
    const handle = ({ point, originalEvent }: MapMouseEvent): void => {
      const { history, addChicaneAt } = editorStore.getState();
      const hit = nearestOnTrace(
        history.present.segments,
        point,
        ({ lat, lon }) => map.project([lon, lat]),
        ADD_PIXELS,
      );
      if (!hit) return;
      originalEvent.preventDefault();
      addChicaneAt(hit.position);
    };
    map.on("contextmenu", handle);
    return () => {
      map.off("contextmenu", handle);
    };
  }, [map]);
  return null;
};

export const ChicaneMarkers = () => {
  const chicanes = useChicanes();
  return (
    <>
      <AddOnContextMenu />
      {chicanes.map((chicane) => (
        <ChicaneMarker key={chicane.id} chicane={chicane} />
      ))}
    </>
  );
};
