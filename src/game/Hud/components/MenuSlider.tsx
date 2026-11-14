"use client";

import { fieldLabel } from "./Menu/menuStyles";

interface MenuSliderProps {
  title: string;
  /** En pourcentage, cran de `step` */
  value: number;
  step?: number;
  onChange: (value: number) => void;
}

/**
 * Curseur natif : flèches au clavier, gauche et droite à la manette par `applyMenuAction`.
 * Même colonne que les paires de choix de `MenuSelect` (deux boutons `w-28` et leur `gap-1`).
 */
export const MenuSlider = ({
  title,
  value,
  step = 10,
  onChange,
}: MenuSliderProps) => (
  <label className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <span className={fieldLabel}>{title}</span>
    <span className="flex w-57 shrink-0 items-center gap-2.5">
      <input
        type="range"
        min={0}
        max={100}
        step={step}
        value={value}
        aria-valuetext={`${value} %`}
        // `h-6` : les traits du focus encadrent la piste au lieu de la recouvrir.
        className="h-6 w-full min-w-0 cursor-pointer accent-brand focus-line"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums">
        {value}
      </span>
    </span>
  </label>
);
