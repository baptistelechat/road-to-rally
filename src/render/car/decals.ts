import { CanvasTexture, SRGBColorSpace } from "three";

// Plaques et numéros : dessinés sur un canvas 2D, le même pour la voiture et les vignettes du garage.

export const PLATE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ";
export const PLATE_LENGTH = 9;
export const NUMBER_CHARS = "0123456789 ";
export const NUMBER_LENGTH = 3;

/** Mêmes proportions que les plaques (0,42 x 0,09) et les panneaux de portière (0,5 x 0,22) du modèle */
export const PLATE_SIZE = [512, 110] as const;
export const NUMBER_SIZE = [512, 225] as const;

export const PLATE_STYLES = [
  { id: "europe", label: "Europe", bg: "#f7f4ea", ink: "#17171a", bands: true },
  { id: "collection", label: "Collection", bg: "#17171a", ink: "#d8d8d8" },
  { id: "jaune", label: "Jaune", bg: "#f5c518", ink: "#17171a" },
  { id: "rallye", label: "Rallye", bg: "#f7f4ea", ink: "#c8102e", frame: true },
] as const;

export const NUMBER_STYLES = [
  { id: "classique", label: "Classique", bg: "#f7f4ea", ink: "#17171a" },
  { id: "rond", label: "Rond", bg: "#f7f4ea", ink: "#17171a", round: true },
  { id: "nuit", label: "Nuit", bg: "#17171a", ink: "#facc15" },
  { id: "ecurie", label: "Écurie", ink: "#ffffff", italic: true },
  {
    id: "damier",
    label: "Damier",
    bg: "#f7f4ea",
    ink: "#17171a",
    checker: true,
  },
  { id: "nu", label: "Sans panneau", ink: "#ffffff", bare: true },
] as const;

export type PlateStyle = (typeof PLATE_STYLES)[number]["id"];
export type NumberStyle = (typeof NUMBER_STYLES)[number]["id"];

const OUTLINE = "#17171a";

interface FitTextOptions {
  center: readonly [number, number];
  box: readonly [number, number];
  font: (size: number) => string;
  ink: string;
  outline?: boolean;
}

/** Centre le texte et le réduit pour tenir dans `box`, en le calant sur la hauteur d'un chiffre. */
export const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  { center, box, font, ink, outline }: FitTextOptions,
): void => {
  const reference = 100;
  ctx.font = font(reference);
  const digit = ctx.measureText("0");
  const height = digit.actualBoundingBoxAscent + digit.actualBoundingBoxDescent;
  const width = ctx.measureText(text).width;
  const scale = Math.min(box[0] / Math.max(width, 1), box[1] / height);
  const y =
    center[1] + (scale * height) / 2 - scale * digit.actualBoundingBoxDescent;

  ctx.font = font(reference * scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (outline) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineJoin = "round";
    ctx.lineWidth = 10;
    ctx.strokeText(text, center[0], y);
  }
  ctx.fillStyle = ink;
  ctx.fillText(text, center[0], y);
};

export const drawPlate = (
  ctx: CanvasRenderingContext2D,
  text: string,
  styleId: PlateStyle,
): void => {
  const style =
    PLATE_STYLES.find(({ id }) => id === styleId) ?? PLATE_STYLES[0];
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, width, height);

  const band = "bands" in style ? 44 : 14;
  if ("bands" in style) {
    ctx.fillStyle = "#1d3f94";
    ctx.fillRect(0, 0, band, height);
    ctx.fillRect(width - band, 0, band, height);
    fitText(ctx, "F", {
      center: [band / 2, height * 0.72],
      box: [band - 12, height * 0.3],
      font: (size) => `bold ${size}px Arial, sans-serif`,
      ink: "#ffffff",
    });
  }
  ctx.strokeStyle = "frame" in style ? style.ink : "#00000055";
  ctx.lineWidth = "frame" in style ? 10 : 4;
  ctx.strokeRect(
    ctx.lineWidth / 2,
    ctx.lineWidth / 2,
    width - ctx.lineWidth,
    height - ctx.lineWidth,
  );

  fitText(ctx, text.trim(), {
    center: [width / 2, height / 2],
    box: [width - 2 * band - 24, height * 0.62],
    font: (size) => `bold ${size}px "Arial Narrow", Arial, sans-serif`,
    ink: style.ink,
  });
};

export const drawNumber = (
  ctx: CanvasRenderingContext2D,
  text: string,
  styleId: NumberStyle,
  accent: string,
): void => {
  const style =
    NUMBER_STYLES.find(({ id }) => id === styleId) ?? NUMBER_STYLES[0];
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  // Le panneau suit la couleur d'accent quand le style n'impose pas la sienne.
  ctx.fillStyle = "bg" in style ? style.bg : accent;
  const round = "round" in style;
  ctx.beginPath();
  if (round) ctx.arc(width / 2, height / 2, height / 2 - 2, 0, Math.PI * 2);
  else ctx.roundRect(2, 2, width - 4, height - 4, 22);
  if (!("bare" in style)) ctx.fill();

  const checker = "checker" in style;
  if (checker) {
    const cell = 18;
    ctx.save();
    ctx.clip();
    ctx.fillStyle = OUTLINE;
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column * cell < width; column++) {
        if ((row + column) % 2 === 0) continue;
        ctx.fillRect(column * cell, row * cell, cell, cell);
        ctx.fillRect(column * cell, height - (row + 1) * cell, cell, cell);
      }
    }
    ctx.restore();
  }

  const maxHeight = height * (checker ? 0.5 : 0.72);
  fitText(ctx, text.trim(), {
    center: [width / 2, height / 2],
    box: [
      round ? height * 0.74 : width * 0.82,
      round ? height * 0.58 : maxHeight,
    ],
    font: (size) =>
      `${"italic" in style ? "italic " : ""}${size}px Impact, "Arial Black", sans-serif`,
    ink: style.ink,
    outline: !("bg" in style),
  });
};

export const FLAG_SIZE = [192, 128] as const;

export const createDecalTexture = (
  [width, height]: readonly [number, number],
  draw: (ctx: CanvasRenderingContext2D) => void,
): CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};
