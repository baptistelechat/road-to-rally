"use client";

import { setLook, useHudStore } from "@/game/hudStore";
import { LOOK_NAMES, MENU_LOOKS } from "@/render/look";
import { type MenuOption, MenuSelect } from "../MenuSelect";
import { facetSlant } from "./menuStyles";

const LOOK_OPTIONS: readonly MenuOption<(typeof MENU_LOOKS)[number]>[] =
  MENU_LOOKS.map((id) => ({ id, name: LOOK_NAMES[id] }));

/**
 * Ambiance lumineuse, au menu de départ et sur l'écran « Prêt ». La scène derrière change aussitôt : c'est l'aperçu.
 * Le fond voilé garde le libellé lisible sur un ciel clair.
 */
export const LookSelect = () => {
  const look = useHudStore((s) => s.look);
  return (
    <div
      className={`w-full max-w-[56rem] bg-background/88 px-6 py-2.5 ${facetSlant}`}
    >
      <MenuSelect
        title="Ambiance"
        value={look}
        options={LOOK_OPTIONS}
        wrap
        onChoose={setLook}
      />
    </div>
  );
};
