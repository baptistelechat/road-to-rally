"use client";

import { useEffect } from "react";
import type { LatLon } from "@/geo/gpx";
import { editorStore, useEditor } from "../store";
import { EditorLayout } from "./EditorLayout";
import { MapLayers } from "./map/MapLayers";
import { ProfilePanel } from "./panel/ProfilePanel";
import { useTraceAnalysis } from "./useTraceAnalysis";

/** `Ctrl+Z`, `Ctrl+Y` et `Ctrl+Maj+Z`. Dans un champ de texte, ils gardent leur sens habituel. */
const useUndoShortcuts = (): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return;
      const { target } = event;
      if (
        target instanceof HTMLElement &&
        target.matches("input, textarea, [contenteditable]")
      )
        return;
      const key = event.key.toLowerCase();
      const redo = key === "y" || (key === "z" && event.shiftKey);
      if (key !== "z" && !redo) return;
      event.preventDefault();
      const { undo, redo: redoTrace } = editorStore.getState();
      if (redo) redoTrace();
      else undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
};

/** Hors du composant : stable, sans réabonner la carte. Un clic près d'un point est filtré par `MapClickHandler`. */
const handleMapClick = (position: LatLon): void => {
  void editorStore.getState().addPoint(position);
};

/** L'orchestrateur de l'éditeur : `EditorLayout` place, le store porte l'état. */
export const EditorApp = () => {
  const trace = useEditor((state) => state.history.present);
  useTraceAnalysis(
    trace.segments,
    trace.returnRoute,
    trace.runIn,
    trace.runOut,
  );
  useUndoShortcuts();
  useEffect(() => {
    void editorStore.getState().refreshRunoffs();
  }, []);

  return (
    <EditorLayout
      onMapClick={handleMapClick}
      mapChildren={<MapLayers />}
      profile={trace.segments.length > 0 ? <ProfilePanel /> : undefined}
    />
  );
};
