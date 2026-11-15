import type { Rgb } from "@/render/palette";
import {
  type Edge,
  type Point,
  type Vec3,
  edgeOf,
  fract,
  isPartyEdge,
  normalizeRing,
  pick,
  seedOf,
} from "./math";
import { type Buffers, pushBox, pushQuad, shade } from "./mesh";
import {
  type RoofKind,
  type RoofParams,
  type RoofResult,
  buildRoof,
} from "./roofs";

// Un bâtiment complet depuis une emprise + hauteur + style : murs, toit, ouvertures, détails.

export type Lod = "near" | "far";

export interface OpeningStyle {
  /** Hauteur d'un étage */
  floorHeight: number;
  /** Largeur d'une travée : une fenêtre par travée */
  bay: number;
  /** Fenêtre ; `null` : aucune (grange, hangar) */
  window: { width: number; height: number; sill: number } | null;
  glass: Rgb;
  /** Encadrement clair autour des fenêtres */
  frame: Rgb | null;
  /** Volets battants, une couleur tirée par bâtiment */
  shutters: Rgb[] | null;
  door: { width: number; height: number; color: Rgb } | null;
  /** Rez-de-chaussée en vitrine sur la rue, avec enseigne */
  shop: { glass: Rgb; sign: Rgb } | null;
  /** Fenêtres en bandeau continu par étage (activité, immeuble lointain) */
  ribbon: "never" | "always" | "far";
}

export interface BuildingSpec {
  footprint: Point[];
  base: number;
  /** Hauteur à l'égout au-dessus de `base` */
  height: number;
  /** Teintes de façade possibles, une tirée par bâtiment */
  walls: Rgb[];
  /** Soubassement plus sombre (proche seulement) */
  plinth: { height: number; color: Rgb } | null;
  /** Chaînages d'angle (pierre de taille) */
  corners: Rgb | null;
  roof: RoofParams;
  openings: OpeningStyle | null;
  /** Cheminées, en fraction de la longueur du faîtage */
  chimneys: number[];
  chimneyColor: Rgb;
  /** Direction de la rue vue du bâtiment ; `null` : le plus long mur non mitoyen */
  street: Point | null;
  /** Hangar ouvert : poteaux à la place des murs */
  open: Rgb | null;
}

const OPENING_OFFSET = 0.04;
const lift = (p: Point, e: Edge, t: number, out: number, y: number): Vec3 => [
  p.x + e.ux * t + e.nx * out,
  y,
  p.z + e.uz * t + e.nz * out,
];

/** Rectangle plaqué sur un mur, de `t0` à `t1` le long de l'arête et de `y0` à `y1`. */
const pushPanel = (
  out: Buffers,
  e: Edge,
  t0: number,
  t1: number,
  y0: number,
  y1: number,
  offset: number,
  color: Rgb,
): void =>
  pushQuad(
    out,
    [
      lift(e.a, e, t0, offset, y0),
      lift(e.a, e, t1, offset, y0),
      lift(e.a, e, t1, offset, y1),
      lift(e.a, e, t0, offset, y1),
    ],
    [e.nx, 0, e.nz],
    color,
  );

interface Context {
  out: Buffers;
  spec: BuildingSpec;
  lod: Lod;
  ring: Point[];
  eaves: number;
  seed: number;
  party: boolean[];
}

