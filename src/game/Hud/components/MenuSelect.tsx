"use client";

import { choice, fieldLabel } from "./Menu/menuStyles";

export interface MenuOption<T extends string | number | boolean> {
  id: T;
  name: string;
}

interface MenuSelectProps<T extends string | number | boolean> {
  title: string;
  value: T;
  options: readonly MenuOption<T>[];
  autoFocus?: boolean;
  /** Jamais appelé pour la valeur en cours */
  onChoose: (id: T) => void;
}

/**
 * Choix court en boutons biseautés côte à côte, tous visibles d'emblée (maquette R-Pause). Largeur fixe : les colonnes s'alignent.
 * `applyMenuAction` le traite comme une rangée de cartes : haut et bas entrent sur le choix en cours, gauche et droite parcourent, A choisit.
 */
export const MenuSelect = <T extends string | number | boolean>({
  title,
  value,
  options,
  autoFocus,
  onChoose,
}: MenuSelectProps<T>) => (
  // Le groupe couvre toute la rangée, libellé compris : à la manette, descendre d'ici part de toute la largeur.
  <div
    role="radiogroup"
    aria-label={title}
    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
  >
    <span aria-hidden="true" className={fieldLabel}>
      {title}
    </span>
    <div className="flex gap-1">
      {options.map(({ id, name }) => (
        <button
          key={String(id)}
          type="button"
          role="radio"
          aria-checked={id === value}
          autoFocus={autoFocus && id === value}
          className={choice(id === value)}
          onClick={() => {
            if (id !== value) onChoose(id);
          }}
        >
          {name}
        </button>
      ))}
    </div>
  </div>
);
