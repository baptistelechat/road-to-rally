import {
  type BufferGeometry,
  CanvasTexture,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { pick } from "./crowd/hash";
import { RALLY_HEX } from "./rallyModels";

// Atlas des textes de l'habillage rallye : enseignes, banderoles, buvette et pancartes sur une seule texture,
// dessinée une fois sur un canevas (aucune police téléchargée). Matériaux à part, partagés.

interface TextSpec {
  text: string;
  background: string;
  color: string;
  /** Liseré en damier en haut et en bas, façon drapeau d'arrivée */
  checker?: boolean;
  /** Taille de la cellule, en pixels */
  width: number;
  height: number;
}

const sign = (text: string, checker = false): TextSpec => ({
  text,
  background: RALLY_HEX.night,
  color: RALLY_HEX.brand,
  checker,
  width: 496,
  height: 124,
});
const banner = (text: string): TextSpec => ({
  text,
  background: RALLY_HEX.brand,
  color: RALLY_HEX.ink,
  width: 744,
  height: 124,
});

/** Messages et encres des pancartes, comme le labo : jaune de marque et nuit. */
const PLACARD_TEXTS = [
  "ALLEZ LE 27 !",
  "FONCE !",
  "ON EST LÀ !",
  "PLEIN GAZ",
  "À FOND !",
  "BRAVO !",
  "ALLEZ !",
];
const PLACARD_INKS: { background: string; color: string }[] = [
  { background: RALLY_HEX.brand, color: RALLY_HEX.ink },
  { background: RALLY_HEX.night, color: RALLY_HEX.brand },
  { background: RALLY_HEX.snow, color: RALLY_HEX.ink },
  { background: RALLY_HEX.brand, color: RALLY_HEX.night },
  { background: RALLY_HEX.slate, color: RALLY_HEX.snow },
];

/** Enseignes d'arche, dans l'ordre : départ, secteurs 2 et 3, arrivée. */
export const ARCH_TEXTS = ["start", "sector2", "sector3", "finish"] as const;
export type ArchText = (typeof ARCH_TEXTS)[number];

const SPECS: TextSpec[] = [
  sign("DÉPART · ES 1"),
  sign("SECTEUR 2"),
  sign("SECTEUR 3"),
  sign("ARRIVÉE", true),
  banner("SPÉCIALE 1 · DÉPART"),
  banner("SPÉCIALE 1 · ARRIVÉE"),
  {
    text: "BUVETTE",
    background: RALLY_HEX.night,
    color: RALLY_HEX.brand,
    width: 552,
    height: 40,
  },
  ...PLACARD_INKS.flatMap((ink) =>
    PLACARD_TEXTS.map(
      (text): TextSpec => ({ text, ...ink, width: 120, height: 69 }),
    ),
  ),
];
const BANNER_START = 4;
const BUVETTE = 6;
const PLACARD_FIRST = 7;
const PLACARD_COUNT = PLACARD_TEXTS.length * PLACARD_INKS.length;

const ATLAS = 1024;
/** Jour entre deux cellules : les mipmaps ne bavent pas tout de suite sur la voisine */
const PAD = 8;

/** Rangement en étagères, dans l'ordre de `SPECS`. */
const LAYOUT: { x: number; y: number }[] = (() => {
  let x = 0;
  let y = 0;
  let row = 0;
  return SPECS.map((spec) => {
    if (x + spec.width > ATLAS) {
      x = 0;
      y += row + PAD;
      row = 0;
    }
    const at = { x, y };
    x += spec.width + PAD;
    row = Math.max(row, spec.height);
    return at;
  });
})();

/** Rectangle UV d'une cellule : coin bas-gauche puis taille (la texture est retournée verticalement). */
export type TextCell = [number, number, number, number];

const cellOf = (index: number): TextCell => {
  const { x, y } = LAYOUT[index];
  const { width, height } = SPECS[index];
  // Un demi-pixel de marge : le filtrage ne lit pas le jour.
  return [
    (x + 0.5) / ATLAS,
    1 - (y + height - 0.5) / ATLAS,
    (width - 1) / ATLAS,
    (height - 1) / ATLAS,
  ];
};

export const archCell = (text: ArchText): TextCell =>
  cellOf(ARCH_TEXTS.indexOf(text));
export const bannerCell = (finish: boolean): TextCell =>
  cellOf(BANNER_START + (finish ? 1 : 0));
export const buvetteCell = (): TextCell => cellOf(BUVETTE);
/** Pancarte tirée de la graine : message et encre. */
export const placardCell = (seed: number): TextCell =>
  cellOf(
    PLACARD_FIRST +
      pick(
        Array.from({ length: PLACARD_COUNT }, (_, i) => i),
        seed * 3 + 1,
      ),
  );

const drawCell = (
  context: CanvasRenderingContext2D,
  spec: TextSpec,
  x: number,
  y: number,
): void => {
  const { width, height } = spec;
  context.fillStyle = spec.background;
  context.fillRect(x, y, width, height);
  const band = spec.checker ? Math.round(height * 0.14) : 0;
  if (spec.checker) {
    const square = band / 2;
    const cells = Math.ceil(width / square);
    for (let i = 0; i < cells; i++)
      for (let row = 0; row < 2; row++) {
        context.fillStyle = (i + row) % 2 === 0 ? "#10161f" : "#f4f2ec";
        const w = Math.min(square, width - i * square);
        context.fillRect(x + i * square, y + row * square, w, square);
        context.fillRect(
          x + i * square,
          y + height - band + row * square,
          w,
          square,
        );
      }
  }
  context.fillStyle = spec.color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const font = (px: number): string =>
    `900 ${px}px system-ui, "Segoe UI", sans-serif`;
  let size = (height - band * 2) * 0.62;
  context.font = font(size);
  // Le texte rétrécit jusqu'à tenir dans la largeur.
  while (context.measureText(spec.text).width > width * 0.9 && size > 8) {
    size *= 0.92;
    context.font = font(size);
  }
  context.fillText(spec.text, x + width / 2, y + height / 2 + size * 0.04);
};

const createAtlas = (): {
  texture: CanvasTexture;
  plain: MeshStandardMaterial;
  instanced: MeshStandardMaterial;
} => {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const context = canvas.getContext("2d");
  if (context)
    SPECS.forEach((spec, i) =>
      drawCell(context, spec, LAYOUT[i].x, LAYOUT[i].y),
    );
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const plain = new MeshStandardMaterial({ map: texture, roughness: 0.85 });
  // Lot d'instances : chaque instance lit sa cellule dans l'attribut `textCell` (coin, taille).
  const instanced = new MeshStandardMaterial({ map: texture, roughness: 0.85 });
  instanced.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec4 textCell;`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
vMapUv = textCell.xy + vMapUv * textCell.zw;`,
      );
  };
  instanced.customProgramCacheKey = () => "rally-text-instanced";
  return { texture, plain, instanced };
};

