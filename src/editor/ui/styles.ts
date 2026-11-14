/**
 * Les briques visuelles de l'éditeur (maquettes `R-Editeur-*`), partagées par la liste et le tracé.
 * Des éléments natifs : l'apparence des composants shadcn reste dans `components/ui`.
 */

/** Action facultative, en pointillés */
export const dashedButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-line-visible disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4";

/** Lien texte de retour, en tête d'écran */
export const backLink =
  "inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-foreground hover:text-brand focus-line-visible [&_svg]:size-4";

/** Champ de saisie sur fond sombre */
export const textField =
  "min-h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-line-visible";

/** Petit titre en capitales, typo d'afficheur */
export const capsLabel =
  "font-display text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase";

/** Panneau translucide posé sur la carte */
export const mapSurface = "bg-background/95 backdrop-blur-sm";

/** Bouton d'un groupe segmenté (fond de carte, routes, légende) */
export const segmentButton = (pressed: boolean): string =>
  `inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-[0.8125rem] transition-colors aria-expanded:bg-accent focus-line-visible [&_svg]:size-3.5 ${
    pressed
      ? "bg-accent font-extrabold text-brand"
      : "font-semibold text-foreground hover:bg-accent/60"
  }`;
