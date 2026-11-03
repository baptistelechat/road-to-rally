"use client";

import { label, menuFocus } from "../hudStyles";

interface MenuSliderProps {
  title: string;
  /** En pourcentage, cran de `step` */
  value: number;
  step?: number;
  onChange: (value: number) => void;
}

/** Curseur natif : flèches au clavier, gauche et droite à la manette par `applyMenuAction`. */
export const MenuSlider = ({
  title,
  value,
  step = 10,
  onChange,
}: MenuSliderProps) => (
  <label className="flex items-center justify-between gap-3">
    <span className={label}>{title}</span>
    <span className="flex w-40 items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={step}
        value={value}
        aria-valuetext={`${value} %`}
        className={`h-1.5 min-w-0 flex-1 cursor-pointer accent-amber-400 ${menuFocus}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-9 text-right text-xs font-semibold tabular-nums">
        {value} %
      </span>
    </span>
  </label>
);
