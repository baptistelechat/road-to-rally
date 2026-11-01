import { countries } from "country-flag-icons";

// Drapeaux : les SVG de la bibliothèque, redessinés en triangles pour rester dans le style low-poly de la voiture.

export const DEFAULT_FLAG = "FR";
export const NO_FLAG = "none";

const names = new Intl.DisplayNames(["fr"], { type: "region" });

/** « Sans drapeau », puis les pays nommés par `Intl`, triés en français. Les codes régionaux (GB-ENG...) et techniques (XA...) sont écartés. */
export const FLAGS: readonly { id: string; label: string }[] = [
  { id: NO_FLAG, label: "Sans drapeau" },
  ...countries
    .filter((code) => /^[A-Z]{2}$/.test(code))
    .map((id) => ({ id, label: names.of(id) ?? id }))
    .filter(({ id, label }) => id !== label)
    .sort((a, b) => a.label.localeCompare(b.label, "fr")),
];

/** Couleur d'un triangle. Les triangles se suivent cellule par cellule, de gauche à droite puis de haut en bas. */
export type FlagFacet = readonly [number, number, number];

/**
 * 72 et 48 tombent juste pour les bandes en deux ou trois parts : France et Allemagne gardent des bords droits.
 * Un maillage fin : à 36 x 24, les dents de scie se voyaient trop sur les bandes obliques ou étroites.
 */
const COLUMNS = 72;
const ROWS = 48;
/** Pixels échantillonnés par côté de cellule */
const CELL_PIXELS = 4;
/** Un triangle sur deux, à peine plus sombre : les facettes restent discrètes. */
export const FACET_SHADE = 0.97;
/** Le temps de s'arrêter sur un drapeau : en faisant défiler, on ne dessine pas ceux qu'on ne fait que traverser. */
const FLAG_SETTLE_MS = 150;

/** La diagonale alterne d'une cellule à l'autre : un maillage en losanges plutôt que des dents de scie. */
const inSecondTriangle = (
  column: number,
  row: number,
  u: number,
  v: number,
): boolean => ((column + row) % 2 === 0 ? v > u : u + v > 1);

/**
 * Découpe l'image RGBA en triangles et garde pour chacun sa couleur dominante, pas sa moyenne :
 * un détail plus petit qu'un triangle disparaît au lieu de salir la couleur autour de lui.
 */
export const flagFacets = (
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  columns = COLUMNS,
  rows = ROWS,
): FlagFacet[] => {
  const facets: FlagFacet[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const counts = [new Map<number, number>(), new Map<number, number>()];
      const left = Math.floor((column / columns) * width);
      const right = Math.floor(((column + 1) / columns) * width);
      const top = Math.floor((row / rows) * height);
      const bottom = Math.floor(((row + 1) / rows) * height);
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const u = (x + 0.5 - left) / (right - left);
          const v = (y + 0.5 - top) / (bottom - top);
          const offset = (y * width + x) * 4;
          if (pixels[offset + 3] < 128) continue;
          // Regroupe les couleurs voisines : l'anticrénelage du SVG ne compte pas comme une teinte à part.
          const key =
            ((pixels[offset] >> 3) << 10) |
            ((pixels[offset + 1] >> 3) << 5) |
            (pixels[offset + 2] >> 3);
          const count = counts[inSecondTriangle(column, row, u, v) ? 1 : 0];
          count.set(key, (count.get(key) ?? 0) + 1);
        }
      }

      counts.forEach((count, i) => {
        let dominant = 0x7fff;
        let best = 0;
        count.forEach((total, key) => {
          if (total > best) [dominant, best] = [key, total];
        });
        const shade = i === 0 ? 1 : FACET_SHADE;
        const channel = (shift: number): number =>
          Math.round((((dominant >> shift) & 31) * 8 + 4) * shade);
        facets.push([channel(10), channel(5), channel(0)]);
      });
    }
  }
  return facets;
};

/**
 * Écrit les triangles directement dans une image RGBA, pixel par pixel. Tracer chacun sur le canvas coûtait
 * des milliers d'opérations par drapeau et gelait le défilement. Sans facette, l'image reste transparente.
 */
