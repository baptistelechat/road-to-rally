export const panel =
  "rounded-sm border border-foreground/15 bg-background/85 text-foreground";
export const label =
  "font-display text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase";
/** Sans `focus-visible` : la manette déplace le focus par script, et la ligne sélectionnée doit se voir même après un clic. */
export const menuFocus = "focus-line";
export const hudButton =
  "rounded border border-foreground/25 px-3 py-1 text-xs font-semibold transition-colors hover:bg-foreground/15 focus-line";
/** Bouton en parallélogramme du HUD en course (Relancer) */
export const hudFacetButton =
  "min-h-11 bg-accent px-5.5 text-[0.8125rem] font-bold text-accent-foreground transition-colors [clip-path:polygon(10%_0,100%_0,90%_100%,0_100%)] hover:bg-secondary focus-line";
/** Fond des blocs du HUD en course, sans bordure : les facettes tiennent lieu de cadre */
export const hudBlock = "bg-background/90 text-foreground";
