"use client";

import { useEffect, useMemo, useState } from "react";
import { BuildingsScene } from "../buildings/BuildingsScene";
import { IgnGuide } from "../buildings/IgnGuide";
import { type Selection, layoutFor } from "../buildings/placement";
import { villageStats } from "../buildings/stats";
import { TrianglesTable } from "../buildings/TrianglesTable";
import { type RoofChoice, TYPOLOGIES } from "../buildings/typologies";

interface Option<T extends string> {
  id: T;
  label: string;
}

const ROOF_CHOICES: Option<RoofChoice>[] = [
  { id: "auto", label: "Selon le type" },
  { id: "hip", label: "Croupe" },
  { id: "gable", label: "Pignon" },
];

const SELECTIONS: Option<Selection>[] = [
  { id: "all", label: "Vue d'ensemble" },
  ...TYPOLOGIES.map((t) => ({ id: t.id, label: t.label })),
];

const buttonClass = (active: boolean): string =>
  `rounded px-2 py-1 text-xs ${active ? "bg-neutral-100 text-neutral-900" : "bg-neutral-800 hover:bg-neutral-700"}`;

/** Propositions de bâtiments : typologies en proche et en lointain, triangles, lecture des données IGN. */
export const BuildingsSection = () => {
  const [selection, setSelection] = useState<Selection>("bourg");
  const [choice, setChoice] = useState<RoofChoice>("auto");
  const layout = useMemo(
    () => layoutFor(selection, choice),
    [selection, choice],
  );
  const stats = useMemo(() => villageStats(choice), [choice]);
  const typology = TYPOLOGIES.find((t) => t.id === selection);

  useEffect(
    () => () => {
      for (const lot of layout.lots) lot.geometry.dispose();
    },
    [layout],
  );

  return (
    <div className="absolute inset-0 flex">
      <div className="relative min-w-0 flex-1">
        {/* Nouvelle caméra à chaque typologie, cadrée sur ses maquettes. */}
        <BuildingsScene key={selection} layout={layout} />
        {typology && (
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-xl space-y-1 rounded bg-black/70 p-3 text-xs text-neutral-200">
            <p className="font-semibold">{typology.label}</p>
            {typology.variants.map((v, i) => (
              <p key={v.id}>
                <span className="font-semibold">{i === 0 ? "A" : "B"} · </span>
                {v.note}
                {v.choosable && (
                  <span className="text-amber-300">
                    {" "}
                    Croupe ou pignon au choix.
                  </span>
                )}
              </p>
            ))}
            <p className="text-neutral-400">
              Devant : version proche. Derrière : version lointaine (sans débord
              ni ouvertures, pied assombri par la couleur des sommets).
            </p>
          </div>
        )}
      </div>
      <aside
        aria-label="Réglages et chiffres des bâtiments"
        className="w-[26rem] shrink-0 space-y-4 overflow-y-auto border-l border-neutral-700 p-4"
      >
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">Typologie</legend>
          <div className="flex flex-wrap gap-1.5">
            {SELECTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === selection}
                onClick={() => setSelection(option.id)}
                className={buttonClass(option.id === selection)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">
            Toit des maisons
          </legend>
          <div className="flex gap-1.5">
            {ROOF_CHOICES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === choice}
                onClick={() => setChoice(option.id)}
                className={buttonClass(option.id === choice)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-400">
            S&apos;applique aux pavillons, longères, immeuble B, remise et
            emprises de repli. Une croupe impossible (emprise concave) retombe
            sur deux pans, puis sur un toit plat.
          </p>
        </fieldset>
        <TrianglesTable stats={stats} />
        <IgnGuide />
      </aside>
    </div>
  );
};
