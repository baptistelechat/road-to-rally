"use client";

import { useState } from "react";
import { BridgesSection } from "./sections/BridgesSection";
import { BuildingsSection } from "./sections/BuildingsSection";
import { CrowdSection } from "./sections/CrowdSection";
import { LooksSection } from "./sections/LooksSection";
import { ObstaclesSection } from "./sections/ObstaclesSection";
import { VegetationSection } from "./sections/VegetationSection";

// Labo des propositions de l'epic 5 : on compare des modèles avant de les intégrer au jeu.
const TABS = [
  { id: "buildings", label: "Bâtiments", Section: BuildingsSection },
  { id: "vegetation", label: "Végétation", Section: VegetationSection },
  { id: "crowd", label: "Public et banderoles", Section: CrowdSection },
  { id: "looks", label: "Ambiances", Section: LooksSection },
  { id: "bridges", label: "Ponts", Section: BridgesSection },
  { id: "obstacles", label: "Obstacles", Section: ObstaclesSection },
] as const;

type TabId = (typeof TABS)[number]["id"];

const readTab = (): TabId => {
  const value = new URLSearchParams(window.location.search).get("tab");
  return TABS.find((tab) => tab.id === value)?.id ?? "buildings";
};

export const DecorLab = () => {
  const [tab, setTab] = useState<TabId>(readTab);
  const current = TABS.find((entry) => entry.id === tab) ?? TABS[0];
  const select = (id: TabId): void => {
    setTab(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-900 text-neutral-100">
      <nav
        className="flex gap-2 border-b border-neutral-700 p-3"
        aria-label="Sections du labo"
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => select(entry.id)}
            aria-pressed={entry.id === tab}
            className={`rounded px-3 py-1.5 text-sm ${entry.id === tab ? "bg-neutral-100 text-neutral-900" : "bg-neutral-800 hover:bg-neutral-700"}`}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      <main className="relative min-h-0 flex-1">
        <current.Section />
      </main>
    </div>
  );
};
