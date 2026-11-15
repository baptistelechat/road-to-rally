// Géométries de la petite scène du labo des ambiances : un bout de route en lacet, des maisons en blocs.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Shape,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DECOR_PALETTE, type Rgb } from "@/render/palette";

/** Largeur de la chaussée, en mètres */
const ROAD_WIDTH = 6;
/** Largeur des lignes de rive */
const LINE_WIDTH = 0.18;

/** Lacet : la voiture est à l'origine, cap vers -Z, puis la route monte en épingle à droite. */
export const ROAD_CURVE = new CatmullRomCurve3(
  [
    [-8, 0, 60],
    [-2, 0, 30],
    [0, 0, 10],
    [0, 0, -12],
    [4, 0, -30],
    [16, 0, -40],
    [28, 0, -34],
    [30, 0, -20],
    [26, 0, -4],
    [28, 0, 16],
    [40, 0, 34],
  ].map(([x, y, z]) => new Vector3(x, y, z)),
);

/** Bande à plat le long de la courbe, entre deux décalages latéraux (gauche négatif). */
const ribbon = (
  from: number,
  to: number,
  y: number,
  samples = 240,
): BufferGeometry => {
  const positions: number[] = [];
  const up = new Vector3(0, 1, 0);
  const side = new Vector3();
  const points = ROAD_CURVE.getSpacedPoints(samples);
  for (let i = 0; i < points.length; i++) {
    const tangent = ROAD_CURVE.getTangentAt(i / samples);
    side.crossVectors(tangent, up).normalize();
    const p = points[i];
    positions.push(p.x + side.x * from, y, p.z + side.z * from);
    positions.push(p.x + side.x * to, y, p.z + side.z * to);
  }
  const index: number[] = [];
  for (let i = 0; i < samples; i++) {
    const a = i * 2;
    // Faces tournées vers le haut : (gauche, droite, gauche suivante), puis (droite, droite suivante, gauche suivante).
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
};

export const roadGeometry = (): BufferGeometry =>
  ribbon(-ROAD_WIDTH / 2, ROAD_WIDTH / 2, 0.03);

/** Les deux lignes de rive, un peu au-dessus de la chaussée */
export const roadLinesGeometry = (): BufferGeometry => {
  const edge = ROAD_WIDTH / 2 - 0.35;
  const geometry = mergeGeometries([
    ribbon(-edge - LINE_WIDTH, -edge, 0.05),
    ribbon(edge, edge + LINE_WIDTH, 0.05),
  ]);
  if (!geometry) throw new Error("Lignes de rive incompatibles");
  return geometry;
};

/** Pièce sans index, colorée par sommet, comme le décor du jeu */
const colored = (geometry: BufferGeometry, color: Rgb): BufferGeometry => {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.clearGroups();
  const count = flat.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set(color, i * 3);
  flat.setAttribute("color", new BufferAttribute(colors, 3));
  flat.deleteAttribute("uv");
  return flat;
};

export type BuildingKind = keyof typeof DECOR_PALETTE.wall;

/** Maison en bloc : murs et toit à deux pans, origine au pied, faîtage le long de X. */
export const buildingGeometry = (
  kind: BuildingKind,
  width: number,
  depth: number,
  height: number,
): BufferGeometry => {
  const walls = new BoxGeometry(width, height, depth);
  walls.translate(0, height / 2, 0);
  const overhang = 0.35;
  const roofHeight = depth * 0.42;
  const profile = new Shape();
  profile.moveTo(-depth / 2 - overhang, 0);
  profile.lineTo(depth / 2 + overhang, 0);
  profile.lineTo(0, roofHeight);
  profile.closePath();
  const roof = new ExtrudeGeometry(profile, {
    depth: width + overhang * 2,
    bevelEnabled: false,
  });
  // Profil dans le plan YZ, extrudé le long de X.
  roof.translate(0, 0, -(width + overhang * 2) / 2);
  roof.rotateY(Math.PI / 2);
  roof.translate(0, height, 0);
  const geometry = mergeGeometries([
    colored(walls, DECOR_PALETTE.wall[kind]),
    colored(roof, DECOR_PALETTE.roof[kind]),
  ]);
  if (!geometry) throw new Error("Pièces de bâtiment incompatibles");
  return geometry;
};
