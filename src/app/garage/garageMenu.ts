// Menu du garage : logique pure. Souris, clavier et manette envoient tous leurs événements ici.
import type { MenuAction } from "@/input/smoothing";
import {
  NUMBER_CHARS,
  NUMBER_LENGTH,
  NUMBER_STYLES,
  PLATE_CHARS,
  PLATE_LENGTH,
  PLATE_STYLES,
} from "@/render/car/decals";
import { FLAGS } from "@/render/car/flags";
import {
  defaultColors,
  type Livery,
  type LiveryColors,
} from "@/render/car/livery";
import { SHADES, TAILWIND_COLORS } from "./tailwindColors";

export type ColorRow = {
  kind: "color";
  key: keyof LiveryColors;
  label: string;
};
export type TextRow = {
  kind: "text";
  key: "plateText" | "numberText";
  label: string;
  chars: string;
  length: number;
};
export type DecalStyleRow =
  | {
      kind: "style";
      key: "plateStyle";
      label: string;
      columns: number;
      styles: typeof PLATE_STYLES;
    }
  | {
      kind: "style";
      key: "numberStyle";
      label: string;
      columns: number;
      styles: typeof NUMBER_STYLES;
    };
export type FlagRow = {
  kind: "style";
  key: "flag";
  label: string;
  columns: number;
  styles: typeof FLAGS;
};
export type StyleRow = DecalStyleRow | FlagRow;
export type GarageRow =
  ColorRow | TextRow | StyleRow | { kind: "reset" } | { kind: "rotation" };

export const GARAGE_ROWS: readonly GarageRow[] = [
  { kind: "color", key: "primary", label: "Carrosserie" },
  { kind: "color", key: "secondary", label: "Bas de caisse" },
  { kind: "color", key: "accent", label: "Accents" },
  { kind: "color", key: "rim", label: "Jantes" },
  {
    kind: "text",
    key: "plateText",
    label: "Plaque",
    chars: PLATE_CHARS,
    length: PLATE_LENGTH,
  },
  {
    kind: "style",
    key: "plateStyle",
    label: "Style de plaque",
    columns: 2,
    styles: PLATE_STYLES,
  },
  {
    kind: "text",
    key: "numberText",
    label: "Numéro",
    chars: NUMBER_CHARS,
    length: NUMBER_LENGTH,
  },
  {
    kind: "style",
    key: "numberStyle",
    label: "Style de numéro",
    columns: 3,
    styles: NUMBER_STYLES,
  },
  { kind: "style", key: "flag", label: "Drapeau", columns: 7, styles: FLAGS },
  { kind: "reset" },
  { kind: "rotation" },
];

export const RESET_ROW = GARAGE_ROWS.findIndex(({ kind }) => kind === "reset");
export const ROTATION_ROW = GARAGE_ROWS.findIndex(
  ({ kind }) => kind === "rotation",
);

export const SWATCH_COLUMNS = SHADES.length;
/** Une ligne par teinte, une colonne par nuance */
export const SWATCHES = Object.entries(TAILWIND_COLORS).flatMap(
  ([hue, hexes]) =>
    hexes.map((hex, i) => ({ name: `${hue}-${SHADES[i]}`, hex })),
);

export interface GarageMenu {
  row: number;
  /** Palette ouverte sur la ligne : `original` revient si le joueur annule. */
  palette: { swatch: number; original: string } | null;
  /** Saisie ouverte sur la ligne : `slot` est le caractère en cours d'édition. */
  text: { slot: number; original: string } | null;
  /** Grille de styles ouverte sur la ligne : `original` revient si le joueur annule. */
  picker: { original: string } | null;
  livery: Livery;
  paused: boolean;
}

export type GarageMenuEvent =
  | MenuAction
  | { type: "row"; row: number }
  | { type: "hover" | "pick"; swatch: number }
  | { type: "slot"; slot: number }
  | { type: "char"; char: string }
  | { type: "erase" }
  | { type: "style"; row: number; style: number }
  | { type: "try"; style: number };

