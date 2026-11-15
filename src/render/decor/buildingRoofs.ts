// Copié du labo `decor-lab/buildings/roofs.ts` (story 5.2).
import type { Rgb } from "@/render/palette";
import {
  type Frame,
  type Point,
  type Vec3,
  clipPolygon,
  edgeOf,
  frameAcross,
  inside,
  isConvex,
  obbFrame,
  offsetRing,
  ringDefects,
  signedArea,
  triangulate,
} from "./buildingMath";
import { type Buffers, DOWN, UP, pushQuad, pushTriangle, shade } from "./buildingMesh";

// Toits construits depuis n'importe quelle emprise, avec repli : croupe → pignon → plat.

export type RoofKind = "gable" | "hip" | "flat" | "parapet" | "shed";

export interface RoofParams {
  kind: RoofKind;
  /** Pente en degrés */
  pitch: number;
  /** Hauteur maximale du toit au-dessus de l'égout : un hangar de 30 m ne porte pas 10 m de toit */
  maxRise: number;
  /** Débord au-delà des murs, en mètres */
  overhang: number;
  color: Rgb;
  /** Sous-face visible du débord ; `null` : rien dessous */
  underside: Rgb | null;
  /** Tuiles faîtières, plus sombres ; seulement sur un pignon */
  ridgeCap: Rgb | null;
  /** Acrotère d'un toit plat */
  parapet: { height: number; thickness: number; color: Rgb } | null;
  /** Direction du travers imposée (mitoyenneté) : le faîtage lui est perpendiculaire */
  across: Point | null;
  /** Arêtes sans débord (murs mitoyens), dans l'ordre du contour normalisé */
  sealed: boolean[] | null;
}

/** Débord de chaque arête : nul sur les murs mitoyens. */
const overhangs = (ring: Point[], params: RoofParams): number[] =>
  ring.map((_, k) => (params.sealed?.[k] ? 0 : params.overhang));

/** Sommet du haut des murs */
export interface WallVertex extends Point {
  top: number;
}

export interface RoofResult {
  /** Toit réellement construit, après repli */
  kind: RoofKind;
  wall: WallVertex[];
  heightAt: (p: Point) => number;
  /** Ligne de faîtage pour poser cheminées et clochetons */
  ridge: [Point, Point] | null;
  frame: Frame;
}

const SNAP = 1e-6;
const deg = (value: number): number => (value * Math.PI) / 180;

const pushPolygon = (
  out: Buffers,
  ring: Point[],
  height: (p: Point) => number,
  color: Rgb,
  underside: Rgb | null,
): void => {
  for (const [a, b, c] of triangulate(ring)) {
    const v = [a, b, c].map(
      (k): Vec3 => [ring[k].x, height(ring[k]), ring[k].z],
    );
    pushTriangle(
      out,
      { p: v[0], c: color },
      { p: v[1], c: color },
      { p: v[2], c: color },
      UP,
    );
    if (underside)
      pushTriangle(
        out,
        { p: v[0], c: underside },
        { p: v[1], c: underside },
        { p: v[2], c: underside },
        DOWN,
      );
  }
};

interface Augmented extends Point {
  s: number;
}

/** Contour enrichi des points où il croise le faîtage (s = 0) ; `null` s'il ne le croise pas exactement deux fois. */
const augment = (
  ring: Point[],
  across: (p: Point) => number,
): { points: Augmented[]; ridge: [number, number] } | null => {
  const points: Augmented[] = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const sa = across(a);
    const sb = across(b);
    points.push({ x: a.x, z: a.z, s: sa });
    if (sa * sb < 0) {
      const t = sa / (sa - sb);
      points.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, s: 0 });
    }
  });
  const ridge = points.flatMap((p, i) => (p.s === 0 ? [i] : []));
  if (ridge.length !== 2) return null;
  return { points, ridge: [ridge[0], ridge[1]] };
};

const acrossOf =
  (frame: Frame) =>
  (p: Point): number => {
    const s = p.x * frame.vx + p.z * frame.vz - frame.vMid;
    return Math.abs(s) < SNAP ? 0 : s;
  };

const frameFor = (ring: Point[], params: RoofParams): Frame =>
  params.across
    ? frameAcross(ring, params.across.x, params.across.z)
    : obbFrame(ring);

