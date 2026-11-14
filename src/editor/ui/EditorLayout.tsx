"use client";

import type { ReactNode } from "react";
import type { LatLon } from "@/geo/gpx";
import { EditorMap } from "./EditorMap";
import { TopBar } from "./TopBar";

interface EditorLayoutProps {
  /** Clic sur le fond de carte, jamais sur la recherche ou les contrôles */
  onMapClick?: (position: LatLon) => void;
  /** Rendu dans la carte : `MapMarker`, `MapRoute`, les panneaux flottants et tout ce qui utilise `useMap` */
  mapChildren?: ReactNode;
  /** Sous la carte. Absent : la carte prend toute la hauteur. */
  profile?: ReactNode;
}

/** La disposition seulement : la barre en haut, la carte, le profil dessous. Le reste s'ouvre à la demande. */
export const EditorLayout = ({
  onMapClick,
  mapChildren,
  profile,
}: EditorLayoutProps) => (
  <div className="dark shadcn-theme flex h-full flex-col">
    <TopBar />
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
  </div>
);