export const createGarageMenu = (livery: Livery): GarageMenu => ({
  row: 0,
  palette: null,
  text: null,
  picker: null,
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

const moveInGrid = (
  index: number,
  action: MenuAction,
  columns: number,
  count: number,
): number => {
  const x = index % columns;
  const y = (index - x) / columns;
  const dx = action === "left" ? -1 : action === "right" ? 1 : 0;
  const dy = action === "up" ? -1 : action === "down" ? 1 : 0;
  // La dernière ligne peut être incomplète : on boucle sur ses vraies cases, et on s'y arrête à la dernière.
  const nextY = wrap(y + dy, Math.ceil(count / columns));
  const lineLength = Math.min(columns, count - nextY * columns);
  const nextX =
    dx === 0 ? Math.min(x, lineLength - 1) : wrap(x + dx, lineLength);
  return nextY * columns + nextX;
};

const showSwatch = (menu: GarageMenu, swatch: number): GarageMenu => {
  const row = GARAGE_ROWS[menu.row];
  if (!menu.palette || row.kind !== "color") return menu;
  return {
    ...menu,
    palette: { ...menu.palette, swatch },
    livery: { ...menu.livery, [row.key]: SWATCHES[swatch].hex },
  };
};

/** Écrit un caractère dans la saisie, et place le curseur sur `nextSlot`. */
const writeSlot = (
  menu: GarageMenu,
  row: TextRow,
  slot: number,
  char: string,
  nextSlot: number,
): GarageMenu => {
  const text = menu.livery[row.key];
  return {
    ...menu,
    text: menu.text && { ...menu.text, slot: nextSlot },
    livery: {
      ...menu.livery,
      [row.key]: text.slice(0, slot) + char + text.slice(slot + 1),
    },
  };
};

const stepText = (
  menu: GarageMenu,
  row: TextRow,
  text: NonNullable<GarageMenu["text"]>,
  action: MenuAction,
): GarageMenu => {
  const { slot } = text;
  if (action === "confirm" || action === "cancel") {
    const value =
      action === "confirm" ? menu.livery[row.key].trimEnd() : text.original;
    return {
      ...menu,
      text: null,
      livery: { ...menu.livery, [row.key]: value },
    };
  }
  if (action === "left" || action === "right") {
    const delta = action === "left" ? -1 : 1;
    return { ...menu, text: { ...text, slot: wrap(slot + delta, row.length) } };
  }
  const current = row.chars.indexOf(menu.livery[row.key][slot]);
  const delta = action === "up" ? 1 : -1;
  const char = row.chars[wrap(current + delta, row.chars.length)];
  return writeSlot(menu, row, slot, char, slot);
};

const stepAction = (menu: GarageMenu, action: MenuAction): GarageMenu => {
  const row = GARAGE_ROWS[menu.row];
  if (menu.palette && row.kind === "color") {
    if (action === "confirm") return { ...menu, palette: null };
    if (action === "cancel")
      return {
        ...menu,
        palette: null,
        livery: { ...menu.livery, [row.key]: menu.palette.original },
      };
    return showSwatch(
      menu,
      moveInGrid(menu.palette.swatch, action, SWATCH_COLUMNS, SWATCHES.length),
    );
  }
  if (menu.text && row.kind === "text")
    return stepText(menu, row, menu.text, action);
  if (menu.picker && row.kind === "style") {
    if (action === "confirm") return { ...menu, picker: null };
    if (action === "cancel")
      return {
        ...menu,
        picker: null,
        livery: { ...menu.livery, [row.key]: menu.picker.original },
      };
    const current = row.styles.findIndex(
      ({ id }) => id === menu.livery[row.key],
    );
    return setStyle(
      menu,
      row,
      moveInGrid(current, action, row.columns, row.styles.length),
    );
  }

  if (action === "up" || action === "down")
    return {
      ...menu,
      row: wrap(menu.row + (action === "up" ? -1 : 1), GARAGE_ROWS.length),
    };
  if (action !== "confirm") return menu;

  switch (row.kind) {
    case "reset":
      return { ...menu, livery: { ...menu.livery, ...defaultColors } };
    case "rotation":
      return { ...menu, paused: !menu.paused };
    case "style":
      return { ...menu, picker: { original: menu.livery[row.key] } };
    case "text": {
      const original = menu.livery[row.key];
      return {
        ...menu,
        text: { slot: 0, original },
        livery: { ...menu.livery, [row.key]: original.padEnd(row.length) },
      };
    }
    case "color": {
      const original = menu.livery[row.key];
      return {
        ...menu,
        palette: { swatch: nearestSwatch(original), original },
      };
    }
  }
};

const setStyle = (
  menu: GarageMenu,
  row: StyleRow,
  style: number,
): GarageMenu => ({
  ...menu,
  livery: { ...menu.livery, [row.key]: row.styles[style].id },
});

/** Quitter une ligne annule l'essai d'une couleur ou d'un style, mais garde le texte déjà saisi. */
const closeEditor = (menu: GarageMenu): GarageMenu => {
  if (menu.palette || menu.picker) return stepAction(menu, "cancel");
  if (menu.text) return stepAction(menu, "confirm");
  return menu;
};

export const stepGarageMenu = (
  menu: GarageMenu,
  event: GarageMenuEvent,
): GarageMenu => {
  if (typeof event === "string") return stepAction(menu, event);
  const row = GARAGE_ROWS[menu.row];
  switch (event.type) {
    case "row": {
      // Clic sur une ligne : referme l'éditeur ouvert, ou passe à cette ligne.
      const closed = closeEditor(menu);
      if (closed !== menu && event.row === menu.row) return closed;
      return stepAction({ ...closed, row: event.row }, "confirm");
    }
    case "style": {
      const target = GARAGE_ROWS[event.row];
      if (target.kind !== "style") return menu;
      return setStyle(
        { ...closeEditor(menu), row: event.row },
        target,
        event.style,
      );
    }
    case "try":
      return menu.picker && row.kind === "style"
        ? setStyle(menu, row, event.style)
        : menu;
    case "slot":
      return menu.text
        ? { ...menu, text: { ...menu.text, slot: event.slot } }
        : menu;
    case "char": {
      const char = event.char.toUpperCase();
      if (!menu.text || row.kind !== "text" || !row.chars.includes(char))
        return menu;
      const { slot } = menu.text;
      return writeSlot(
        menu,
        row,
        slot,
        char,
        Math.min(slot + 1, row.length - 1),
      );
    }
    case "erase": {
      if (!menu.text || row.kind !== "text") return menu;
      // Efface le caractère avant le curseur, sauf sur la dernière case remplie, où le curseur reste bloqué.
      const { slot } = menu.text;
      const lastFilled =
        slot === row.length - 1 && menu.livery[row.key][slot] !== " ";
      const target = lastFilled ? slot : Math.max(slot - 1, 0);
      return writeSlot(menu, row, target, " ", target);
    }
    default: {
      const shown = showSwatch(menu, event.swatch);
      return event.type === "pick" ? stepAction(shown, "confirm") : shown;
    }
  }
};
