import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ShapeUtils,
  Vector2,
} from "three";

// Petit constructeur de maillage : une soupe de triangles non indexés, donc une normale par face (flat shading)
// et une couleur par face. Chaque face reçoit la direction vers laquelle elle doit regarder, ce qui évite
// de gérer l'ordre des sommets à la main.

export type V3 = readonly [number, number, number];
export type Rgb = readonly [number, number, number];
/** Point de silhouette latérale : [z, y] */
export type P2 = readonly [number, number];

/** Découpe horizontale : `colors[k]` sous `cuts[k]`, le dernier au-dessus de toutes les coupes. */
export interface Bands {
  cuts: number[];
  colors: Rgb[];
}

export const rgb = (hex: string): Rgb => {
  const { r, g, b } = new Color(hex);
  return [r, g, b];
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Garde la partie d'un polygone convexe au-dessus ou en dessous de l'altitude `y`. */
const clipY = (points: V3[], y: number, keepAbove: boolean): V3[] => {
  const kept: V3[] = [];
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    const pIn = keepAbove ? p[1] >= y : p[1] <= y;
    const qIn = keepAbove ? q[1] >= y : q[1] <= y;
    if (pIn) kept.push(p);
    if (pIn !== qIn) {
      const t = (y - p[1]) / (q[1] - p[1]);
      kept.push([p[0] + (q[0] - p[0]) * t, y, p[2] + (q[2] - p[2]) * t]);
    }
  });
  return kept;
};

export const createMeshBuilder = () => {
  const positions: number[] = [];
  const colors: number[] = [];

  const tri = (a: V3, b: V3, c: V3, color: Rgb, out: V3): void => {
    const normal = cross(sub(b, a), sub(c, a));
    if (dot(normal, normal) < 1e-14) return;
    const [p, q] = dot(normal, out) < 0 ? [c, b] : [b, c];
    positions.push(...a, ...p, ...q);
    colors.push(...color, ...color, ...color);
  };

  /** Polygone convexe plan (ou presque). */
  const face = (points: readonly V3[], color: Rgb, out: V3): void => {
    for (let i = 1; i < points.length - 1; i++)
      tri(points[0], points[i], points[i + 1], color, out);
  };

  /** Comme `face`, mais découpé par bandes horizontales : les aplats de la livrée sans aucune superposition. */
  const paintedFace = (points: readonly V3[], bands: Bands, out: V3): void => {
    for (let i = 1; i < points.length - 1; i++) {
      bands.colors.forEach((color, k) => {
        let piece: V3[] = [points[0], points[i], points[i + 1]];
        if (k > 0) piece = clipY(piece, bands.cuts[k - 1], true);
        if (k < bands.cuts.length) piece = clipY(piece, bands.cuts[k], false);
        if (piece.length >= 3) face(piece, color, out);
      });
    }
  };

  const box = (min: V3, max: V3, color: Rgb): void => {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    face(
      [
        [x0, y0, z0],
        [x0, y1, z0],
        [x0, y1, z1],
        [x0, y0, z1],
      ],
      color,
      [-1, 0, 0],
    );
    face(
      [
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1],
      ],
      color,
      [1, 0, 0],
    );
    face(
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
      color,
      [0, -1, 0],
    );
    face(
      [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      color,
      [0, 1, 0],
    );
    face(
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      color,
      [0, 0, -1],
    );
    face(
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      color,
      [0, 0, 1],
    );
  };

  /**
   * Extrude une silhouette latérale de part et d'autre de x = 0. Si `halfWidth` est affine en y,
   * les flancs restent plans : c'est ce qui donne le dévers de la caisse.
   */
  const extrude = (
    outline: readonly P2[],
    halfWidth: (y: number) => number,
    bands: Bands,
    edgeColor: (a: P2, b: P2) => Rgb,
  ): void => {
    const contour = outline.map(([z, y]) => new Vector2(z, y));
    const flip = ShapeUtils.isClockWise(contour) ? -1 : 1;
    const triangles = ShapeUtils.triangulateShape(contour, []);
    const point = (side: number, [z, y]: P2): V3 => [side * halfWidth(y), y, z];

    for (const side of [-1, 1]) {
      for (const [i, j, k] of triangles) {
        const points = [outline[i], outline[j], outline[k]].map((p) =>
          point(side, p),
        );
        paintedFace(points, bands, [side, 0, 0]);
      }
    }
    outline.forEach((a, i) => {
      const b = outline[(i + 1) % outline.length];
      const out: V3 = [0, -(b[0] - a[0]) * flip, (b[1] - a[1]) * flip];
      face(
        [point(-1, a), point(1, a), point(1, b), point(-1, b)],
        edgeColor(a, b),
        out,
      );
    });
  };

  /**
   * Solide de révolution autour de X ou Z. `profile` liste des couples [distance sur l'axe, rayon] :
   * en le parcourant, l'extérieur est à gauche de (distance, rayon). `direction` retourne l'axe,
   * `colors[i]` peint le segment entre `profile[i]` et `profile[i + 1]`.
   */
  const lathe = (
    axis: "x" | "z",
    center: V3,
    direction: number,
    profile: readonly P2[],
    segmentColors: readonly Rgb[],
    sides: number,
  ): void => {
    const at = (distance: number, radius: number, angle: number): V3 => {
      const u = radius * Math.cos(angle);
      const v = radius * Math.sin(angle);
      const d = distance * direction;
      return axis === "x"
        ? [center[0] + d, center[1] + u, center[2] + v]
        : [center[0] + u, center[1] + v, center[2] + d];
    };
    segmentColors.forEach((color, i) => {
      const [d0, r0] = profile[i];
      const [d1, r1] = profile[i + 1];
      const axial = -(r1 - r0) * direction;
      const radial = d1 - d0;
      for (let k = 0; k < sides; k++) {
        const a0 = (k / sides) * Math.PI * 2;
        const a1 = ((k + 1) / sides) * Math.PI * 2;
        const mid = (a0 + a1) / 2;
        const u = radial * Math.cos(mid);
        const v = radial * Math.sin(mid);
        const out: V3 = axis === "x" ? [axial, u, v] : [u, v, axial];
        face(
          [at(d0, r0, a0), at(d0, r0, a1), at(d1, r1, a1), at(d1, r1, a0)],
          color,
          out,
        );
      }
    });
  };

  const toGeometry = (): BufferGeometry => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(positions), 3),
    );
    geometry.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(colors), 3),
    );
    // Sans index, chaque triangle garde sa propre normale : facettes nettes sans shader particulier.
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  };

  return { face, paintedFace, box, extrude, lathe, toGeometry };
};