export const paintFacets = (
  target: Uint8ClampedArray,
  width: number,
  height: number,
  facets: readonly FlagFacet[],
  columns = COLUMNS,
  rows = ROWS,
): void => {
  if (facets.length === 0) return;
  for (let y = 0; y < height; y++) {
    const rowPosition = ((y + 0.5) / height) * rows;
    const row = Math.floor(rowPosition);
    for (let x = 0; x < width; x++) {
      const columnPosition = ((x + 0.5) / width) * columns;
      const column = Math.floor(columnPosition);
      const second = inSecondTriangle(
        column,
        row,
        columnPosition - column,
        rowPosition - row,
      );
      const [r, g, b] = facets[(row * columns + column) * 2 + (second ? 1 : 0)];
      const offset = (y * width + x) * 4;
      target[offset] = r;
      target[offset + 1] = g;
      target[offset + 2] = b;
      target[offset + 3] = 255;
    }
  }
};

const rasterize = (svg: string): Promise<FlagFacet[]> =>
  new Promise((resolve, reject) => {
    const [width, height] = [COLUMNS * CELL_PIXELS, ROWS * CELL_PIXELS];
    const image = new Image(width, height);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject(new Error("canvas 2D indisponible"));
      ctx.drawImage(image, 0, 0, width, height);
      resolve(
        flagFacets(ctx.getImageData(0, 0, width, height).data, width, height),
      );
    };
    image.onerror = () => reject(new Error("SVG de drapeau illisible"));
    // Une taille explicite, sinon Firefox refuse de dessiner un SVG qui n'a qu'un viewBox.
    const sized = svg.replace(
      "<svg ",
      `<svg width="${width}" height="${height}" preserveAspectRatio="none" `,
    );
    image.src = `data:image/svg+xml,${encodeURIComponent(sized)}`;
  });

/** Les SVG arrivent dans un chunk à part, chargé au premier drapeau affiché. */
const loadSvgs = (): Promise<Record<string, string>> =>
  import("country-flag-icons/string/3x2") as unknown as Promise<
    Record<string, string>
  >;

let images: Promise<Record<string, string>> | undefined;

/** Les drapeaux d'origine pour la grille du garage : le low-poly par vignette gelait l'ouverture. */
export const loadFlagImages = (): Promise<Record<string, string>> => {
  images ??= loadSvgs().then((svgs) =>
    Object.fromEntries(
      FLAGS.filter(({ id }) => id !== NO_FLAG).map(({ id }) => [
        id,
        `data:image/svg+xml,${encodeURIComponent(svgs[id])}`,
      ]),
    ),
  );
  return images;
};

const cache = new Map<string, Promise<FlagFacet[]>>();

export const loadFlagFacets = (code: string): Promise<FlagFacet[]> => {
  // Aucune facette : l'emplacement reste vide.
  if (code === NO_FLAG) return Promise.resolve([]);
  let facets = cache.get(code);
  if (!facets) {
    facets = loadSvgs().then((svgs) => rasterize(svgs[code]));
    cache.set(code, facets);
  }
  return facets;
};

const drawFacets = (
  canvas: HTMLCanvasElement,
  facets: readonly FlagFacet[],
): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.createImageData(canvas.width, canvas.height);
  paintFacets(image.data, canvas.width, canvas.height, facets);
  ctx.putImageData(image, 0, 0);
};

/** Dessine le drapeau une fois le joueur arrêté dessus. Renvoie de quoi annuler si un autre arrive entre-temps. */
export const drawFlagWhenSettled = (
  code: string,
  getCanvas: () => HTMLCanvasElement | null,
  onDrawn?: () => void,
): (() => void) => {
  let cancelled = false;
  const timer = setTimeout(() => {
    void loadFlagFacets(code).then((facets) => {
      const canvas = getCanvas();
      if (cancelled || !canvas) return;
      drawFacets(canvas, facets);
      onDrawn?.();
    });
  }, FLAG_SETTLE_MS);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
};
