"use client";

import { useId } from "react";
import { CUSTOM_MAP_ID } from "@/game/maps";
import { label } from "../hudStyles";
import {
  chooseMap,
  leaveFor,
  mapChoices,
  returnToEditor,
} from "./Menu/mapChoices";
import { drawerButton, facetSlant } from "./Menu/menuStyles";

/** Éditeur : gris, le texte en retrait des cartes */
const sideButton = `${drawerButton} flex w-full items-center text-left text-muted-foreground hover:text-foreground`;

interface MapSelectProps {
  map: string;
  /** Libellé de la carte en cours : le nom de la spéciale si elle est importée */
  mapLabel: string;
}

/**
 * Road-book de la pause : les cartes numérotées et l'éditeur.
 * Chaque choix rechargent la page sur l'écran « Prêt ».
 */
export const MapSelect = ({ map, mapLabel }: MapSelectProps) => {
  const id = useId();

  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={`${label} mb-2`}>
        Road-book · Carte
      </h2>
      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {mapChoices(map, mapLabel).map(({ id: choiceId, name }, index) => {
          const current = choiceId === map;
          return (
            <li key={choiceId}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                className={`flex min-h-9 w-full items-center gap-2 px-4 text-left text-xs transition-colors focus-line ${facetSlant} ${current ? "bg-brand/20 font-extrabold text-brand" : "bg-secondary font-bold text-secondary-foreground hover:bg-accent"}`}
                onClick={() => chooseMap(map, choiceId, true)}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center rounded-sm font-mono text-[0.8125rem] tabular-nums ${current ? "bg-brand text-brand-foreground" : "bg-background/60"}`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="truncate">{name}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className={sideButton}
            onClick={() => leaveFor("/editor")}
          >
            Ouvrir l&apos;éditeur
          </button>
        </li>
        {map === CUSTOM_MAP_ID && (
          <li>
            <button
              type="button"
              className={sideButton}
              onClick={returnToEditor}
            >
              Retour à l&apos;éditeur
            </button>
          </li>
        )}
      </ol>
    </section>
  );
};