const pushOpenings = (ctx: Context, style: OpeningStyle): void => {
  const { out, spec, lod, ring, eaves, seed, party } = ctx;
  const edges = ring.map((_, k) => edgeOf(ring, k));
  // Rue : le mur tourné vers `spec.street`, sinon le plus long mur non mitoyen. Porte et vitrine y vont.
  const facing = (e: Edge): number =>
    spec.street ? e.nx * spec.street.x + e.nz * spec.street.z : e.length;
  let street = -1;
  edges.forEach((e, k) => {
    if (!party[k] && (street < 0 || facing(e) > facing(edges[street])))
      street = k;
  });
  const floors = Math.max(
    1,
    Math.floor((spec.height + 0.4) / style.floorHeight),
  );
  const shutters = style.shutters
    ? pick(style.shutters, fract(seed * 5.7))
    : null;
  const ribbon =
    style.ribbon === "always" || (style.ribbon === "far" && lod === "far");
  const win = style.window;
  edges.forEach((e, k) => {
    if (party[k] || e.length < 2) return;
    for (let floor = 0; floor < floors; floor++) {
      const y0 = spec.base + floor * style.floorHeight + (win?.sill ?? 1);
      const y1 = y0 + (win?.height ?? 1);
      if (y1 > eaves - 0.25) continue;
      if (floor === 0 && k === street && style.shop && lod === "near") {
        pushPanel(
          out,
          e,
          0.6,
          e.length - 0.6,
          spec.base + 0.3,
          spec.base + 2.6,
          OPENING_OFFSET,
          style.shop.glass,
        );
        pushPanel(
          out,
          e,
          0.4,
          e.length - 0.4,
          spec.base + 2.75,
          spec.base + 3.2,
          OPENING_OFFSET,
          style.shop.sign,
        );
        continue;
      }
      if (ribbon) {
        if (e.length > 3)
          pushPanel(
            out,
            e,
            0.8,
            e.length - 0.8,
            y0,
            y1,
            OPENING_OFFSET,
            style.glass,
          );
        continue;
      }
      if (!win || lod === "far") continue;
      let bays = Math.floor(e.length / style.bay);
      if (bays === 0 && e.length >= win.width + 1) bays = 1;
      const doorBay =
        floor === 0 && k === street && style.door ? Math.floor(bays / 2) : -1;
      for (let b = 0; b < bays; b++) {
        const t = ((b + 0.5) * e.length) / bays;
        if (b === doorBay) continue;
        const half = win.width / 2;
        if (style.frame)
          pushPanel(
            out,
            e,
            t - half - 0.12,
            t + half + 0.12,
            y0 - 0.12,
            y1 + 0.12,
            0.03,
            style.frame,
          );
        pushPanel(
          out,
          e,
          t - half,
          t + half,
          y0,
          y1,
          OPENING_OFFSET,
          style.glass,
        );
        if (shutters) {
          pushPanel(out, e, t - win.width, t - half, y0, y1, 0.05, shutters);
          pushPanel(out, e, t + half, t + win.width, y0, y1, 0.05, shutters);
        }
      }
    }
  });
  // Porte au milieu du mur sur rue, en proche seulement.
  const door = style.door;
  if (door && street >= 0 && lod === "near" && !style.shop) {
    const e = edges[street];
    const bays = Math.max(1, Math.floor(e.length / style.bay));
    const t = ((Math.floor(bays / 2) + 0.5) * e.length) / bays;
    pushPanel(
      out,
      e,
      t - door.width / 2,
      t + door.width / 2,
      spec.base,
      spec.base + door.height,
      OPENING_OFFSET,
      door.color,
    );
  }
};

const pushWalls = (ctx: Context, roof: RoofResult, wall: Rgb): void => {
  const { out, spec, lod, ring, party } = ctx;
  // Pied plus sombre par la couleur des sommets : un soubassement sans un seul triangle de plus.
  const low = shade(wall, lod === "far" ? 0.74 : 0.86);
  const verts = roof.wall;
  verts.forEach((a, k) => {
    const b = verts[(k + 1) % verts.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-3) return;
    const nx = (b.z - a.z) / length;
    const nz = -(b.x - a.x) / length;
    pushQuad(
      out,
      [
        [a.x, spec.base, a.z],
        [b.x, spec.base, b.z],
        [b.x, b.top, b.z],
        [a.x, a.top, a.z],
      ],
      [nx, 0, nz],
      [low, low, wall, wall],
    );
  });
  if (lod === "far") return;
  ring.forEach((_, k) => {
    const e = edgeOf(ring, k);
    if (spec.plinth && !party[k])
      pushPanel(
        out,
        e,
        0,
        e.length,
        spec.base,
        spec.base + spec.plinth.height,
        0.03,
        spec.plinth.color,
      );
    if (spec.corners) {
      // Chaînage de part et d'autre de l'angle de départ de l'arête et du suivant.
      const y0 = spec.base + (spec.plinth?.height ?? 0);
      const top = ctx.eaves - 0.1;
      const w = Math.min(0.5, e.length / 4);
      if (!party[k]) {
        pushPanel(out, e, 0, w, y0, top, 0.025, spec.corners);
        pushPanel(out, e, e.length - w, e.length, y0, top, 0.025, spec.corners);
      }
    }
  });
};

