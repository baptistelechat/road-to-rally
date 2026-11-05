"use client";

import type { ReactNode } from "react";
import { label, menuFocus } from "../hudStyles";

export interface MenuCard<T extends string> {
  id: T;
  name: string;
  preview: ReactNode;
}

interface MenuCardsProps<T extends string> {
  title: string;
  value: T;
  cards: readonly MenuCard<T>[];
  onChoose: (id: T) => void;
}

/** Choix visuel sur une rangée de cartes, sous son titre. La manette les parcourt comme les autres boutons du menu. */
export const MenuCards = <T extends string>({
  title,
  value,
  cards,
  onChoose,
}: MenuCardsProps<T>) => (
  <div className="space-y-2 text-left">
    <span className={label}>{title}</span>
    <div
      role="radiogroup"
      aria-label={title}
      className="grid auto-cols-fr grid-flow-col gap-2"
    >
      {cards.map(({ id, name, preview }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={id === value}
          className={`flex flex-col items-center gap-1 rounded border p-1.5 text-xs font-semibold hover:bg-foreground/10 ${id === value ? "border-brand text-brand" : "border-foreground/15"} ${menuFocus}`}
          onClick={() => onChoose(id)}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none relative block h-24 w-full overflow-hidden rounded-sm bg-muted"
          >
            {preview}
          </span>
          <span className="leading-tight">{name}</span>
        </button>
      ))}
    </div>
  </div>
);
