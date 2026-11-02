"use client";

import { ArrowLeft } from "lucide-react";
import { useId, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { EDITOR_URL } from "@/game/maps";
import type { LatLon } from "@/geo/gpx";
import { EditorMap } from "./EditorMap";

interface EditorLayoutProps {
  /** Clic sur le fond de carte, jamais sur la recherche ou les contrôles */
  onMapClick?: (position: LatLon) => void;
  /** Rendu dans la carte : `MapMarker`, `MapRoute` et tout ce qui utilise `useMap` */
  mapChildren?: ReactNode;
  /** Sous la carte. Absent : la carte prend toute la hauteur. */
  profile?: ReactNode;
  points?: ReactNode;
  chicanes?: ReactNode;
  score?: ReactNode;
  /** Bas du panneau : le bouton « Rouler » */
  actions?: ReactNode;
}

interface PanelZoneProps {
  title: string;
  children?: ReactNode;
}

const PanelZone = ({ title, children }: PanelZoneProps) => {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="border-b px-4 py-3">
      <h2
        id={titleId}
        className="mb-2 text-xs font-semibold text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  );
};

/** La disposition seulement : l'état du tracé arrive par les props. */
export const EditorLayout = ({
  onMapClick,
  mapChildren,
  profile,
  points,
  chicanes,
  score,
  actions,
}: EditorLayoutProps) => (
  <div className="dark shadcn-theme flex h-full flex-col md:flex-row">
    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <EditorMap onMapClick={onMapClick}>{mapChildren}</EditorMap>
      </div>
      {profile && (
        <section aria-label="Profil d'altitude" className="border-t">
          {profile}
        </section>
      )}
    </main>
    <aside
      aria-label="Spéciale"
      className="flex max-h-[45%] w-full shrink-0 flex-col overflow-y-auto border-t md:max-h-none md:w-80 md:border-t-0 md:border-l"
    >
      <header className="flex items-center gap-2 border-b px-2 py-2">
        {/* Une vraie navigation : la carte et son contexte WebGL sont libérés. */}
        <a
          href={EDITOR_URL}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft aria-hidden="true" />
          Mes spéciales
        </a>
        <h1 className="text-sm font-semibold">Éditeur</h1>
      </header>
      <PanelZone title="Points">{points}</PanelZone>
      <PanelZone title="Chicanes">{chicanes}</PanelZone>
      <PanelZone title="Score">{score}</PanelZone>
      {actions && <div className="mt-auto p-4">{actions}</div>}
    </aside>
  </div>
);
