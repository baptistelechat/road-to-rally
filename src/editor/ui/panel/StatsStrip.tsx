"use client";

import { editorStore, useEditor } from "../../store";

const decimal = (value: number, digits: number): string =>
  value.toFixed(digits).replace(".", ",");

const showStraight = (highlightStraight: boolean): void =>
  editorStore.setState({ highlightStraight });

const row =
  "flex min-h-9 items-baseline justify-between gap-3 border-b py-1.5 text-[0.8125rem]";
const value = "font-mono text-foreground";

/** Tout le score du tracé, dans l'onglet « Score » ; le dénivelé arrive après l'IGN. */
export const StatsStrip = () => {
  const stats = useEditor((state) => state.stats);
  const profile = useEditor((state) => state.profile);
  const analyzing = useEditor((state) => state.analyzing);
  const items: [string, string][] = [
    ...(stats
      ? ([
          ["Longueur", `${decimal(stats.length / 1000, 2)} km`],
          ["Virages", `${decimal(stats.turnsPerKm, 1)} /km`],
          [stats.hairpins > 1 ? "Épingles" : "Épingle", String(stats.hairpins)],
        ] satisfies [string, string][])
      : []),
    ...(profile
      ? ([
          ["Montée", `↑ ${Math.round(profile.ascent)} m`],
          ["Descente", `↓ ${Math.round(profile.descent)} m`],
          ["Pente max", `${Math.round(profile.maxSlope * 100)} %`],
        ] satisfies [string, string][])
      : []),
  ];

  if (items.length === 0)
    return (
      <p aria-busy={analyzing} className="text-sm text-muted-foreground">
        {analyzing ? "Calcul du score…" : "Aucun tracé"}
      </p>
    );

  return (
    <dl aria-busy={analyzing} className="flex flex-col text-muted-foreground">
      {items.map(([label, text]) => (
        <div key={label} className={row}>
          <dt>{label}</dt>
          <dd className={value}>{text}</dd>
        </div>
      ))}
      {stats && (
        <div
          // Focusable : le repère de la carte doit aussi s'afficher au clavier.
          tabIndex={0}
          className={`${row} rounded-md hover:bg-accent/60 focus-line-visible`}
          onMouseEnter={() => showStraight(true)}
          onMouseLeave={() => showStraight(false)}
          onFocus={() => showStraight(true)}
          onBlur={() => showStraight(false)}
        >
          <dt>Ligne droite max</dt>
          <dd className={value}>
            {Math.round(stats.longestStraight.length)} m
          </dd>
        </div>
      )}
    </dl>
  );
};
