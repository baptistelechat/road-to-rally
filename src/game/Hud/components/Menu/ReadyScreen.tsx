"use client";

import { useEffect } from "react";
import { setHudScreen } from "@/game/hudStore";
import { label } from "../../hudStyles";
import { READY_PARAM } from "./mapChoices";
import { LookSelect } from "./LookSelect";
import { brandStartButton } from "./menuStyles";

interface ReadyScreenProps {
  mapLabel: string;
  /** Échap ou B : le menu de départ */
  onBack: () => void;
}

/**
 * Carte changée depuis la pause : le choix d'ambiance et le bouton Prêt, focalisé, que A valide. Son clic débloque aussi le son.
 * Le paramètre d'URL est retiré dès l'affichage : recharger la page ramène au menu de départ.
 */
export const ReadyScreen = ({ mapLabel, onBack }: ReadyScreenProps) => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(READY_PARAM)) return;
    params.delete(READY_PARAM);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params}`,
    );
  }, []);

  return (
    <dialog
      open
      aria-labelledby="ready-title"
      className="pointer-events-auto absolute inset-0 z-20 m-0 flex size-full max-h-none max-w-none flex-col items-center justify-center gap-6 border-0 bg-background/60 p-4 text-foreground transition-opacity duration-200 starting:opacity-0"
    >
      <h1 id="ready-title" className="m-0 flex flex-col items-center gap-2">
        <span className={label}>Spéciale</span>
        <span className="text-center font-display text-3xl">{mapLabel}</span>
      </h1>
      <LookSelect />
      <button
        type="button"
        autoFocus
        data-needs-sound=""
        className={`min-h-18 w-[min(32.5rem,100%)] px-10 font-display text-xl tracking-[0.06em] uppercase ${brandStartButton}`}
        onClick={() => setHudScreen("race")}
      >
        Prêt
      </button>
      {/* `applyMenuAction` clique `data-menu-back` sur Échap et B ; masqué, la manette ne s'y arrête jamais. */}
      <button type="button" hidden data-menu-back="" onClick={onBack}>
        Menu principal
      </button>
    </dialog>
  );
};
