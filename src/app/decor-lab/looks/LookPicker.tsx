"use client";

import {
  LOOK_NAMES,
  LOOK_PRESETS,
  LOOKS,
  type LookId,
  MENU_LOOKS,
} from "@/render/look";

interface LookPickerProps {
  look: LookId;
  onChoose: (look: LookId) => void;
  /** Ramène la caméra à la position de poursuite */
  onReframe: () => void;
}

/** Pastille de couleur avec sa valeur, pour lire les données de l'ambiance */
const Swatch = ({ label, color }: { label: string; color: string }) => (
  <div className="flex items-center gap-2">
    <span
      aria-hidden="true"
      className="size-3.5 shrink-0 rounded-sm border border-neutral-600"
      style={{ backgroundColor: color }}
    />
    <span className="text-neutral-400">{label}</span>
    <span className="ml-auto font-mono">{color}</span>
  </div>
);

/** Sélecteur des ambiances du labo, touches 1 à 8 comprises, et valeurs de celle affichée. */
export const LookPicker = ({ look, onChoose, onReframe }: LookPickerProps) => {
  const preset = LOOK_PRESETS[look];
  const { x, y, z } = preset.sun.offset;
  const elevation = Math.round(
    (Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI,
  );
  return (
    <aside className="pointer-events-auto absolute top-3 left-3 flex w-72 flex-col gap-3 rounded bg-neutral-900/85 p-3 text-xs text-neutral-100">
      <div
        role="group"
        aria-label="Ambiances"
        className="grid grid-cols-2 gap-1.5"
      >
        {LOOKS.map((id, i) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === look}
            aria-keyshortcuts={String(i + 1)}
            onClick={() => onChoose(id)}
            className={`rounded px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-neutral-100 ${id === look ? "bg-neutral-100 text-neutral-900" : "bg-neutral-800 hover:bg-neutral-700"}`}
          >
            <span className="font-mono text-neutral-500">{i + 1}</span>{" "}
            {LOOK_NAMES[id]}
            {!MENU_LOOKS.includes(id) && (
              <span className="text-neutral-500"> (labo)</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Swatch label="Ciel et brouillard" color={preset.sky} />
        <Swatch label="Hémisphère, ciel" color={preset.hemisphere.sky} />
        <Swatch label="Hémisphère, sol" color={preset.hemisphere.ground} />
        <Swatch label="Soleil" color={preset.sun.color} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1">
          <dt className="text-neutral-400">Brouillard</dt>
          <dd className="text-right font-mono">
            {preset.fog.near} → {preset.fog.far} m
          </dd>
          <dt className="text-neutral-400">Hémisphère</dt>
          <dd className="text-right font-mono">
            {preset.hemisphere.intensity}
          </dd>
          <dt className="text-neutral-400">Soleil</dt>
          <dd className="text-right font-mono">
            {preset.sun.intensity} · {elevation}° de haut
          </dd>
        </dl>
      </div>
      <button
        type="button"
        onClick={onReframe}
        className="rounded bg-neutral-800 px-2 py-1.5 hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-neutral-100"
      >
        Recadrer en vue poursuite
      </button>
    </aside>
  );
};