const pushPosts = (ctx: Context, roof: RoofResult, color: Rgb): void => {
  const { out, spec, lod, ring } = ctx;
  ring.forEach((_, k) => {
    const e = edgeOf(ring, k);
    // Poteau d'angle, puis tous les ~5 m en proche.
    const count = lod === "near" ? Math.max(1, Math.round(e.length / 5)) : 1;
    for (let i = 0; i < count; i++) {
      const t = (i * e.length) / count;
      const inset = 0.2;
      const p = {
        x: e.a.x + e.ux * t - e.nx * inset,
        z: e.a.z + e.uz * t - e.nz * inset,
      };
      pushBox(out, {
        cx: p.x,
        cz: p.z,
        ux: e.ux,
        uz: e.uz,
        halfU: 0.13,
        halfV: 0.13,
        y0: spec.base,
        y1: roof.heightAt(p),
        color,
        top: false,
      });
    }
  });
};

const pushChimneys = (ctx: Context, roof: RoofResult): void => {
  const { out, spec } = ctx;
  if (!roof.ridge) return;
  const [r0, r1] = roof.ridge;
  const length = Math.hypot(r1.x - r0.x, r1.z - r0.z);
  const ux = length > 1e-3 ? (r1.x - r0.x) / length : roof.frame.ux;
  const uz = length > 1e-3 ? (r1.z - r0.z) / length : roof.frame.uz;
  for (const f of spec.chimneys) {
    const p = { x: r0.x + (r1.x - r0.x) * f, z: r0.z + (r1.z - r0.z) * f };
    const top = roof.heightAt(p);
    pushBox(out, {
      cx: p.x,
      cz: p.z,
      ux,
      uz,
      halfU: 0.32,
      halfV: 0.28,
      y0: top - 0.9,
      y1: top + 0.9,
      color: spec.chimneyColor,
      top: true,
    });
  }
};

export interface BuiltBuilding {
  roof: RoofKind;
  result: RoofResult;
}

/** Ajoute un bâtiment aux tampons. `neighbors` : emprises voisines, pour repérer les murs mitoyens. */
export const buildBuilding = (
  out: Buffers,
  spec: BuildingSpec,
  lod: Lod,
  neighbors: Point[][] = [],
): BuiltBuilding | null => {
  const ring = normalizeRing(spec.footprint);
  if (ring.length < 3) return null;
  const seed = seedOf(ring);
  const party = ring.map((a, k) =>
    isPartyEdge(a, ring[(k + 1) % ring.length], neighbors),
  );
  const wall = shade(pick(spec.walls, seed), 0.94 + 0.1 * fract(seed * 13.1));
  const firstParty = party.indexOf(true);
  // Mitoyen : faîtage parallèle à la rue, pignons sur les murs mitoyens.
  const across = firstParty >= 0 ? edgeOf(ring, firstParty) : null;
  const parapetFar = lod === "far" && spec.roof.kind === "parapet";
  const eaves =
    spec.base +
    spec.height +
    (parapetFar ? (spec.roof.parapet?.height ?? 0) : 0);
  const roofParams: RoofParams = {
    ...spec.roof,
    kind: parapetFar ? "flat" : spec.roof.kind,
    color: shade(spec.roof.color, 0.93 + 0.1 * fract(seed * 3.3)),
    overhang: lod === "far" ? 0 : spec.roof.overhang,
    // Un hangar ouvert se voit par-dessous, même de loin.
    underside: lod === "far" && !spec.open ? null : spec.roof.underside,
    ridgeCap: lod === "far" ? null : spec.roof.ridgeCap,
    across:
      spec.roof.across ?? (across ? { x: across.ux, z: across.uz } : null),
    sealed: party,
  };
  const ctx: Context = { out, spec, lod, ring, eaves, seed, party };
  const result = buildRoof(out, ring, eaves, roofParams);
  if (spec.open) pushPosts(ctx, result, spec.open);
  else {
    pushWalls(ctx, result, wall);
    if (spec.openings) pushOpenings(ctx, spec.openings);
  }
  if (lod === "near") pushChimneys(ctx, result);
  return { roof: result.kind, result };
};
