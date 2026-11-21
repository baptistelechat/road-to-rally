"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useEditor } from "../store";
import { missingRunoff } from "../trace";
import { ChicanePanel } from "./panel/ChicanePanel";
import { IssueList } from "./panel/IssueList";
import { PointsPanel } from "./panel/PointsPanel";
import { StatsStrip } from "./panel/StatsStrip";
import { VariantPanel } from "./panel/VariantPanel";
import { PlaceSearch } from "./PlaceSearch";
import { mapSurface } from "./styles";
import { useChicanes } from "./useChicanes";

type TabId = "points" | "chicanes" | "score";
const TABS: TabId[] = ["points", "chicanes", "score"];

/** Les problèmes en permanence sous les onglets : bloquants en rouge, à savoir en jaune. */
const Issues = () => {
  const issues = useEditor((state) => state.issues);
  const analysisError = useEditor((state) => state.analysisError);
  const trace = useEditor((state) => state.history.present);
  const missing = missingRunoff(trace);
  if (issues.length === 0 && !missing && !analysisError) return null;
  const blocking =
    analysisError !== null ||
    missing !== null ||
    issues.some((issue) => issue.blocking);
  return (
    <div
      className={`rounded-lg border p-3 ${
        blocking
          ? "border-destructive/45 bg-destructive/10"
          : "border-brand/45 bg-brand/10"
      }`}
    >
      <IssueList />
    </div>
  );
};

/** À gauche de la carte : chercher un lieu, puis les points, les chicanes et le score du tracé. Rendu dans `Map` (la recherche déplace la carte). */
export const SidePanel = () => {
  const baseId = useId();
  const [tab, setTab] = useState<TabId>("points");
  const points = useEditor((state) => state.history.present.anchors.length);
  const chicanes = useChicanes().length;
  const chicanesEnabled = useEditor(
    (state) => state.history.present.chicanesEnabled,
  );
  const labels: Record<TabId, string> = {
    points: `Points (${points})`,
    // Coupées, « (0) » passerait pour un tracé sans ligne droite : l'état se lit sans ouvrir l'onglet.
    chicanes: chicanesEnabled ? `Chicanes (${chicanes})` : "Chicanes (retirées)",
    score: "Score",
  };

  // Les flèches passent d'un onglet à l'autre, comme le veut le motif « tabs ».
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length];
    setTab(next);
    document.getElementById(`${baseId}-${next}-tab`)?.focus();
  };

  return (
    <aside
      aria-label="Spéciale"
      className={`absolute inset-y-0 left-0 z-10 flex w-[22.5rem] flex-col gap-3.5 overflow-y-auto border-r px-4.5 py-4 ${mapSurface}`}
    >
      <PlaceSearch />
      <div
        role="tablist"
        aria-label="Panneaux"
        className="grid grid-cols-3 gap-1"
        onKeyDown={handleKeyDown}
      >
        {TABS.map((id) => {
          const selected = id === tab;
          return (
            <button
              key={id}
              id={`${baseId}-${id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-${id}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`min-h-10 border-b-3 text-[0.8125rem] transition-colors focus-line-visible ${
                selected
                  ? "border-brand bg-accent font-extrabold text-brand"
                  : "border-border font-semibold text-foreground hover:bg-accent/60"
              }`}
              onClick={() => setTab(id)}
            >
              {labels[id]}
            </button>
          );
        })}
      </div>
      <div
        id={`${baseId}-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-${tab}-tab`}
      >
        {tab === "points" && (
          <>
            <PointsPanel />
            <VariantPanel />
          </>
        )}
        {tab === "chicanes" && <ChicanePanel />}
        {tab === "score" && <StatsStrip />}
      </div>
      <Issues />
    </aside>
  );
};
