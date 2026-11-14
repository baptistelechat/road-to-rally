import type { GarageMenu, GarageMenuEvent } from "../garageMenu";

/** Ligne sélectionnée par l'état du menu, sans focus DOM : les deux traits de `focus-line`, posés en permanence. */
export const MENU_FOCUS =
  "shadow-[inset_0_3px_0_var(--foreground),inset_0_-3px_0_var(--foreground)]";

/** Nom historique : la manette déplace le focus par script, d'où `:focus` et non `:focus-visible`. */
export const FOCUS_VISIBLE = "focus-line";

/** Fond en parallélogramme : sur un élément enfant, pour que le contour du parent ne soit pas rogné. */
export const FACET_BG =
  "pointer-events-none absolute inset-0 -z-10 [clip-path:polygon(8%_0,100%_0,92%_100%,0_100%)]";

/** Pastille de couleur taillée */
export const FACET_SWATCH = "[clip-path:polygon(20%_0,100%_0,80%_100%,0_100%)]";

/** Titre de section : petites capitales Michroma */
export const SECTION_TITLE =
  "m-0 font-display text-[10px] font-normal tracking-[0.18em] text-muted-foreground uppercase";

/** Champ de saisie : chiffres d'afficheur */
export const FIELD =
  "flex min-h-10 items-center justify-between gap-3 rounded border border-input bg-card px-3 text-left";

/** Indication de commande sous un éditeur ouvert */
export const HINT = "text-xs text-muted-foreground";

/** La ligne sélectionnée reste visible quand la manette fait défiler le panneau. */
export const scrollIfSelected = (selected: boolean) =>
  selected
    ? (element: HTMLElement | null) =>
        element?.scrollIntoView({ block: "nearest" })
    : undefined;

export interface LiveryPanelProps {
  menu: GarageMenu;
  dispatch: (event: GarageMenuEvent) => void;
}
