"use client";

import { useMemo, useState } from "react";
import {
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerPopup,
} from "@/components/ui/map";
import { Button } from "@/components/ui/button";
import type { LatLon } from "@/geo/gpx";
import { toCoordinates } from "../../hover";
import { editorStore, useEditor } from "../../store";
import type { Anchor } from "../../types";
import { ReturnAction } from "../panel/ReturnAction";

interface AnchorMarkerProps {
  anchor: Anchor;
  rank: number;
  isLast: boolean;
  draggable: boolean;
  onDrag: (position: LatLon) => void;
  onDragEnd: (position: LatLon) => void;
}

const AnchorMarker = ({
  anchor,
  rank,
  isLast,
  draggable,
  onDrag,
  onDragEnd,
}: AnchorMarkerProps) => {
  const removePoint = useEditor((state) => state.removePoint);
  const moving = useEditor((state) => state.mapMode === "move");
  const toLatLon = ({ lat, lng }: { lat: number; lng: number }): LatLon => ({
    lat,
    lon: lng,
  });
  return (
    <MapMarker
      longitude={anchor.position.lon}
      latitude={anchor.position.lat}
      draggable={draggable && moving}
      onDragStart={() => editorStore.setState({ dragging: true })}
      onDrag={(lngLat) => onDrag(toLatLon(lngLat))}
      onDragEnd={(lngLat) => onDragEnd(toLatLon(lngLat))}
    >
      <MarkerContent className={moving ? "cursor-grab" : undefined}>
        {/* Une marge autour de la pastille : plus facile à attraper en mode déplacement. */}
        <span className={moving ? "block p-2" : "block"}>
          <span className="grid size-6 place-items-center rounded-full border-2 border-foreground bg-sky-600 text-xs font-bold text-foreground shadow-md">
            {rank}
          </span>
        </span>
      </MarkerContent>
      {!moving && (
        <MarkerPopup>
          <p className="mb-2 text-xs">Point {rank}</p>
          <div className="flex flex-col gap-1">
            {isLast && <ReturnAction />}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void removePoint(anchor.id)}
            >
              Supprimer ce point
            </Button>
          </div>
        </MarkerPopup>
      )}
    </MapMarker>
  );
};

interface DragState {
  id: string;
  position: LatLon;
}

/** Glisser ne demande rien au réseau : un pointillé provisoire, puis un calcul au relâchement seulement. */
export const AnchorMarkers = () => {
  const anchors = useEditor((state) => state.history.present.anchors);
  const pending = useEditor((state) => state.status.pending);
  const movePoint = useEditor((state) => state.movePoint);
  const [drag, setDrag] = useState<DragState | null>(null);
  // MapLibre laisse le marqueur où on l'a lâché : un point refusé ne change aucune prop, seule une nouvelle clé le remet en place.
  const [reset, setReset] = useState({ id: "", epoch: 0 });

  const provisional = useMemo(() => {
    if (!drag) return [];
    const index = anchors.findIndex(({ id }) => id === drag.id);
    if (index < 0) return [];
    return toCoordinates(
      [
        anchors[index - 1]?.position,
        drag.position,
        anchors[index + 1]?.position,
      ].filter((position): position is LatLon => position !== undefined),
    );
  }, [anchors, drag]);

  return (
    <>
      <MapRoute
        id="anchor-drag"
        coordinates={provisional}
        color="#f8fafc"
        width={2}
        opacity={0.9}
        dashArray={[2, 2]}
        interactive={false}
      />
      {anchors.map((anchor, i) => (
        <AnchorMarker
          key={
            anchor.id === reset.id ? `${anchor.id}:${reset.epoch}` : anchor.id
          }
          anchor={anchor}
          rank={i + 1}
          isLast={i === anchors.length - 1}
          draggable={!pending}
          onDrag={(position) => setDrag({ id: anchor.id, position })}
          onDragEnd={(position) => {
            setDrag({ id: anchor.id, position });
            editorStore.setState({ dragging: false });
            void movePoint(anchor.id, position).finally(() => {
              setDrag(null);
              setReset(({ epoch }) => ({ id: anchor.id, epoch: epoch + 1 }));
            });
          }}
        />
      ))}
    </>
  );
};
