"use client";

import type { ReactNode } from "react";
import type { LatLon } from "@/geo/gpx";
import { EditorMap } from "./EditorMap";
import { mapSurface } from "./styles";
import { TopBar } from "./TopBar";

interface EditorLayoutProps {
  /** Clic sur le fond de carte, jamais sur la recherche ou les contrôles */
  onMapClick?: (position: LatLon) => void;
  /** Rendu dans la carte : `MapMarker`, `MapRoute`, les panneaux flottants et tout ce qui utilise `useMap` */
  mapChildren?: ReactNode;
  /** Posé sur la carte, en bas. Absent : rien ne masque la carte. */
  profile?: ReactNode;
}

/** La disposition seulement : la barre en haut, la carte pleine page, le panneau à gauche et le profil en bas flottent dessus. */
export const EditorLayout = ({
  onMapClick,
  mapChildren,
  profile,
}: EditorLayoutProps) => (
  <div className="dark flex h-full flex-col bg-background text-foreground">
    <TopBar />
    <main className="relative min-h-0 min-w-0 flex-1">
      <EditorMap onMapClick={onMapClick}>{mapChildren}</EditorMap>
      {profile && (
        <section
          aria-label="Profil d'altitude"
          // Au-dessus du crédit des tuiles, à droite du panneau, à gauche des boutons de la carte.
          className={`absolute right-16 bottom-9 left-[23.5rem] z-10 pt-3 pr-4 pl-8 [clip-path:polygon(2%_0,100%_0,100%_100%,0_100%,0_12%)] ${mapSurface}`}
        >
          {profile}
        </section>
      )}
    </main>
  </div>
);
