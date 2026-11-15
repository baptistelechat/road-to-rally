import {
  Color,
  MeshDepthMaterial,
  MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { CROWD_PALETTE } from "./outfits";

// Un seul maillage instancié par pose, mais une tenue par instance :
// - attributs de sommet `slot` (0 fixe, 1 peau, 2 haut, 3 bas, 4 tête) et `partId` (coiffe, bande…) ;
// - attributs d'instance `outfit` (4 indices de palette) et `partMask` (pièces montrées) ;
// - le shader multiplie la couleur du sommet par l'entrée de palette, et écrase les pièces masquées en un point.

const DECLARATIONS = `#include <common>
attribute float partId;
attribute float partMask;`;

const COLLAPSE = `#include <begin_vertex>
int crowdPart = int(partId + 0.5);
if (crowdPart > 0 && ((int(partMask + 0.5) >> (crowdPart - 1)) & 1) == 0) transformed = vec3(0.0);`;

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
attribute float slot;
attribute vec4 outfit;`,
      )
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
int crowdSlot = int(slot + 0.5);
if (crowdSlot > 0) vColor.rgb *= uCrowdPalette[int(outfit[crowdSlot - 1] + 0.5)];`,
      );
  };
  material.customProgramCacheKey = () => "crowd-outfit";
  return material;
};

/** Ombre portée : sans ce matériau, les coiffes masquées projetteraient quand même leur ombre. */
const createDepthMaterial = (): MeshDepthMaterial => {
  const material = new MeshDepthMaterial();
  material.onBeforeCompile = withCollapse;
  material.customProgramCacheKey = () => "crowd-depth";
  return material;
};

export const CROWD_MATERIAL = createMaterial();
export const CROWD_DEPTH_MATERIAL = createDepthMaterial();

/** Décor fixe (banderoles, tentes…) : couleurs par sommet, comme `SCENERY_MATERIAL`. */
export const DRESSING_MATERIAL = new MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.92,
});
