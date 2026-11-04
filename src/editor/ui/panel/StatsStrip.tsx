"use client";

import { editorStore, useEditor } from "../../store";

const decimal = (value: number, digits: number): string =>
  value.toFixed(digits).replace(".", ",");

const showStraight = (highlightStraight: boolean): void =>
  editorStore.setState({ highlightStraight });

/** Tout le score au-dessus de la courbe ; le dénivelé arrive après l'IGN. */
export const StatsStrip = () => {
  const stats = useEditor((state) => state.stats);
  const profile = useEditor((state) => state.profile);
  const analyzing = useEditor((state) => state.analyzing);
  const items = [
    stats && `${decimal(stats.length / 1000, 2)} km`,
    stats && `${decimal(stats.turnsPerKm, 1)} virages/km`,
    stats && `${stats.hairpins} épingle${stats.hairpins > 1 ? "s" : ""}`,
    profile && `↑ ${Math.round(profile.ascent)} m`,
    profile && `↓ ${Math.round(profile.descent)} m`,
    profile && `pente max ${Math.round(profile.maxSlope * 100)} %`,
  ].filter((item): item is string => Boolean(item));

  return (
    <div
      aria-busy={analyzing}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2 text-xs"
    >
      {items.map((item) => (
        <span key={item} className="text-muted-foreground tabular-nums">
          {item}
        </span>
      ))}
      {stats && (
        <span
          // Focusable : le repère de la carte doit aussi s'afficher au clavier.
          tabIndex={0}
          className="rounded text-muted-foreground tabular-nums hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onMouseEnter={() => showStraight(true)}
          onMouseLeave={() => showStraight(false)}
          onFocus={() => showStraight(true)}
          onBlur={() => showStraight(false)}
        >
          ligne droite max {Math.round(stats.longestStraight.length)} m
        </span>
      )}
    </div>
  );
};
