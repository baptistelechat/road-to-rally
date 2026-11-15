import {
  Color,
  MeshDepthMaterial,
  MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { CROWD_PALETTE, type Outfit } from "./outfits";

// Même principe que le labo (attributs de sommet `slot` et `partId`, palette en uniforme), mais la tenue voyage
// dans `instanceColor` : aucune copie de géométrie par lot, tous les lots d'une pose partagent la même.
// Entiers empaquetés : r = peau + 32 × haut, g = bas + 32 × tête (indices de palette), b = masque des pièces.

/** Écrit une tenue dans les trois flottants d'`instanceColor` à partir de `offset`. */
export const packOutfit = (
  { colors: [skin, top, bottom, head], mask }: Outfit,
  target: Float32Array,
  offset: number,
): void => {
  target[offset] = skin + 32 * top;
  target[offset + 1] = bottom + 32 * head;
  target[offset + 2] = mask;
};

const DECLARATIONS = `#include <common>
attribute float partId;`;

// Pièce masquée écrasée en un point : plus rien à tramer, ni à l'image ni dans l'ombre.
const COLLAPSE = `#include <begin_vertex>
#ifdef USE_INSTANCING_COLOR
int crowdPart = int(partId + 0.5);
if (crowdPart > 0 && ((int(instanceColor.b + 0.5) >> (crowdPart - 1)) & 1) == 0) transformed = vec3(0.0);
#endif`;

// Slot impair : 5 bits bas, pair : 5 bits hauts ; 1-2 lisent r, 3-4 lisent g.
const OUTFIT_COLOR = `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
vColor = vec4(color, 1.0);
int crowdSlot = int(slot + 0.5);
if (crowdSlot > 0) {
  int crowdPacked = int((crowdSlot <= 2 ? instanceColor.r : instanceColor.g) + 0.5);
  int crowdIndex = (crowdSlot & 1) == 1 ? (crowdPacked & 31) : (crowdPacked >> 5);
  vColor.rgb *= uCrowdPalette[crowdIndex];
}
#endif`;

const palette = CROWD_PALETTE.map((hex) => new Color(hex));

const withCollapse = (shader: WebGLProgramParametersWithUniforms): void => {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", DECLARATIONS)
    .replace("#include <begin_vertex>", COLLAPSE);
};

const createMaterial = (): MeshStandardMaterial => {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.9,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCrowdPalette = { value: palette };
    withCollapse(shader);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec3 uCrowdPalette[${palette.length}];
attribute float slot;`,
      )
      .replace("#include <color_vertex>", OUTFIT_COLOR);
  };
  material.customProgramCacheKey = () => "game-crowd-outfit";
  return material;
};

/** Ombre portée : sans lui, les coiffes masquées projetteraient quand même leur ombre. */
const createDepthMaterial = (): MeshDepthMaterial => {
  const material = new MeshDepthMaterial();
  material.onBeforeCompile = withCollapse;
  material.customProgramCacheKey = () => "game-crowd-depth";
  return material;
};

// ponytail: partagés toute la vie de l'application, comme `SCENERY_MATERIAL`.
export const CROWD_MATERIAL = createMaterial();
export const CROWD_DEPTH_MATERIAL = createDepthMaterial();
