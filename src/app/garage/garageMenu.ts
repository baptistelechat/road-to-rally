// Menu du garage : logique pure. Souris, clavier et manette envoient tous leurs événements ici.
import type { MenuAction } from "@/input/smoothing";
import { defaultLivery, type Livery } from "@/render/car/livery";
import { SHADES, TAILWIND_COLORS } from "./tailwindColors";

export const LIVERY_FIELDS: readonly (readonly [keyof Livery, string])[] = [
  ["primary", "Carrosserie"],
  ["secondary", "Bas de caisse"],
  ["accent", "Accents"],
  ["rim", "Jantes"],
];

export const RESET_ROW = LIVERY_FIELDS.length;
export const ROTATION_ROW = RESET_ROW + 1;
const ROW_COUNT = ROTATION_ROW + 1;

export const SWATCH_COLUMNS = SHADES.length;
/** Une ligne par teinte, une colonne par nuance */
export const SWATCHES = Object.entries(TAILWIND_COLORS).flatMap(
  ([hue, hexes]) =>
    hexes.map((hex, i) => ({ name: `${hue}-${SHADES[i]}`, hex })),
);
const SWATCH_ROWS = SWATCHES.length / SWATCH_COLUMNS;

export interface GarageMenu {
  row: number;
  /** Palette ouverte sur la ligne : `original` revient si le joueur annule. */
  palette: { swatch: number; original: string } | null;
  livery: Livery;
  paused: boolean;
}

export type GarageMenuEvent =
  | MenuAction
  | { type: "row"; row: number }
  | { type: "hover" | "pick"; swatch: number };

export const createGarageMenu = (livery: Livery): GarageMenu => ({
  row: 0,
  palette: null,
  livery,
  paused: false,
});

const wrap = (value: number, count: number): number =>
  ((value % count) + count) % count;

const channels = (hex: string): number[] =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

/** Une couleur hors palette, comme celles d'origine, place le curseur sur la teinte la plus proche. */
export const nearestSwatch = (hex: string): number => {
  const target = channels(hex);
  const distance = (swatch: string): number =>
    channels(swatch).reduce((sum, c, i) => sum + (c - target[i]) ** 2, 0);
  return SWATCHES.reduce(
    (best, { hex: swatch }, i) =>
      distance(swatch) < distance(SWATCHES[best].hex) ? i : best,
    0,
  );
};

const moveSwatch = (swatch: number, action: MenuAction): number => {
  const x = swatch % SWATCH_COLUMNS;
  const y = (swatch - x) / SWATCH_COLUMNS;
  const dx = action === "left" ? -1 : action === "right" ? 1 : 0;
  const dy = action === "up" ? -1 : action === "down" ? 1 : 0;
  return (
    wrap(y + dy, SWATCH_ROWS) * SWATCH_COLUMNS + wrap(x + dx, SWATCH_COLUMNS)
  );
};

const showSwatch = (menu: GarageMenu, swatch: number): GarageMenu => {
  const key = LIVERY_FIELDS[menu.row]?.[0];
  if (!menu.palette || !key) return menu;
  return {
    ...menu,
    palette: { ...menu.palette, swatch },
    livery: { ...menu.livery, [key]: SWATCHES[swatch].hex },
  };
};

const stepAction = (menu: GarageMenu, action: MenuAction): GarageMenu => {
  const key = LIVERY_FIELDS[menu.row]?.[0];
  if (menu.palette && key) {
    if (action === "confirm") return { ...menu, palette: null };
    if (action === "cancel")
      return {
        ...menu,
        palette: null,
        livery: { ...menu.livery, [key]: menu.palette.original },
      };
    return showSwatch(menu, moveSwatch(menu.palette.swatch, action));
  }

  if (action === "up" || action === "down")
    return {
      ...menu,
      row: wrap(menu.row + (action === "up" ? -1 : 1), ROW_COUNT),
    };
  if (action !== "confirm") return menu;
  if (menu.row === RESET_ROW) return { ...menu, livery: defaultLivery };
  if (menu.row === ROTATION_ROW) return { ...menu, paused: !menu.paused };
  const original = menu.livery[key];
  return {
    ...menu,
    palette: { swatch: nearestSwatch(original), original },
  };
};

export const stepGarageMenu = (
  menu: GarageMenu,
  event: GarageMenuEvent,
): GarageMenu => {
  if (typeof event === "string") return stepAction(menu, event);
  if (event.type === "row") {
    // Clic sur une ligne : referme la palette ouverte, ou passe à cette ligne.
    const closed = menu.palette ? stepAction(menu, "cancel") : menu;
    if (menu.palette && event.row === menu.row) return closed;
    return stepAction({ ...closed, row: event.row }, "confirm");
  }
  const shown = showSwatch(menu, event.swatch);
  return event.type === "pick" ? stepAction(shown, "confirm") : shown;
};
