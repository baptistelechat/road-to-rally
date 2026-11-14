"use client";

import type { ReactNode } from "react";
import { choiceCard, fieldLabel } from "./Menu/menuStyles";

export interface MenuCard<T extends string> {
  id: T;
  name: string;
  preview: ReactNode;
}

const COLUMNS = { 2: "grid-cols-2", 3: "grid-cols-3" } as const;

interface MenuCardsProps<T extends string> {
  title: string;
  value: T;
  cards: readonly MenuCard<T>[];
  columns?: keyof typeof COLUMNS;
  autoFocus?: boolean;
  onChoose: (id: T) => void;
}

/**
 * Choix visuel sur une grille de cartes à aperçu, sous son titre. Un choix sans aperçu passe par `MenuSelect`.
 * La manette les parcourt comme les autres boutons du menu.
 */
export const MenuCards = <T extends string>({
  title,
  value,
  cards,
  columns = 2,
  autoFocus,
  onChoose,
}: MenuCardsProps<T>) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <span className={fieldLabel}>{title}</span>
    <div
      role="radiogroup"
      aria-label={title}
      className={`grid ${COLUMNS[columns]} gap-1.5`}
    >
      {cards.map(({ id, name, preview }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={id === value}
          autoFocus={autoFocus && id === value}
          className={`${choiceCard(id === value)} flex flex-col items-center justify-start gap-1 p-1.5`}
          onClick={() => onChoose(id)}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none relative block h-20 w-full overflow-hidden bg-muted"
          >
            {preview}
          </span>
          {/* Toujours deux lignes de haut : les grilles côte à côte gardent des rangées alignées. */}
          <span className="flex min-h-[2lh] items-center leading-tight">
            {name}
          </span>
        </button>
      ))}
    </div>
  </div>
);
