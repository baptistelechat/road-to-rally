"use client";

import { useEffect } from "react";
import { editorStore, useEditor } from "../store";
import { EditorLayout } from "./EditorLayout";
import { MapLayers } from "./map/MapLayers";
import { ChicanePanel } from "./panel/ChicanePanel";
import { IssueList } from "./panel/IssueList";
import { PointsPanel } from "./panel/PointsPanel";
import { ProfilePanel } from "./panel/ProfilePanel";
import { RollPanel } from "./panel/RollPanel";
import { ScorePanel } from "./panel/ScorePanel";
import { VariantPanel } from "./panel/VariantPanel";
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

/** L'orchestrateur de l'éditeur : `EditorLayout` place, le store porte l'état. */
export const EditorApp = () => {
  const trace = useEditor((state) => state.history.present);
  const addPoint = useEditor((state) => state.addPoint);
  useTraceAnalysis(trace.segments, trace.returnRoute);
  useUndoShortcuts();

  return (
    <EditorLayout
      onMapClick={addPoint}
      mapChildren={<MapLayers />}
      profile={trace.segments.length > 0 ? <ProfilePanel /> : undefined}
      points={
        <>
          <PointsPanel />
          <VariantPanel />
        </>
      }
      chicanes={<ChicanePanel />}
      score={<ScorePanel />}
      actions={
        <div className="space-y-4">
          <IssueList />
          <RollPanel />
        </div>
      }
    />
  );
};
