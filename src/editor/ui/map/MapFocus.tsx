"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@/components/ui/map";
import { editorStore, useEditor } from "../../store";
import { assembleTrace } from "../../trace";

/** Cadrage du brouillon à l'ouverture */
const FRAME_ZOOM = 14;
/** Un point demandé depuis le panneau ou la courbe : assez près pour voir la route et la saisir */
const FOCUS_ZOOM = 17;
/** Ce que cachent le panneau latéral (22,5 rem) et le profil d'altitude : le cadrage se fait dans le reste. */
const COVERED = { top: 0, right: 0, bottom: 240, left: 360 };
const FRAME_PADDING = {
  top: 80,
  right: 80,
  bottom: COVERED.bottom + 40,
  left: COVERED.left + 80,
};

/** Montre le brouillon relu à l'ouverture, puis tout endroit demandé depuis le panneau. Ne dessine rien. */
export const MapFocus = () => {
  const { map, isLoaded } = useMap();
  const focus = useEditor((state) => state.focus);
  const framed = useRef(false);

  useEffect(() => {
    if (!map || !isLoaded || framed.current) return;
    framed.current = true;
    const trace = editorStore.getState().history.present;
    const points = trace.segments.length
      ? assembleTrace(trace)
      : trace.anchors.map((anchor) => anchor.position);
    if (points.length === 0) return;
    const lats = points.map(({ lat }) => lat);
    const lons = points.map(({ lon }) => lon);
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: FRAME_PADDING, maxZoom: FRAME_ZOOM, duration: 0 },
    );
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !focus) return;
    const { lat, lon } = focus.position;
    map.flyTo({
      center: [lon, lat],
      zoom: FOCUS_ZOOM,
      padding: COVERED,
    });
  }, [map, focus]);

  return null;
};