/** Deux pans plans de part et d'autre du faîtage. Murs pignons jusqu'au faîtage. */
const gable = (
  out: Buffers,
  ring: Point[],
  eaves: number,
  params: RoofParams,
): RoofResult | null => {
  const frame = frameFor(ring, params);
  const half = frame.halfV;
  if (half < 0.5) return null;
  const across = acrossOf(frame);
  const wall = augment(ring, across);
  if (!wall) return null;
  const [i, j] = wall.ridge;
  const mid = {
    x: (wall.points[i].x + wall.points[j].x) / 2,
    z: (wall.points[i].z + wall.points[j].z) / 2,
  };
  if (!inside(mid, ring)) return null;
  const rise = Math.min(params.maxRise, Math.tan(deg(params.pitch)) * half);
  const slope = rise / half;
  const height = (s: number): number => eaves + rise - slope * Math.abs(s);
  // Le débord se calcule sur le contour décalé ; s'il casse la forme, on s'en passe.
  const roof =
    (params.overhang > 0 &&
      augment(offsetRing(ring, overhangs(ring, params)), across)) ||
    wall;
  const [ri, rj] = roof.ridge;
  const halves = [
    roof.points.slice(ri, rj + 1),
    [...roof.points.slice(rj), ...roof.points.slice(0, ri + 1)],
  ];
  if (halves.some((h) => h.length < 3)) return null;
  for (const h of halves)
    pushPolygon(
      out,
      h,
      (p) => height(across(p)),
      params.color,
      params.underside,
    );
  const r0 = roof.points[ri];
  const r1 = roof.points[rj];
  if (params.ridgeCap) {
    const w = 0.22;
    const top = height(0) + 0.05;
    for (const side of [1, -1]) {
      const dx = frame.vx * w * side;
      const dz = frame.vz * w * side;
      const low = height(w) + 0.05;
      pushQuad(
        out,
        [
          [r0.x, top, r0.z],
          [r1.x, top, r1.z],
          [r1.x + dx, low, r1.z + dz],
          [r0.x + dx, low, r0.z + dz],
        ],
        UP,
        params.ridgeCap,
      );
    }
  }
  return {
    kind: "gable",
    wall: wall.points.map((p) => ({ x: p.x, z: p.z, top: height(p.s) })),
    heightAt: (p) => height(across(p)),
    ridge: [wall.points[i], wall.points[j]],
    frame,
  };
};

/**
 * Croupe : chaque pan monte depuis son mur, la hauteur est la distance au mur le plus proche.
 * Exact pour une emprise convexe (squelette droit) ; plafonné en terrasse au-delà de `maxRise`.
 */
const hip = (
  out: Buffers,
  ring: Point[],
  eaves: number,
  params: RoofParams,
): RoofResult | null => {
  if (!isConvex(ring)) return null;
  const offset = offsetRing(ring, params.overhang);
  // Débord uniforme seulement : une croupe ne s'adosse pas à un mur mitoyen.
  const uniform = !params.sealed?.some(Boolean);
  const d =
    uniform && params.overhang > 0 && isConvex(offset) ? params.overhang : 0;
  const outer = d > 0 ? offset : ring;
  const tan = Math.tan(deg(params.pitch));
  const base = eaves - tan * d;
  const cap = d + params.maxRise / tan;
  const edges = outer.map((_, k) => edgeOf(outer, k));
  const dist = edges.map(
    (e) =>
      (p: Point): number =>
        -((p.x - e.a.x) * e.nx + (p.z - e.a.z) * e.nz),
  );
  const minDist = (p: Point): number => Math.min(cap, ...dist.map((f) => f(p)));
  edges.forEach((_, k) => {
    let face = outer;
    dist.forEach((other, m) => {
      if (m !== k && face.length >= 3)
        face = clipPolygon(face, (p) => dist[k](p) - other(p));
    });
    if (face.length >= 3) face = clipPolygon(face, (p) => dist[k](p) - cap);
    if (face.length < 3 || Math.abs(signedArea(face)) < 1e-4) return;
    pushPolygon(
      out,
      face,
      (p) => base + tan * dist[k](p),
      params.color,
      params.underside,
    );
  });
  // Terrasse au sommet quand la croupe est plafonnée.
  let plateau = outer;
  for (const f of dist)
    if (plateau.length >= 3) plateau = clipPolygon(plateau, (p) => cap - f(p));
  if (plateau.length >= 3 && Math.abs(signedArea(plateau)) > 1e-3)
    pushPolygon(out, plateau, () => base + tan * cap, params.color, null);
  const frame = obbFrame(ring);
  const length = Math.max(0, frame.halfU - frame.halfV);
  const at = (t: number): Point => ({
    x: frame.ux * (frame.uMid + t) + frame.vx * frame.vMid,
    z: frame.uz * (frame.uMid + t) + frame.vz * frame.vMid,
  });
  return {
    kind: "hip",
    wall: ring.map((p) => ({ x: p.x, z: p.z, top: eaves })),
    heightAt: (p) => base + tan * minDist(p),
    ridge: [at(-length), at(length)],
    frame,
  };
};

