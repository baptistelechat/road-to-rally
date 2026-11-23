"use client";

import { setHudScreen } from "@/game/hudStore";
import { CUSTOM_MAP_ID } from "@/game/maps";
import { leaveFor, returnToEditor } from "./mapChoices";
import { LookSelect } from "./LookSelect";
import { MapCards } from "./MapCards";
import {
  brandStartButton,
  facetBanner,
  facetButton,
  facetTile,
  grayButton,
} from "./menuStyles";

const navButton = `grid min-h-11 min-w-[9.375rem] place-items-center px-6 text-sm ${grayButton} ${facetButton}`;

interface StartMenuProps {
  map: string;
  mapLabel: string;
  /** Retour des options : le focus revient sur leur bouton. */
  returned: boolean;
  onOptions: () => void;
}

/**
 * Menu de départ (maquette R-Menu) : bandeau facetté, cartes de tracés, départ.
 * La scène 3D reste visible derrière : seul le bandeau la voile.
 */
export const StartMenu = ({
  map,
  mapLabel,
  returned,
  onOptions,
}: StartMenuProps) => {
  return (
    <dialog
      open
      aria-labelledby="menu-title"
      className="pointer-events-auto absolute inset-0 z-20 m-0 size-full max-h-none max-w-none border-0 bg-transparent p-0 text-foreground opacity-100 transition-opacity duration-200 starting:opacity-0"
    >
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[min(18.75rem,34vh)] bg-background/88 ${facetBanner}`}
      />
      <h1
        id="menu-title"
        className="absolute top-[min(2.5rem,4vh)] left-1/2 m-0 flex -translate-x-1/2 items-center gap-[clamp(1rem,2vw,1.75rem)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique : `next/image` n'apporte rien et refuse le SVG sans réglage. */}
        <img
          src="/icon.svg"
          alt=""
          className={`size-[clamp(4rem,14vh,8.25rem)] ${facetTile}`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
        <img
          src="/brand/road-to-rally.svg"
          alt="Road to Rally"
          className="h-auto w-[clamp(10rem,34vh,20rem)]"
        />
      </h1>

      <section
        aria-label="Départ"
        className="absolute bottom-[min(3rem,5vh)] left-1/2 flex w-[min(70rem,calc(100%-2rem))] -translate-x-1/2 flex-col items-center gap-5"
      >
        <MapCards map={map} mapLabel={mapLabel} />
        <LookSelect />
        <button
          type="button"
          autoFocus={!returned}
          data-needs-sound=""
          className={`min-h-18 w-full max-w-[32.5rem] px-10 font-display text-xl tracking-[0.06em] uppercase ${brandStartButton}`}
          onClick={() => setHudScreen("race")}
        >
          Prendre le départ
        </button>
        <nav
          aria-label="Autres écrans"
          className="flex flex-wrap justify-center gap-2.5"
        >
          {map === CUSTOM_MAP_ID && (
            <button
              type="button"
              className={navButton}
              onClick={returnToEditor}
            >
              Retour à l&apos;éditeur
            </button>
          )}
          <button
            type="button"
            className={navButton}
            onClick={() => leaveFor("/garage")}
          >
            Garage
          </button>
          <button
            type="button"
            className={navButton}
            onClick={() => leaveFor("/editor")}
          >
            Éditeur
          </button>
          <button
            type="button"
            autoFocus={returned}
            className={navButton}
            onClick={onOptions}
          >
            Options
          </button>
        </nav>
      </section>
    </dialog>
  );
};
