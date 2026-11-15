// Copié du labo `decor-lab/buildings/mesh.ts` (story 5.2).
import { BufferAttribute, BufferGeometry } from "three";
import type { Rgb } from "@/render/palette";
import type { Vec3 } from "./buildingMath";

// Tampons sans index, couleur par sommet : le flat shading et la fusion n'ont besoin de rien d'autre.

export interface Buffers {
  positions: number[];
  colors: number[];
}

/** Sommet coloré */
export interface Vertex {
  p: Vec3;
  c: Rgb;
}

export const createBuffers = (): Buffers => ({ positions: [], colors: [] });

export const triangleCount = (out: Buffers): number => out.positions.length / 9;

export const shade = (color: Rgb, factor: number): Rgb => [
  color[0] * factor,
  color[1] * factor,
  color[2] * factor,
];

export const UP: Vec3 = [0, 1, 0];
export const DOWN: Vec3 = [0, -1, 0];

const pushVertex = (out: Buffers, v: Vertex): void => {
  out.positions.push(v.p[0], v.p[1], v.p[2]);
  out.colors.push(v.c[0], v.c[1], v.c[2]);
};

/** Triangle retourné au besoin pour que sa normale aille du côté de `want` : aucun souci de sens de parcours. */
export const pushTriangle = (
  out: Buffers,
  a: Vertex,
  b: Vertex,
  c: Vertex,
  want: Vec3,
): void => {
  const ab = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]];
  const ac = [c.p[0] - a.p[0], c.p[1] - a.p[1], c.p[2] - a.p[2]];
  const nx = ab[1] * ac[2] - ab[2] * ac[1];
  const ny = ab[2] * ac[0] - ab[0] * ac[2];
  const nz = ab[0] * ac[1] - ab[1] * ac[0];
  // Triangle dégénéré : rien à dessiner.
  if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) < 1e-9) return;
  const facing = nx * want[0] + ny * want[1] + nz * want[2] >= 0;
  pushVertex(out, a);
  pushVertex(out, facing ? b : c);
  pushVertex(out, facing ? c : b);
};

const isRgb = (color: Rgb | [Rgb, Rgb, Rgb, Rgb]): color is Rgb =>
  typeof color[0] === "number";

/** Quadrilatère p0-p1-p2-p3, d'une seule couleur ou d'une couleur par sommet. */
export const pushQuad = (
  out: Buffers,
  points: [Vec3, Vec3, Vec3, Vec3],
  want: Vec3,
  color: Rgb | [Rgb, Rgb, Rgb, Rgb],
): void => {
  const colors = isRgb(color) ? [color, color, color, color] : color;
  const v = points.map((p, i): Vertex => ({ p, c: colors[i] }));
  pushTriangle(out, v[0], v[1], v[2], want);
  pushTriangle(out, v[0], v[2], v[3], want);
};

export interface BoxParams {
  cx: number;
  cz: number;
  /** Axe local de la boîte dans le plan (unitaire) */
  ux: number;
  uz: number;
  halfU: number;
  halfV: number;
  y0: number;
  y1: number;
  color: Rgb;
  top: boolean;
}

/** Boîte sans fond : quatre faces et, au besoin, un dessus. 8 ou 10 triangles. */
export const pushBox = (out: Buffers, box: BoxParams): void => {
  const vx = -box.uz;
  const vz = box.ux;
  const corner = (su: number, sv: number, y: number): Vec3 => [
    box.cx + box.ux * box.halfU * su + vx * box.halfV * sv,
    y,
    box.cz + box.uz * box.halfU * su + vz * box.halfV * sv,
  ];
  const sides: [number, number, number, number][] = [
    [1, -1, 1, 1],
    [1, 1, -1, 1],
    [-1, 1, -1, -1],
    [-1, -1, 1, -1],
  ];
  for (const [su0, sv0, su1, sv1] of sides) {
    const mu = (su0 + su1) / 2;
    const mv = (sv0 + sv1) / 2;
    const want: Vec3 = [box.ux * mu + vx * mv, 0, box.uz * mu + vz * mv];
    pushQuad(
      out,
      [
        corner(su0, sv0, box.y0),
        corner(su1, sv1, box.y0),
        corner(su1, sv1, box.y1),
        corner(su0, sv0, box.y1),
      ],
      want,
      box.color,
    );
  }
  if (box.top)
    pushQuad(
      out,
      [
        corner(-1, -1, box.y1),
        corner(1, -1, box.y1),
        corner(1, 1, box.y1),
        corner(-1, 1, box.y1),
      ],
      UP,
      box.color,
    );
};

export const toGeometry = (out: Buffers): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(out.positions), 3),
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(out.colors), 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};
