"use client";

// Les symboles de l'éditeur, les mêmes sur la carte, dans la légende et sur la courbe : on reconnaît un élément partout.
import { MoveHorizontal } from "lucide-react";
import {
  SIGN_ART_BENDS,
  SIGN_ART_BORDER,
  SIGN_ART_FIELD,
  SIGN_ART_HEIGHT,
  SIGN_ART_RIM,
  SIGN_ART_WIDTH,
  type SignOutline,
} from "@/render/scenery/chicaneSignArt";
import type { ChicaneSide } from "../types";

export type SymbolSize = "sm" | "md";

const toPoints = (outline: SignOutline): string =>
  outline.map(([x, y]) => `${x},${y}`).join(" ");

/** Un point posé, numéroté dans l'ordre du tracé. */
export const PointSymbol = ({
  rank,
  size = "md",
}: {
  rank: number | string;
  size?: SymbolSize;
}) => (
  <span
    className={`grid place-items-center rounded-full border-2 border-foreground bg-sky-600 font-bold text-foreground shadow-md ${size === "md" ? "size-6 text-xs" : "size-5 text-[10px]"}`}
  >
    {rank}
  </span>
);

/**
 * Le panneau du jeu, comme sur un roadbook : il se lit dans le sens du pilote, quel que soit le sens de la route sur la carte.
 * Dessiné pour un premier virage à droite, donc un premier bloc à gauche. L'autre côté en est le miroir.
 */
export const ChicaneSymbol = ({
  side,
  player = false,
  size = "md",
}: {
  side: ChicaneSide;
  /** Placée par le joueur : un point orange */
  player?: boolean;
  size?: SymbolSize;
}) => (
  <span className="relative block">
    <svg
      viewBox={`0 0 ${SIGN_ART_WIDTH} ${SIGN_ART_HEIGHT}`}
      aria-hidden="true"
      className={`block drop-shadow-md ${size === "md" ? "h-8 w-9" : "h-4 w-[18px]"} ${side === "right" ? "-scale-x-100" : ""}`}
    >
      <polygon points={toPoints(SIGN_ART_RIM)} fill="#f5f4f0" />
      <polygon points={toPoints(SIGN_ART_BORDER)} fill="#d01c1f" />
      <polygon points={toPoints(SIGN_ART_FIELD)} fill="#f5f4f0" />
      <polygon points={toPoints(SIGN_ART_BENDS)} fill="#111111" />
    </svg>
    {player && (
      <span
        className={`absolute -top-0.5 -right-0.5 rounded-full border border-foreground bg-orange-500 ${size === "md" ? "size-2.5" : "size-1.5"}`}
      />
    )}
  </span>
);

/** L'îlot d'un rond-point en pointillé rouge, comme sur la carte ; le rocher d'un petit giratoire en gris plein. */
export const RoundaboutSymbol = ({ rock = false }: { rock?: boolean }) => (
  <span
    className={`block size-4 rounded-full border-[3px] bg-background/60 shadow-md ${rock ? "border-stone-400" : "border-dashed border-red-500"}`}
  />
);

/** Couleur de la glissière d'un terre-plein, sur la carte, la courbe et dans la légende */
export const MEDIAN_COLOR = "#f472b6";

/** Un tronçon de glissière entre deux chaussées. */
export const MedianSymbol = () => (
  <span
    className="block h-1.5 w-4 rounded-full border border-foreground shadow-md"
    style={{ backgroundColor: MEDIAN_COLOR }}
  />
);

/** Un pont : tablier, arche et deux piles, dans le bleu de sa bande sur la courbe. */
export const BridgeSymbol = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 14"
    className="block h-3.5 w-5 fill-none stroke-blue-300 stroke-[1.6] drop-shadow"
  >
    <path d="M0 6h20M2 6q8-8 16 0M5 6v6M15 6v6" />
  </svg>
);

/** Un intermédiaire du chrono, numéroté : la frise et la mini-carte de la course le montrent au même endroit. */
export const SplitSymbol = ({ rank }: { rank: number | string }) => (
  <span className="inline-flex items-center gap-0.5">
    <span className="block h-1.5 w-5 rounded-full border border-background/70 bg-foreground shadow" />
    <span className="text-[10px] leading-none font-bold text-foreground [text-shadow:0_0_3px_black]">
      {rank}
    </span>
  </span>
);

/** La plus longue ligne droite, au milieu de sa portion. */
export const StraightSymbol = ({ size = "md" }: { size?: SymbolSize }) => (
  <span
    className={`grid place-items-center rounded-full border-2 border-foreground bg-green-600 text-foreground shadow-md ${size === "md" ? "size-6" : "size-5"}`}
  >
    <MoveHorizontal
      aria-hidden="true"
      className={size === "md" ? "size-3.5" : "size-3"}
    />
  </span>
);
