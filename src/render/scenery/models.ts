import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Path,
  Shape,
  ShapeGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  CHICANE_BARRIER_HEIGHT,
  CHICANE_SKIRT,
  CHICANE_STACK_DEPTH,
  CHICANE_STACK_HEIGHT,
  CHICANE_STACK_ROWS,
} from "@/geo/config";
import type { SceneryKind } from "@/sim/types";
import {
  SIGN_ART_BENDS,
  SIGN_ART_BORDER,
  SIGN_ART_FIELD,
  SIGN_ART_HEIGHT,
  SIGN_ART_RIM,
  SIGN_ART_WIDTH,
} from "./chicaneSignArt";

type Rgb = [number, number, number];

/** Pièce sans index et colorée : le flat shading et la fusion n'ont besoin de rien d'autre. */
const part = (
  geometry: BufferGeometry,
  color: Rgb,
  x = 0,
  y = 0,
  z = 0,
  rotateZ = 0,
): BufferGeometry => {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.rotateZ(rotateZ);
  flat.translate(x, y, z);
  const count = flat.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set(color, i * 3);
  flat.setAttribute("color", new BufferAttribute(colors, 3));
  flat.deleteAttribute("uv");
  return flat;
};

const merged = (...parts: BufferGeometry[]): BufferGeometry => {
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error("Pièces de décor incompatibles");
  return geometry;
};

const TRUNK: Rgb = [0.34, 0.24, 0.16];

// Origine au pied de l'élément, dimensions pour `scale` = 1.
/** Objets du décor dessinés depuis `SCENERY_GEOMETRY` ; les annonces de chicane viennent de `CHICANE_GEOMETRY`. */
export type StaticSceneryKind = Exclude<
  SceneryKind,
  "chicaneSignLeft" | "chicaneSignRight"
>;

export const SCENERY_GEOMETRY: Record<StaticSceneryKind, BufferGeometry> = {
  tree: merged(
    part(new CylinderGeometry(0.22, 0.32, 2.4, 5), TRUNK, 0, 1.2),
    part(new IcosahedronGeometry(2, 0), [0.32, 0.47, 0.17], 0, 3.6),
  ),
  pine: merged(
    part(new CylinderGeometry(0.16, 0.26, 1.6, 5), TRUNK, 0, 0.8),
    part(new ConeGeometry(1.9, 3.4, 6), [0.14, 0.32, 0.17], 0, 3),
    part(new ConeGeometry(1.35, 2.8, 6), [0.17, 0.37, 0.19], 0, 5),
  ),
  rock: part(new DodecahedronGeometry(1, 0), [0.47, 0.45, 0.41], 0, 0.45),
  hay: part(
    new CylinderGeometry(0.75, 0.75, 1.2, 8),
    [0.82, 0.68, 0.32],
    0,
    0.75,
    0,
    Math.PI / 2,
  ),
  hayUpright: part(
    new CylinderGeometry(0.75, 0.75, 1.2, 8),
    [0.82, 0.68, 0.32],
    0,
    0.6,
  ),
  post: part(new BoxGeometry(0.18, 1, 0.18), [0.95, 0.93, 0.88], 0, 0.5),
  sign: merged(
    part(new BoxGeometry(0.1, 2, 0.1), [0.5, 0.5, 0.52], 0, 1),
    part(new BoxGeometry(1, 0.7, 0.06), [0.92, 0.72, 0.1], 0, 2.1),
    part(new BoxGeometry(0.85, 0.18, 0.08), [0.1, 0.1, 0.1], 0, 2.1),
  ),
};

const TAPE_RED: Rgb = [0.86, 0.12, 0.1];
const TAPE_WHITE: Rgb = [0.96, 0.96, 0.94];
/** Tons de paille alternés : les bottes se lisent une à une, sans teinte par instance. */
const STRAW: Rgb[] = [
  [0.86, 0.71, 0.33],
  [0.78, 0.63, 0.27],
  [0.82, 0.67, 0.3],
];
const TWINE: Rgb = [0.52, 0.39, 0.15];
const TWINE_WIDTH = 0.06;

