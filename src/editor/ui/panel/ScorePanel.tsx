"use client";

import type { ReactNode } from "react";
import { editorStore, useEditor } from "../../store";

const EMPTY = "—";

const decimal = (value: number, digits: number): string =>
  value.toFixed(digits).replace(".", ",");

const Row = ({ term, children }: { term: string; children: ReactNode }) => (
  <div className="flex justify-between gap-2">
    <dt className="text-muted-foreground">{term}</dt>
    <dd className="font-medium tabular-nums">{children}</dd>
  </div>
);

/** Le dénivelé arrive après l'IGN : ses lignes existent déjà, la mise en page ne saute pas. */
export const ScorePanel = () => {
  const stats = useEditor((state) => state.stats);
  const profile = useEditor((state) => state.profile);
  const analyzing = useEditor((state) => state.analyzing);

  if (!stats)
    return (
      <p className="text-sm text-muted-foreground">
        Le score apparaît dès que le tracé peut être analysé.
      </p>
    );

  const showStraight = (highlightStraight: boolean): void =>
    editorStore.setState({ highlightStraight });

  return (
    <div aria-busy={analyzing} className="space-y-2 text-sm">
      <p>
        Route <strong className="font-semibold">{stats.verdict}</strong>
      </p>
      <dl className="space-y-1">
        <Row term="Longueur">{decimal(stats.length / 1000, 2)} km</Row>
        <Row term="Virages par km">{decimal(stats.turnsPerKm, 1)}</Row>
        <Row term="Épingles">{stats.hairpins}</Row>
        <Row term="Dénivelé positif">
          {profile ? `${Math.round(profile.ascent)} m` : EMPTY}
        </Row>
        <Row term="Dénivelé négatif">
          {profile ? `${Math.round(profile.descent)} m` : EMPTY}
        </Row>
        <div
          // Focusable : le repère de la carte doit aussi s'afficher au clavier.
          tabIndex={0}
          className="flex justify-between gap-2 rounded hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onMouseEnter={() => showStraight(true)}
          onMouseLeave={() => showStraight(false)}
          onFocus={() => showStraight(true)}
          onBlur={() => showStraight(false)}
        >
          <dt className="text-muted-foreground">Plus longue ligne droite</dt>
          <dd className="font-medium tabular-nums">
            {Math.round(stats.longestStraight.length)} m
          </dd>
        </div>
      </dl>
    </div>
  );
};
