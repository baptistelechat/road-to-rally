import Link from "next/link";
import type { Livery } from "@/render/car/livery";
import { FACET_BG, FOCUS_VISIBLE } from "./LiveryPanel/menuStyles";

/** Bandeau du garage : retour, titre, voiture en cours et départ (la seule zone jaune de l'écran). */
export const GarageHeader = ({ livery }: { livery: Livery }) => (
  <header className="absolute inset-x-0 top-0 flex h-16 items-center gap-4 bg-background/90 px-6 text-foreground">
    <Link
      href="/"
      className={`flex min-h-11 items-center gap-2 rounded text-sm font-bold ${FOCUS_VISIBLE}`}
    >
      <span aria-hidden>←</span> Retour au jeu
    </Link>
    <h1 className="ml-2 font-display text-base tracking-[0.08em] uppercase">
      Garage
    </h1>
    <span className="ml-auto truncate font-mono text-sm text-muted-foreground max-sm:hidden">
      Voiture {livery.numberText.trim() || "—"} ·{" "}
      {livery.plateText.trim() || "—"}
    </span>
    <Link
      href="/"
      className={`relative isolate grid min-h-11 shrink-0 place-items-center px-8 font-display text-xs tracking-[0.06em] text-brand-foreground uppercase max-sm:ml-auto ${FOCUS_VISIBLE}`}
    >
      <span aria-hidden className={`${FACET_BG} bg-brand`} />
      Prendre le départ
    </Link>
  </header>
);