/** Longueur d'un module en travers de la route : la vue en met autant que le bloc en demande. */
export const CHICANE_BARRIER_MODULE = 2;
export const CHICANE_STACK_MODULE = 2.4;

/** Poteaux aux extrémités, ruban en boîtes fines : visible des deux faces sans matériau double face. */
const chicaneBarrier = (): BufferGeometry => {
  const half = CHICANE_BARRIER_MODULE / 2;
  const postHeight = CHICANE_BARRIER_HEIGHT + CHICANE_SKIRT;
  const stripes = 4;
  const stripe = CHICANE_BARRIER_MODULE / stripes;
  const tapes = [0.45, 0.8].map((height) => height * CHICANE_BARRIER_HEIGHT);
  return merged(
    ...[-half, half].map((x) =>
      part(
        new BoxGeometry(0.1, postHeight, 0.1),
        [0.36, 0.36, 0.38],
        x,
        postHeight / 2 - CHICANE_SKIRT,
      ),
    ),
    ...tapes.flatMap((y, row) =>
      Array.from({ length: stripes }, (_, i) =>
        part(
          new BoxGeometry(stripe, 0.2, 0.03),
          (i + row) % 2 === 0 ? TAPE_RED : TAPE_WHITE,
          -half + stripe * (i + 0.5),
          y,
        ),
      ),
    ),
  );
};

/** Bottes carrées posées en quinconce : une pile sans jour, contrairement aux bottes rondes qui laisseraient voir la sortie. */
const hayStack = (): BufferGeometry => {
  const rows = CHICANE_STACK_ROWS;
  const baleHeight = CHICANE_STACK_HEIGHT / rows;
  const half = CHICANE_STACK_MODULE / 2;
  const bale = half;
  const bales: BufferGeometry[] = [];
  for (let row = 0; row < rows; row++) {
    // Rang pair : deux bottes. Rang impair : une botte au milieu et deux moitiés, qui se raccordent au module voisin.
    const edges =
      row % 2 === 0 ? [-half, 0, half] : [-half, -bale / 2, bale / 2, half];
    // Le rang du bas descend jusqu'à la partie enterrée.
    const bottom = row === 0 ? -CHICANE_SKIRT : baleHeight * row;
    const top = baleHeight * (row + 1);
    for (let i = 0; i < edges.length - 1; i++) {
      const length = edges[i + 1] - edges[i];
      const x = (edges[i] + edges[i + 1]) / 2;
      const y = (bottom + top) / 2;
      const slab = (width: number, color: Rgb, at: number): BufferGeometry =>
        part(
          new BoxGeometry(width, top - bottom, CHICANE_STACK_DEPTH),
          color,
          at,
          y,
        );
      // La ficelle est une tranche de la botte, pas une pièce posée dessus : deux faces presque confondues clignotent au loin.
      const straw = (length - TWINE_WIDTH) / 2;
      const color = STRAW[(row + i) % STRAW.length];
      bales.push(
        slab(straw, color, x - (straw + TWINE_WIDTH) / 2),
        slab(TWINE_WIDTH, TWINE, x),
        slab(straw, color, x + (straw + TWINE_WIDTH) / 2),
      );
    }
  }
  return merged(...bales);
};

const SIGN_BLUE: Rgb = [0.03, 0.27, 0.82];
const SIGN_WHITE: Rgb = [0.97, 0.97, 0.97];
const SIGN_POLE: Rgb = [0.5, 0.5, 0.52];

type Outline = [number, number][];

const scaled = (points: Outline, scale: number): Vector2[] =>
  points.map(([x, y]) => new Vector2(x * scale, y * scale));

