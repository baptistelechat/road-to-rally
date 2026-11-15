// Copie de `src/app/decor-lab/crowd/flagAtlas.ts` : le labo évolue à part, resynchroniser à la main.
import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector2,
} from "three";
import { FLAGS, loadFlagImages, NO_FLAG } from "@/render/car/flags";
import { hash, pick } from "./hash";

// Atlas des drapeaux du jeu : une seule texture, une cellule par pays ; chaque instance lit sa cellule par UV.

export const ATLAS_FLAGS: readonly string[] = FLAGS.filter(
  ({ id }) => id !== NO_FLAG,
).map(({ id }) => id);

const COLUMNS = 16;
const ROWS = Math.ceil(ATLAS_FLAGS.length / COLUMNS);
/** Cellule en 3:2, comme les SVG de la bibliothèque */
const CELL_W = 48;
const CELL_H = 32;
/** Marge en UV : le filtrage ne bave pas sur la cellule voisine */
const INSET = 0.03;

export const ATLAS_SIZE = { width: COLUMNS * CELL_W, height: ROWS * CELL_H };

/** Pays hôte : plus fréquent dans le public et toujours sur le premier mât. */
export const HOST_FLAG = "FR";
/** Part du public qui brandit le drapeau du pays hôte */
const HOST_SHARE = 0.25;
const OTHER_FLAGS = ATLAS_FLAGS.filter((id) => id !== HOST_FLAG);

/** Drapeau étranger tiré de la graine, jamais celui du pays hôte. */
export const otherFlagOf = (seed: number): string =>
  pick(OTHER_FLAGS, seed * 13 + 5);

/** Drapeau d'une instance, tiré de sa graine : la France une fois sur quatre, sinon n'importe quel autre pays du jeu. */
export const flagOf = (seed: number): string =>
  hash(seed * 7 + 9) < HOST_SHARE ? HOST_FLAG : otherFlagOf(seed);

/** Coin bas-gauche de la cellule en UV (la texture est retournée verticalement). */
export const flagCell = (id: string): [number, number] => {
  const index = Math.max(0, ATLAS_FLAGS.indexOf(id));
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return [(column + INSET) / COLUMNS, 1 - (row + 1 - INSET) / ROWS];
};

const CELL_SIZE = new Vector2(
  (1 - 2 * INSET) / COLUMNS,
  (1 - 2 * INSET) / ROWS,
);

const SVG_PREFIX = "data:image/svg+xml,";

/**
 * Donne au SVG une taille explicite : les SVG de la bibliothèque n'ont qu'un viewBox,
 * Firefox refuse alors de les dessiner et `decode()` peut échouer.
 */
const sizedSvg = (source: string): string => {
  if (!source.startsWith(SVG_PREFIX)) return source;
  const svg = decodeURIComponent(source.slice(SVG_PREFIX.length));
  return (
    SVG_PREFIX +
    encodeURIComponent(
      svg.replace(
        "<svg ",
        `<svg width="${CELL_W * 2}" height="${CELL_H * 2}" preserveAspectRatio="none" `,
      ),
    )
  );
};

/** Image chargée, ou `null` : un drapeau illisible ne bloque pas les autres. */
const loadImage = (source: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = sizedSvg(source);
  });

/**
 * Remplit l'atlas. Avant, une seule image en échec (exception de `drawImage`) rejetait tout le lot :
 * la texture n'était jamais mise à jour et les toiles restaient grises.
 */
const drawAtlas = (texture: CanvasTexture, canvas: HTMLCanvasElement): void => {
  void loadFlagImages().then(async (images) => {
    const context = canvas.getContext("2d");
    if (!context) return;
    await Promise.all(
      ATLAS_FLAGS.map(async (id, index) => {
        const source = images[id];
        if (!source) return;
        const image = await loadImage(source);
        if (!image) return;
        try {
          context.drawImage(
            image,
            (index % COLUMNS) * CELL_W,
            Math.floor(index / COLUMNS) * CELL_H,
            CELL_W,
            CELL_H,
          );
        } catch {
          // Cellule laissée grise
        }
      }),
    );
    texture.needsUpdate = true;
  });
};

const createMaterial = (): {
  texture: CanvasTexture;
  material: MeshStandardMaterial;
} => {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE.width;
  canvas.height = ATLAS_SIZE.height;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#93a0b4";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Sans mipmaps : les cellules voisines ne se mélangent pas au loin.
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  const material = new MeshStandardMaterial({
    map: texture,
    side: DoubleSide,
    roughness: 0.85,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.flagCellSize = { value: CELL_SIZE };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec2 flagCell;
uniform vec2 flagCellSize;`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
vMapUv = vMapUv * flagCellSize + flagCell;`,
      );
  };
  material.customProgramCacheKey = () => "game-crowd-flag-atlas";
  drawAtlas(texture, canvas);
  return { texture, material };
};

let shared: ReturnType<typeof createMaterial> | undefined;
let users = 0;

/** Matériau partagé de l'atlas, créé au premier appel côté client. */
export const flagMaterial = (): MeshStandardMaterial => {
  shared ??= createMaterial();
  return shared.material;
};

export const retainFlagMaterial = (): void => {
  users++;
};

/** Au dernier utilisateur, libère la mémoire GPU ; les objets restent réutilisables (renvoyés au prochain rendu). */
export const releaseFlagMaterial = (): void => {
  users = Math.max(0, users - 1);
  if (users > 0 || !shared) return;
  shared.texture.dispose();
  shared.material.dispose();
};
