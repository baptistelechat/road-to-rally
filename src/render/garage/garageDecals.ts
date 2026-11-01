import { type CanvasTexture, Color } from "three";
import {
  createDecalTexture,
  drawNumber,
  fitText,
  NUMBER_SIZE,
  type NumberStyle,
} from "@/render/car/decals";
import type { LiveryColors } from "@/render/car/livery";

export const BANNER_SIZE = [1024, 144] as const;
export const SCREEN_SIZE = [1024, 576] as const;
/** Mêmes proportions que les toiles (3 x 2) */
export const CLOTH_SIZE = [720, 480] as const;
const PLAQUES_SIZE = [1536, 560] as const;

/** Épreuves inventées : aucun vrai rallye ni sponsor sur les murs. */
const PLAQUES = [
  {
    name: "RALLYE DES ALPES",
    tag: "MONTAGNE",
    year: "1979",
    number: "33",
    bg: "#c8201c",
    ink: "#fff8ee",
  },
  {
    name: "RONDE DU JURA",
    tag: "HISTORIQUE",
    year: "2019",
    number: "15",
    bg: "#17150f",
    ink: "#c9a24a",
  },
  {
    name: "RALLYE DE BRETAGNE",
    tag: "CÔTE DE GRANIT",
    year: "1994",
    number: "7",
    bg: "#1d4fa0",
    ink: "#ffffff",
  },
  {
    name: "TOUR D'AUVERGNE",
    tag: "VOLCANS",
    year: "2013",
    number: "22",
    bg: "#1f6b45",
    ink: "#f4eccf",
  },
  {
    name: "CRITÉRIUM DES VOSGES",
    tag: "FORÊTS",
    year: "1986",
    number: "41",
    bg: "#f4f1e6",
    ink: "#c8201c",
  },
  {
    name: "CORSE CLASSIC",
    tag: "RALLYE HISTORIQUE",
    year: "2003",
    number: "9",
    bg: "#2b2d33",
    ink: "#ffffff",
  },
] as const;

/** Blanc ou noir, selon ce qui se lit le mieux sur ce fond (seuil de contraste WCAG). */
export const readableInk = (background: string): string => {
  const { r, g, b } = new Color(background);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#111114" : "#ffffff";
};

export const drawBanner = (
  ctx: CanvasRenderingContext2D,
  {
    primary,
    secondary,
    accent,
  }: Pick<LiveryColors, "primary" | "secondary" | "accent">,
): void => {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, width, height);
  for (const [x, color] of [
    [0, secondary],
    [width - 150, accent],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 60, 0);
    ctx.lineTo(x + 150, 0);
    ctx.lineTo(x + 90, height);
    ctx.lineTo(x, height);
    ctx.fill();
  }
  fitText(ctx, "ROAD TO RALLY", {
    center: [width / 2, height / 2],
    box: [width - 340, height * 0.6],
    font: (size) => `italic ${size}px Impact, "Arial Black", sans-serif`,
    ink: readableInk(primary),
  });
};

/** Silhouette d'une plaque de rallye : un rectangle surmonté d'un dôme. */
const plaquePath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const radius = height * 0.08;
  const shoulder = y + height * 0.3;
  const right = x + width;
  const bottom = y + height;
  ctx.beginPath();
  ctx.moveTo(x + radius, shoulder);
  ctx.lineTo(x + width * 0.2, shoulder);
  // Le point de contrôle est deux fois plus haut que le sommet voulu : le dôme culmine à `y`.
  ctx.quadraticCurveTo(
    x + width / 2,
    2 * y - shoulder,
    x + width * 0.8,
    shoulder,
  );
  ctx.arcTo(right, shoulder, right, shoulder + radius, radius);
  ctx.arcTo(right, bottom, right - radius, bottom, radius);
  ctx.arcTo(x, bottom, x, bottom - radius, radius);
  ctx.arcTo(x, shoulder, x + radius, shoulder, radius);
  ctx.closePath();
};

const drawPlaque = (
  ctx: CanvasRenderingContext2D,
  { name, tag, year, number, bg, ink }: (typeof PLAQUES)[number],
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const center = x + width / 2;
  const condensed = (size: number): string =>
    `${size}px Impact, "Arial Black", sans-serif`;

  ctx.fillStyle = bg;
  plaquePath(ctx, x, y, width, height);
  ctx.fill();

  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  plaquePath(ctx, x + 9, y + 9, width - 18, height - 18);
  ctx.stroke();

  // Fenêtre du numéro de course, sous le dôme
  const windowWidth = width * 0.2;
  const windowTop = y + height * 0.13;
  const windowHeight = height * 0.3;
  ctx.fillStyle = "#f7f4ea";
  ctx.beginPath();
  ctx.roundRect(
    center - windowWidth / 2,
    windowTop,
    windowWidth,
    windowHeight,
    10,
  );
  ctx.fill();
  fitText(ctx, number, {
    center: [center, windowTop + windowHeight / 2],
    box: [windowWidth * 0.8, windowHeight * 0.68],
    font: condensed,
    ink: "#17171a",
  });

  for (const side of [-1, 1]) {
    fitText(ctx, year, {
      center: [center + side * width * 0.24, y + height * 0.4],
      box: [width * 0.15, height * 0.11],
      font: condensed,
      ink,
    });
  }
  fitText(ctx, name, {
    center: [center, y + height * 0.65],
    box: [width * 0.86, height * 0.2],
    font: condensed,
    ink,
  });
  fitText(ctx, tag, {
    center: [center, y + height * 0.85],
    box: [width * 0.6, height * 0.06],
    font: (size) => `bold ${size}px Arial, sans-serif`,
    ink,
  });
};

