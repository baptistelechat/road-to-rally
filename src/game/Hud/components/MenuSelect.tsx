"use client";

import { useRef, useState } from "react";
import { label, menuFocus } from "../hudStyles";

export interface MenuOption<T extends string | number | boolean> {
  id: T;
  name: string;
}

interface MenuSelectProps<T extends string | number | boolean> {
  title: string;
  /** Nom du groupe pour un lecteur d'écran, le titre par défaut */
  groupLabel?: string;
  value: T;
  options: readonly MenuOption<T>[];
  autoFocus?: boolean;
  /** Jamais appelé pour la valeur en cours. `close` referme la liste et rend le focus à la ligne. */
  onChoose: (id: T, close: () => void) => void;
}

/**
 * Liste maison plutôt qu'un `select` natif : celui-ci ne s'ouvre pas depuis une manette.
 * `applyMenuAction` la pilote par ses rôles : A ouvre et choisit, haut et bas s'y déplacent, B la referme.
 */
export const MenuSelect = <T extends string | number | boolean>({
  title,
  groupLabel = title,
  value,
  options,
  autoFocus,
  onChoose,
}: MenuSelectProps<T>) => {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const current = options.find(({ id }) => id === value)?.name ?? "";

  const close = (): void => {
    setOpen(false);
    toggle.current?.focus();
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <span className={label}>{title}</span>
      <div
        role="group"
        aria-label={groupLabel}
        className="relative"
        // Garde le focus pendant le clic : Safari ne le donne pas aux boutons, et le blur fermerait la liste.
        onMouseDown={(event) => event.preventDefault()}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return;
          // Sinon Échap fermerait aussi le menu.
          event.stopPropagation();
          close();
        }}
      >
        <button
          ref={toggle}
          type="button"
          autoFocus={autoFocus}
          aria-label={`${title} : ${current}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex max-w-40 items-center gap-2 rounded border border-white/25 bg-neutral-900 px-2 py-0.5 text-xs font-semibold ${menuFocus}`}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span className="truncate">{current}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {open && (
          <div
            role="listbox"
            aria-label={title}
            className="absolute top-full right-0 z-10 mt-1 flex w-40 flex-col gap-1 rounded border border-white/25 bg-neutral-900 p-1"
          >
            {options.map(({ id, name }) => (
              <button
                key={String(id)}
                type="button"
                role="option"
                aria-selected={id === value}
                autoFocus={id === value}
                className={`truncate rounded px-2 py-1 text-left text-xs font-semibold hover:bg-white/15 ${id === value ? "text-amber-400" : ""} ${menuFocus}`}
                onClick={() => (id === value ? close() : onChoose(id, close))}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