/** `hole` y découpe une forme, pour que rien ne se superpose. */
const polygon = (
  points: Outline,
  scale: number,
  hole?: Outline,
): ShapeGeometry => {
  const shape = new Shape().setFromPoints(scaled(points, scale));
  if (hole) shape.holes.push(new Path().setFromPoints(scaled(hole, scale)));
  return new ShapeGeometry(shape);
};

/** Espacement des panneaux à chevron sur la pile, un par module : la vue répartit, comme pour les barrières. */
export const CHICANE_CHEVRON_MODULE = 2;
const CHEVRON_SIZE = CHICANE_STACK_HEIGHT - CHICANE_BARRIER_HEIGHT;
const CHEVRON_Y = CHICANE_BARRIER_HEIGHT + CHEVRON_SIZE / 2;
const CHEVRON_LEFT: [number, number][] = [
  [-0.5, 0],
  [-0.02, 0.5],
  [0.5, 0.5],
  [0.01, 0],
  [0.5, -0.5],
  [-0.02, -0.5],
];

/** Zones bleues autour du chevron : des pièces voisines dans un même plan, sans rien de superposé qui puisse clignoter. */
const CHEVRON_BLUE: [number, number][][] = [
  [
    [-0.5, 0],
    [-0.02, 0.5],
    [-0.5, 0.5],
  ],
  [
    [-0.5, 0],
    [-0.5, -0.5],
    [-0.02, -0.5],
  ],
  [
    [0.5, 0.5],
    [0.01, 0],
    [0.5, -0.5],
  ],
];
const SQUARE: [number, number][] = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
];

/** Chevron posé devant la pile, au-dessus de la barrière. Une carte sans épaisseur, face au pilote en +Z, grise au dos. `rotateZ` = π : il pointe à droite. */
const chevronPanel = (rotateZ: number): BufferGeometry =>
  merged(
    part(
      polygon(CHEVRON_LEFT, CHEVRON_SIZE),
      SIGN_WHITE,
      0,
      CHEVRON_Y,
      0,
      rotateZ,
    ),
    ...CHEVRON_BLUE.map((zone) =>
      part(polygon(zone, CHEVRON_SIZE), SIGN_BLUE, 0, CHEVRON_Y, 0, rotateZ),
    ),
    part(
      polygon(SQUARE, CHEVRON_SIZE).rotateY(Math.PI),
      SIGN_POLE,
      0,
      CHEVRON_Y,
    ),
  );

const SIGN_RED: Rgb = [0.68, 0.1, 0.07];
const SIGN_PAINT_WHITE: Rgb = [0.88, 0.87, 0.84];
const SIGN_BLACK: Rgb = [0.03, 0.03, 0.03];
/** Largeur du panneau d'annonce et hauteur de son centre, en mètres */
const WARNING_SIGN_WIDTH = 1.7;
const WARNING_SIGN_Y = 2.45;
/** Épaisseur de la tôle et de son cadre, en mètres : c'est elle qui accroche la lumière sur les bords */
const WARNING_SIGN_DEPTH = 0.06;
const WARNING_POLE_Z = -WARNING_SIGN_DEPTH - 0.06;

/** Le dessin du panneau, ramené à une largeur de 1 autour de son centre. */
const artwork = (points: Outline): Outline =>
  points.map(([x, y]) => [
    (x - SIGN_ART_WIDTH / 2) / SIGN_ART_WIDTH,
    (SIGN_ART_HEIGHT / 2 - y) / SIGN_ART_WIDTH,
  ]);

/** Dans le sens direct : la tranche se construit vers l'extérieur. */
const SIGN_RIM = artwork(SIGN_ART_RIM);
const SIGN_BORDER = artwork(SIGN_ART_BORDER);
const SIGN_FIELD = artwork(SIGN_ART_FIELD);
const SIGN_BENDS = artwork(SIGN_ART_BENDS);