/**
 * Plaques de rallye accrochées au mur, sur fond transparent. Alpha prémultiplié : sinon le noir
 * des pixels vides se mêle aux plaques au filtrage et les entoure d'un halo sombre.
 */
export const createPlaquesTexture = (): CanvasTexture => {
  const texture = createDecalTexture(PLAQUES_SIZE, drawPlaques);
  texture.premultiplyAlpha = true;
  return texture;
};

const drawPlaques = (ctx: CanvasRenderingContext2D): void => {
  const { width, height } = ctx.canvas;
  const columns = 3;
  const rows = 2;
  const margin = 24;
  const cellWidth = (width - margin * (columns + 1)) / columns;
  const cellHeight = (height - margin * (rows + 1)) / rows;
  PLAQUES.forEach((plaque, i) => {
    drawPlaque(
      ctx,
      plaque,
      margin + (i % columns) * (cellWidth + margin),
      margin + Math.floor(i / columns) * (cellHeight + margin),
      cellWidth,
      cellHeight,
    );
  });
};

const drawServiceScreen = (
  ctx: CanvasRenderingContext2D,
  now: Date,
  car: string,
): void => {
  const { width, height } = ctx.canvas;
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#06121f");
  background.addColorStop(1, "#0c2a4a");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#123a63";
  ctx.fillRect(0, 0, width, 92);
  ctx.fillStyle = "#3f9be8";
  ctx.fillRect(0, 92, width, 4);

  const sans = (size: number): string => `bold ${size}px Arial, sans-serif`;
  fitText(ctx, "PARC D'ASSISTANCE", {
    center: [width / 2, 46],
    box: [width - 120, 40],
    font: sans,
    ink: "#d9ecff",
  });
  fitText(ctx, now.toLocaleTimeString("fr-FR"), {
    center: [width / 2, height / 2 + 14],
    box: [width - 200, 190],
    font: sans,
    ink: "#ffffff",
  });
  fitText(ctx, car, {
    center: [width / 2, height - 70],
    box: [width - 160, 44],
    font: sans,
    ink: "#facc15",
  });

  // Lignes de balayage, vignettage et reflet de la dalle
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.45,
    width / 2,
    height / 2,
    width * 0.65,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.beginPath();
  ctx.moveTo(width * 0.55, 0);
  ctx.lineTo(width * 0.8, 0);
  ctx.lineTo(width * 0.45, height);
  ctx.lineTo(width * 0.2, height);
  ctx.fill();
};

/** Redessine l'écran chaque seconde pour l'heure ; renvoie de quoi l'arrêter. */
export const runServiceScreen = (
  texture: CanvasTexture,
  car: string,
): (() => void) => {
  const ctx = (texture.image as HTMLCanvasElement).getContext("2d");
  if (!ctx) return () => {};
  const draw = (): void => {
    drawServiceScreen(ctx, new Date(), car);
    texture.needsUpdate = true;
  };
  draw();
  const timer = setInterval(draw, 1000);
  return () => clearInterval(timer);
};

/** Trame de tissu par-dessus le dessin d'une toile. */
export const drawWeave = (ctx: CanvasRenderingContext2D): void => {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "rgba(0, 0, 0, 0.07)";
  for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
  for (let x = 0; x < width; x += 4) ctx.fillRect(x, 0, 1, height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let y = 2; y < height; y += 4) ctx.fillRect(0, y, width, 1);
};

/** Toile du numéro : le panneau de la voiture, posé sur les couleurs de l'équipe. */
export const drawNumberCloth = (
  ctx: CanvasRenderingContext2D,
  text: string,
  style: NumberStyle,
  { secondary, accent }: Pick<LiveryColors, "secondary" | "accent">,
): void => {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = secondary;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 44);
  ctx.fillRect(0, height - 44, width, 44);

  const panel = document.createElement("canvas");
  [panel.width, panel.height] = NUMBER_SIZE;
  const panelCtx = panel.getContext("2d");
  if (panelCtx) {
    drawNumber(panelCtx, text, style, accent);
    const panelWidth = width * 0.78;
    const panelHeight = (panelWidth * panel.height) / panel.width;
    ctx.drawImage(
      panel,
      (width - panelWidth) / 2,
      (height - panelHeight) / 2,
      panelWidth,
      panelHeight,
    );
  }
  drawWeave(ctx);
};

export const LOGO_SIZE_PX = [512, 512] as const;

// ponytail: cadre d'attente, à remplacer par un drawImage du logo quand le fichier existera.
export const drawLogoSlot = (ctx: CanvasRenderingContext2D): void => {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#17181b";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#8d9196";
  ctx.lineWidth = 8;
  ctx.setLineDash([28, 18]);
  ctx.strokeRect(36, 36, width - 72, height - 72);
  ctx.setLineDash([]);
  fitText(ctx, "LOGO", {
    center: [width / 2, height / 2],
    box: [width * 0.6, height * 0.25],
    font: (size) => `bold ${size}px Arial, sans-serif`,
    ink: "#8d9196",
  });
};
