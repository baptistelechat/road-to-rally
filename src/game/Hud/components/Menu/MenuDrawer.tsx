"use client";

import type { ReactNode } from "react";

interface MenuDrawerProps {
  title: string;
  /** À droite du titre : carte et chrono en pause */
  aside?: ReactNode;
  children: ReactNode;
  /** Clic sur la scène voilée : ferme le drawer, comme B */
  onDismiss: () => void;
}

/** Drawer road-book à gauche (maquette R-Pause), la scène voilée à droite. `applyMenuAction` y trouve les commandes par `dialog[open]`. */
export const MenuDrawer = ({
  title,
  aside,
  children,
  onDismiss,
}: MenuDrawerProps) => (
  <>
    {/* Souris seulement : au clavier Échap, à la manette B font la même chose. */}
    <div
      aria-hidden="true"
      className="pointer-events-auto absolute inset-0 z-20 bg-background/45"
      onClick={onDismiss}
    />
    <dialog
      open
      aria-modal="true"
      aria-labelledby="menu-title"
      className="pointer-events-auto absolute inset-y-0 left-0 z-20 m-0 flex h-full max-h-none w-[min(47.5rem,100%)] max-w-none flex-col gap-4.5 overflow-y-auto border-0 border-r border-border bg-background px-5 py-8 text-foreground transition-transform duration-200 starting:-translate-x-full sm:px-9"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 id="menu-title" className="m-0 font-display text-[1.375rem]">
          {title}
        </h1>
        {aside}
      </div>
      {children}
    </dialog>
  </>
);