let shared: ReturnType<typeof createAtlas> | undefined;
let users = 0;

/** Matériau des textes aux UV déjà posées (enseignes d'arche, buvette). */
export const rallyTextMaterial = (): MeshStandardMaterial => {
  shared ??= createAtlas();
  return shared.plain;
};

/** Matériau des textes instanciés (pancartes, banderoles) : attribut d'instance `textCell` obligatoire. */
export const rallyTextInstancedMaterial = (): MeshStandardMaterial => {
  shared ??= createAtlas();
  return shared.instanced;
};

export const retainRallyText = (): void => {
  users++;
};

/** Au dernier utilisateur, libère la mémoire GPU ; texture et matériaux restent réutilisables. */
export const releaseRallyText = (): void => {
  users = Math.max(0, users - 1);
  if (users > 0 || !shared) return;
  shared.texture.dispose();
  shared.plain.dispose();
  shared.instanced.dispose();
};

/**
 * Plan imprimé face à +Z, centré en (0, `y`, `z`). Avec `back`, un second plan dos à dos, lisible à l'endroit
 * depuis l'arrière. Avec `cell`, les UV de la cellule sont posées ; sans, elles vont de 0 à 1 (lot d'instances).
 */
export const textQuad = (
  width: number,
  height: number,
  y: number,
  z: number,
  { back = false, cell }: { back?: boolean; cell?: TextCell } = {},
): BufferGeometry => {
  const faces = (back ? [0, Math.PI] : [0]).map((turn) => {
    const plane = new PlaneGeometry(width, height);
    if (cell) {
      const uv = plane.getAttribute("uv");
      for (let i = 0; i < uv.count; i++)
        uv.setXY(
          i,
          cell[0] + uv.getX(i) * cell[2],
          cell[1] + uv.getY(i) * cell[3],
        );
    }
    // Dos à dos, à 1 cm l'un de l'autre : chaque face masque l'autre par son revers.
    plane.translate(0, 0, 0.005);
    if (turn) plane.rotateY(turn);
    plane.translate(0, y, z);
    return plane;
  });
  if (faces.length === 1) return faces[0];
  const geometry = mergeGeometries(faces);
  for (const face of faces) face.dispose();
  if (!geometry) throw new Error("Faces de texte incompatibles");
  return geometry;
};
