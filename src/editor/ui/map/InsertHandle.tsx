"use client";

import type { MapMouseEvent } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapMarker,
  MapRoute,
  MarkerContent,
  useMap,
} from "@/components/ui/map";
import { STEP } from "@/geo/config";
import type { LatLon } from "@/geo/gpx";
import {
  nearestIndex,
  nearestOnTrace,
  toCoordinates,
  type TraceHit,
} from "../../hover";
import { editorStore, useEditor } from "../../store";

/** Portée du survol du tracé, en pixels */
const HOVER_PIXELS = 10;
/** Sous ce rayon, en pixels, le point existant passe avant la poignée */
const ANCHOR_PIXELS = 16;

/** Le pointeur suit le tracé : une poignée à glisser pour insérer un passage, et le curseur du graphique. */
export const InsertHandle = () => {
  const { map } = useMap();
  const trace = useEditor((state) => state.history.present);
  const pending = useEditor((state) => state.status.pending);
  const editing = useEditor((state) => state.mapMode === "edit");
  const insertPoint = useEditor((state) => state.insertPoint);
  const [hit, setHit] = useState<TraceHit | null>(null);
  const [dragged, setDragged] = useState<LatLon | null>(null);
  // Lu dans l'écouteur de la carte : pendant le glissement, la poignée ne suit plus le tracé.
  const holding = useRef(false);
  // Le relâchement d'un glissement finit par un clic sur la poignée : il ne doit pas insérer un second point.
  const wasDragged = useRef(false);

  useEffect(() => {
    if (!map) return;
    const handleMove = ({ point }: MapMouseEvent): void => {
      const state = editorStore.getState();
      if (holding.current || state.dragging) return;
      wasDragged.current = false;
      const toScreen = ({ lat, lon }: LatLon) => map.project([lon, lat]);
      const found = state.status.pending
        ? null
        : nearestOnTrace(trace.segments, point, toScreen, HOVER_PIXELS);
      const nearAnchor =
        found !== null &&
        trace.anchors.some(({ position }) => {
          const { x, y } = toScreen(position);
          return Math.hypot(x - point.x, y - point.y) < ANCHOR_PIXELS;
        });
      setHit(found && !nearAnchor ? found : null);

      const axis = state.analysis?.axis;
      const hoverS =
        found && axis ? nearestIndex(axis.latLon, found.position) * STEP : null;
      if (hoverS !== state.hoverS) editorStore.setState({ hoverS });
    };
    const handleOut = ({ originalEvent }: MapMouseEvent): void => {
      // Passer du canevas à la poignée n'est pas quitter la carte : sinon elle disparaît sous le pointeur, revient, et le curseur tremble.
      const { relatedTarget } = originalEvent;
      if (
        holding.current ||
        (relatedTarget instanceof Element &&
          relatedTarget.closest(".maplibregl-marker"))
      )
        return;
      setHit(null);
      editorStore.setState({ hoverS: null });
    };
    map.on("mousemove", handleMove);
    map.on("mouseout", handleOut);
    return () => {
      map.off("mousemove", handleMove);
      map.off("mouseout", handleOut);
    };
  }, [map, trace]);

  const provisional = useMemo(() => {
    if (!dragged || !hit) return [];
    const { anchors } = trace;
    const from = anchors[hit.segmentIndex]?.position;
    const to = anchors[hit.segmentIndex + 1]?.position;
    return from && to ? toCoordinates([from, dragged, to]) : [];
  }, [dragged, hit, trace]);

  const insert = (segmentIndex: number, position: LatLon): void => {
    holding.current = false;
    void insertPoint(segmentIndex, position).finally(() => {
      setDragged(null);
      setHit(null);
    });
  };

  return (
    <>
      <MapRoute
        id="insert-drag"
        coordinates={provisional}
        color="#f8fafc"
        width={2}
        opacity={0.9}
        dashArray={[2, 2]}
        interactive={false}
      />
      {hit && !pending && editing && (
        <MapMarker
          longitude={hit.position.lon}
          latitude={hit.position.lat}
          draggable
          onClick={() => {
            if (!wasDragged.current) insert(hit.segmentIndex, hit.position);
          }}
          onDragStart={() => {
            holding.current = true;
            wasDragged.current = true;
          }}
          onDrag={({ lat, lng }) => setDragged({ lat, lon: lng })}
          onDragEnd={({ lat, lng }) =>
            insert(hit.segmentIndex, { lat, lon: lng })
          }
        >
          <MarkerContent>
            <span
              title="Glisser pour ajouter un passage"
              className="block size-4 rounded-full border-2 border-sky-600 bg-white shadow-md"
            />
          </MarkerContent>
        </MapMarker>
      )}
    </>
  );
};
