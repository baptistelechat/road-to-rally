"use client";

import { ArrowLeft } from "lucide-react";
import { EDITOR_URL } from "@/game/maps";
import { Toolbar } from "./panel/Toolbar";
import { RollPanel } from "./panel/RollPanel";
import { backLink, mapSurface } from "./styles";

/** Tout ce qui agit sur la spéciale entière, au-dessus de la carte. Les problèmes du tracé sont dans le panneau. */
export const TopBar = () => (
  <header
    className={`relative z-20 flex min-h-15 flex-wrap items-center gap-3 border-b px-4 py-2 ${mapSurface}`}
  >
    {/* Une vraie navigation : la carte et son contexte WebGL sont libérés. */}
    <a href={EDITOR_URL} className={backLink}>
      <ArrowLeft aria-hidden="true" />
      Mes spéciales
    </a>
    <h1 className="sr-only">Éditeur de spéciale</h1>
    <Toolbar />
    <div className="ml-auto flex min-w-0 items-center gap-3">
      <RollPanel />
    </div>
  </header>
);