/** Tranche d'un contour tourné dans le sens direct, de z = 0 à z = -`depth`. Sans face avant : rien à superposer au dessin, donc rien qui clignote. */
const edgeStrip = (
  points: Outline,
  scale: number,
  depth: number,
): BufferGeometry => {
  const positions = points.flatMap(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length];
    const [x0, y0, x1, y1] = [ax * scale, ay * scale, bx * scale, by * scale];
    return [
      [x0, y0, 0],
      [x0, y0, -depth],
      [x1, y1, -depth],
      [x0, y0, 0],
      [x1, y1, -depth],
      [x1, y1, 0],
    ].flat();
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.computeVertexNormals();
  return geometry;
};

/** Panneau d'annonce en triangle : une tôle épaisse, face au pilote en +Z, sur un poteau rond avec sa traverse. `mirrored` : le premier virage part à gauche. */
/** `buried` : mât enfoui sous le sol. Renversable, le panneau n'en a pas : il se verrait une fois couché. */
const warningSign = (
  mirrored: boolean,
  buried: number = CHICANE_SKIRT,
): BufferGeometry => {
  const bends: Outline = mirrored
    ? SIGN_BENDS.map(([x, y]) => [-x, y])
    : SIGN_BENDS;
  const face = (geometry: BufferGeometry, color: Rgb): BufferGeometry =>
    part(geometry, color, 0, WARNING_SIGN_Y);
  const poleTop = WARNING_SIGN_Y + 0.35;
  return merged(
    part(
      new CylinderGeometry(0.045, 0.045, poleTop + buried, 8),
      SIGN_POLE,
      0,
      (poleTop - buried) / 2,
      WARNING_POLE_Z,
    ),
    part(
      new BoxGeometry(WARNING_SIGN_WIDTH * 0.7, 0.07, 0.03),
      SIGN_POLE,
      0,
      WARNING_SIGN_Y - 0.3,
      -WARNING_SIGN_DEPTH - 0.015,
    ),
    face(polygon(SIGN_RIM, WARNING_SIGN_WIDTH, SIGN_BORDER), SIGN_PAINT_WHITE),
    face(polygon(SIGN_BORDER, WARNING_SIGN_WIDTH, SIGN_FIELD), SIGN_RED),
    face(polygon(SIGN_FIELD, WARNING_SIGN_WIDTH, bends), SIGN_PAINT_WHITE),
    face(polygon(bends, WARNING_SIGN_WIDTH), SIGN_BLACK),
    face(
      edgeStrip(SIGN_RIM, WARNING_SIGN_WIDTH, WARNING_SIGN_DEPTH),
      SIGN_POLE,
    ),
    part(
      polygon(SIGN_RIM, WARNING_SIGN_WIDTH).rotateY(Math.PI),
      SIGN_POLE,
      0,
      WARNING_SIGN_Y,
      -WARNING_SIGN_DEPTH,
    ),
  );
};

// Origine au centre du module, au niveau de la route : la partie sous y = 0 reste enterrée.
export const CHICANE_GEOMETRY = {
  chicaneBarrier: chicaneBarrier(),
  hayStack: hayStack(),
  chevronLeft: chevronPanel(0),
  chevronRight: chevronPanel(Math.PI),
  signLeft: warningSign(true),
  signRight: warningSign(false),
  /** Annonces renversables en course : origine au pied, rien sous le sol */
  looseSignLeft: warningSign(true, 0),
  looseSignRight: warningSign(false, 0),
};

export const SCENERY_MATERIAL = new MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.95,
});

/** Géométrie d'un objet léger, annonces de chicane comprises. */
export const lightPropGeometry = (kind: SceneryKind): BufferGeometry => {
  if (kind === "chicaneSignLeft") return CHICANE_GEOMETRY.looseSignLeft;
  if (kind === "chicaneSignRight") return CHICANE_GEOMETRY.looseSignRight;
  return SCENERY_GEOMETRY[kind];
};
