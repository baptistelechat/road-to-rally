"use client";

import { useRef } from "react";
import { chooseMap, type MapChoice, mapChoices } from "./mapChoices";
import { TRACE_HEIGHT, TRACE_WIDTH, useMapTrace } from "./mapTraces";
import { facetButton, grayButton } from "./menuStyles";

/** Au-delà, les cartes passent dans un bandeau qui défile : toujours une seule ligne. */
const VISIBLE = 4;
/** Écart entre deux cartes, la classe `gap-4` */
const GAP_PX = 16;

const MapCard = ({
  choice: { id, name, kind },
  current,
  className,
  onChoose,
}: {
  choice: MapChoice;
  current: boolean;
  className: string;
  onChoose: () => void;
}) => {
  const trace = useMapTrace(id);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={current}
      className={`overflow-hidden rounded border-2 bg-card text-card-foreground transition-colors hover:bg-accent focus-line ${current ? "border-brand" : "border-border"} ${className}`}
      onClick={onChoose}
    >
      <svg
        viewBox={`0 0 ${TRACE_WIDTH} ${TRACE_HEIGHT}`}
        aria-hidden="true"
        className={`block h-[6.875rem] w-full bg-background ${current ? "text-brand" : "text-muted-foreground"}`}
      >
        {trace && (
          <path
            d={trace}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span className="flex flex-col items-center gap-1 px-3.5 py-3">
        <span className="text-base font-extrabold">{name}</span>
        <span
          className={`font-display text-[0.5625rem] tracking-[0.18em] uppercase ${current ? "text-brand" : "text-muted-foreground"}`}
        >
          {kind}
        </span>
      </span>
    </button>
  );
};

const arrowButton = `grid size-11 shrink-0 place-items-center self-center text-lg ${grayButton} ${facetButton}`;

interface MapCardsProps {
  map: string;
  mapLabel: string;
}

/**
 * Cartes de tracés du menu de départ. Une rangée de radios : la manette la parcourt à gauche et à droite.
 * Plus de quatre cartes : un bandeau défilant, avec des flèches pour la souris ; la manette y fait venir la carte focalisée.
 */
export const MapCards = ({ map, mapLabel }: MapCardsProps) => {
  const strip = useRef<HTMLDivElement>(null);
  const choices = mapChoices(map, mapLabel);
  const scrolling = choices.length > VISIBLE;
  const cards = choices.map((choice) => (
    <MapCard
      key={choice.id}
      choice={choice}
      current={choice.id === map}
      // Quatre cartes pleines dans le bandeau : la cinquième dépasse et invite à défiler.
      className={scrolling ? "w-[calc((100%-3rem)/4)] shrink-0 snap-start" : ""}
      onChoose={() => chooseMap(map, choice.id)}
    />
  ));
  if (!scrolling)
    return (
      <div
        role="radiogroup"
        aria-label="Spéciale"
        className="grid w-full grid-cols-[repeat(auto-fit,minmax(9rem,16.25rem))] justify-center gap-4"
      >
        {cards}
      </div>
    );
  const scroll = (direction: -1 | 1): void => {
    const element = strip.current;
    const card = element?.firstElementChild;
    if (!element || !card) return;
    // Défilement doux réglé en CSS : `motion-reduce` le coupe.
    element.scrollBy({
      left: direction * (card.getBoundingClientRect().width + GAP_PX),
    });
  };
  return (
    <div className="flex w-full items-stretch gap-3">
      <button
        type="button"
        aria-label="Cartes précédentes"
        data-pad-skip=""
        className={arrowButton}
        onClick={() => scroll(-1)}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <div
        ref={strip}
        role="radiogroup"
        aria-label="Spéciale"
        className="flex min-w-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto"
      >
        {cards}
      </div>
      <button
        type="button"
        aria-label="Cartes suivantes"
        data-pad-skip=""
        className={arrowButton}
        onClick={() => scroll(1)}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
};