/** Monopente : un seul plan, possible sur toute emprise, même concave. */
const shed = (
  out: Buffers,
  ring: Point[],
  eaves: number,
  params: RoofParams,
): RoofResult => {
  const frame = frameFor(ring, params);
  const across = acrossOf(frame);
  const width = Math.max(frame.halfV * 2, 0.1);
  const rise = Math.min(params.maxRise, Math.tan(deg(params.pitch)) * width);
  const height = (p: Point): number =>
    eaves + (rise * (across(p) + frame.halfV)) / width;
  const offset = offsetRing(ring, overhangs(ring, params));
  const roof =
    params.overhang > 0 && signedArea(offset) > signedArea(ring)
      ? offset
      : ring;
  pushPolygon(out, roof, height, params.color, params.underside);
  return {
    kind: "shed",
    wall: ring.map((p) => ({ x: p.x, z: p.z, top: height(p) })),
    heightAt: height,
    ridge: null,
    frame,
  };
};

const flat = (
  out: Buffers,
  ring: Point[],
  eaves: number,
  params: RoofParams,
): RoofResult => {
  pushPolygon(out, ring, () => eaves, params.color, null);
  return {
    kind: "flat",
    wall: ring.map((p) => ({ x: p.x, z: p.z, top: eaves })),
    heightAt: () => eaves,
    ridge: null,
    frame: obbFrame(ring),
  };
};

/**
 * Contour intérieur de l'acrotère, ou `null` s'il ne garde pas la forme de l'emprise : arête retournée,
 * contour qui se recoupe (décalage croisé dans un angle rentrant ou une partie étroite) ou sommet hors de l'emprise.
 */
const innerRing = (ring: Point[], thickness: number): Point[] | null => {
  const inner = offsetRing(ring, -thickness);
  const sameShape = inner.every((_, k) => {
    const a = edgeOf(ring, k);
    const b = edgeOf(inner, k);
    return a.ux * b.ux + a.uz * b.uz > 0.5;
  });
  if (!sameShape || signedArea(inner) <= 0) return null;
  if (ringDefects(inner) > 0 || !inner.every((p) => inside(p, ring)))
    return null;
  return inner;
};

/** Toit plat ceint d'un acrotère : couronnement et faces intérieures. `null` si l'emprise est trop fine. */
const parapet = (
  out: Buffers,
  ring: Point[],
  eaves: number,
  params: RoofParams,
): RoofResult | null => {
  const wallTop = params.parapet;
  if (!wallTop) return null;
  // Acrotère épais d'abord, puis aminci : une emprise étroite ou découpée garde son couronnement.
  const inner =
    innerRing(ring, wallTop.thickness) ?? innerRing(ring, wallTop.thickness / 2);
  if (!inner) return null;
  const top = eaves + wallTop.height;
  const innerColor = shade(wallTop.color, 0.82);
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length];
    const ia = inner[k];
    const ib = inner[(k + 1) % inner.length];
    const e = edgeOf(ring, k);
    pushQuad(
      out,
      [
        [a.x, top, a.z],
        [b.x, top, b.z],
        [ib.x, top, ib.z],
        [ia.x, top, ia.z],
      ],
      UP,
      wallTop.color,
    );
    pushQuad(
      out,
      [
        [ia.x, eaves, ia.z],
        [ib.x, eaves, ib.z],
        [ib.x, top, ib.z],
        [ia.x, top, ia.z],
      ],
      [-e.nx, 0, -e.nz],
      innerColor,
    );
  });
  pushPolygon(out, inner, () => eaves, params.color, null);
  return {
    kind: "parapet",
    wall: ring.map((p) => ({ x: p.x, z: p.z, top })),
    heightAt: () => eaves,
    ridge: null,
    frame: obbFrame(ring),
  };
};

/** Toit demandé, ou le meilleur repli possible : jamais d'échec, au pire un toit plat. */
export const buildRoof = (
  out: Buffers,
  ring: Point[],
  eaves: number,
  params: RoofParams,
): RoofResult => {
  switch (params.kind) {
    case "hip":
      return (
        hip(out, ring, eaves, params) ??
        gable(out, ring, eaves, params) ??
        flat(out, ring, eaves, params)
      );
    case "gable":
      return gable(out, ring, eaves, params) ?? flat(out, ring, eaves, params);
    case "shed":
      return shed(out, ring, eaves, params);
    case "parapet":
      // Acrotère impossible : toit plat à la hauteur de son couronnement, comme la version lointaine.
      return (
        parapet(out, ring, eaves, params) ??
        flat(out, ring, eaves + (params.parapet?.height ?? 0), params)
      );
    case "flat":
      return flat(out, ring, eaves, params);
  }
};
