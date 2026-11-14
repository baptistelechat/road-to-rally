// Formes et choix des menus du redesign (maquettes R-Menu et R-Pause). À remonter dans `hudStyles.ts` si d'autres écrans les reprennent.
// Focus partout : `focus-line` (deux traits, haut et bas), rien d'autre ne change. Le survol garde son fond.

/** Bandeau facetté du menu de départ */
export const facetBanner =
  "[clip-path:polygon(0_0,100%_0,100%_72%,62%_100%,38%_86%,0_100%)]";
/** Tuile du logo, deux coins coupés */
export const facetTile =
  "[clip-path:polygon(14%_0,100%_0,100%_86%,86%_100%,0_100%,0_14%)]";
/** Bouton de départ en parallélogramme */
export const facetStart = "[clip-path:polygon(6%_0,100%_0,94%_100%,0_100%)]";
/** Petits boutons en parallélogramme sous le départ */
export const facetButton = "[clip-path:polygon(10%_0,100%_0,90%_100%,0_100%)]";
/** Même parallélogramme à pente fixe : le biseau reste identique quelle que soit la largeur du bouton (drawer). */
export const facetSlant =
  "[clip-path:polygon(0.625rem_0,100%_0,calc(100%_-_0.625rem)_100%,0_100%)]";

/** Nom d'un réglage, au-dessus ou à gauche de ses choix */
export const fieldLabel = "text-[0.8125rem] font-bold";

/** Bouton gris, sans bordure : seul le focus dessine ses traits. */
export const grayButton =
  "bg-secondary font-bold text-secondary-foreground transition-colors hover:bg-accent focus-line";
/** Bouton gris compact du drawer et des panneaux */
export const drawerButton = `${grayButton} ${facetSlant} min-h-9 px-4 text-xs`;
/** Bouton jaune principal : départ, reprise, Prêt */
export const brandButton =
  "bg-brand font-extrabold text-brand-foreground transition-colors hover:bg-brand/85 focus-line";

/** Teinte d'un choix : le choisi en jaune, `accent` reste le survol. */
const choiceTone = (selected: boolean): string =>
  selected
    ? "bg-brand/20 font-extrabold text-brand"
    : "bg-secondary font-semibold text-secondary-foreground hover:bg-accent";

/** Un choix parmi d'autres, biseauté, à largeur fixe : les colonnes s'alignent d'un réglage à l'autre. */
export const choice = (selected: boolean): string =>
  `${facetSlant} ${choiceTone(selected)} h-8 w-28 shrink-0 text-xs transition-colors focus-line`;

/** Carte à aperçu (compteur, mini-carte) : reste rectangulaire. */
export const choiceCard = (selected: boolean): string =>
  `${choiceTone(selected)} text-xs transition-colors focus-line`;
