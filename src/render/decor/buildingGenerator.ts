// Adapté du labo `decor-lab/buildings/generator.ts` (story 5.2) : murs mitoyens, mur sur rue et niveaux viennent du pipeline.
import type { Rgb } from "@/render/palette";
import {
  type Edge,
  type Point,
  type Vec3,
  edgeOf,
  fract,
  normalizeRing,
  pick,
  ringDefects,
  seedOf,
  signedArea,
  simpleRingIndices,
} from "./buildingMath";
import { type Buffers, pushBox, pushQuad, shade } from "./buildingMesh";
import {
  type RoofKind,
  type RoofParams,
  type RoofResult,
  buildRoof,
} from "./buildingRoofs";

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
  /** Mur sur rue, dans l'ordre du contour tel que donné ; `null` : le plus long mur non mitoyen */
  street: number | null;
  /** Murs mitoyens, dans l'ordre du contour tel que donné ; `null` : aucun */
  party: boolean[] | null;
  /** Niveaux, rez-de-chaussée compris ; `null` : déduits de la hauteur */
  floors: number | null;
  /** Hangar ouvert : poteaux à la place des murs */
  open: Rgb | null;
  /**
   * Altitude du sol rendu (`track.groundAt`) : seuils, vitrines et rez-de-chaussée s'y posent au pied de chaque mur.
   * `null` : sol inconnu, rangs comptés depuis l'égout.
   */
  groundAt: GroundAt | null;
}

export type GroundAt = (x: number, z: number) => number | null;

/** Plus petite hauteur d'une porte, sous l'égout moins 0,3 m : un seuil plus haut n'a plus de porte. */
const DOOR_MIN = 1.6;
const DOOR_EAVES_GAP = 0.3;

const OPENING_OFFSET = 0.04;
const lift = (p: Point, e: Edge, t: number, out: number, y: number): Vec3 => [
  p.x + e.ux * t + e.nx * out,
  y,
  p.z + e.uz * t + e.nz * out,
];

/** Rectangle plaqué sur un mur, de `t0` à `t1` le long de l'arête et de `y0` à `y1`, borné au mur. */
const pushPanel = (
  out: Buffers,
  e: Edge,
  t0: number,
  t1: number,
  y0: number,
  y1: number,
  offset: number,
  color: Rgb,
): void => {
  // Jamais au-delà des angles : un panneau qui dépasse flotte dans le vide.
  const a = Math.max(0, t0);
  const b = Math.min(e.length, t1);
  if (b - a < 0.05 || y1 - y0 < 0.05) return;
  pushQuad(
    out,
    [
      lift(e.a, e, a, offset, y0),
      lift(e.a, e, b, offset, y0),
      lift(e.a, e, b, offset, y1),
      lift(e.a, e, a, offset, y1),
    ],
    [e.nx, 0, e.nz],
    color,
  );
};

/**
 * Panneaux d'au plus `pane` de large, séparés par des trumeaux de `pier`, centrés sur le mur avec au moins
 * `margin` à chaque bout. Jamais une bande continue, quelle que soit la longueur du mur.
 */
const spans = (
  length: number,
  margin: number,
  pane: number,
  pier: number,
): [number, number][] => {
  const usable = length - 2 * margin;
  if (usable < 0.8) return [];
  const count = Math.max(1, Math.floor((usable + pier) / (pane + pier)));
  const width = Math.min(pane, usable);
  const total = count * width + (count - 1) * pier;
  const start = (length - total) / 2;
  return Array.from({ length: count }, (_, i): [number, number] => {
    const t0 = start + i * (width + pier);
    return [t0, t0 + width];
  });
};

/** Devanture d'au plus 12 m, centrée sur le mur sur rue, en vitrages de 2,4 m séparés de trumeaux de 0,6 m */
const SHOP_MAX_FRONT = 12;
const SHOP_PANE = 2.4;
const SHOP_PIER = 0.6;
/** Bandeau d'activité sans fenêtre de référence : vitrages de 3,6 m, trumeaux de 1,2 m */
const RIBBON_PANE = 3.6;
const RIBBON_PIER = 1.2;

/** Zone d'un mur, le long de l'arête et en hauteur */
interface Rect {
  t0: number;
  t1: number;
  y0: number;
  y1: number;
}

const overlaps = (
  r: Rect | null,
  t0: number,
  t1: number,
  y0: number,
  y1: number,
): boolean => r !== null && t0 < r.t1 && t1 > r.t0 && y0 < r.y1 && y1 > r.y0;

interface Context {
  out: Buffers;
  spec: BuildingSpec;
  lod: Lod;
  ring: Point[];
  eaves: number;
  seed: number;
  party: boolean[];
  /** Mur sur rue dans l'ordre du contour normalisé */
  street: number | null;
}

/**
 * Sol au point `t` du mur `e`, jamais sous le pied ni à moins d'une porte de l'égout. Sans sol connu : `fallback`.
 */
const groundOn = (
  ctx: Context,
  e: Edge,
  t: number,
  fallback: number,
): number => {
  const y = ctx.spec.groundAt?.(e.a.x + e.ux * t, e.a.z + e.uz * t) ?? null;
  const cap = ctx.eaves - DOOR_EAVES_GAP - DOOR_MIN;
  return Math.max(ctx.spec.base, Math.min(y ?? fallback, cap));
};

/** Milieux des travées d'un mur : une fenêtre par travée. */
const bayCenters = (length: number, bay: number, width: number): number[] => {
  let bays = Math.floor(length / bay);
  if (bays === 0 && length >= width + 1) bays = 1;
  return Array.from({ length: bays }, (_, b) => ((b + 0.5) * length) / bays);
};

const pushOpenings = (ctx: Context, style: OpeningStyle): void => {
  const { out, spec, lod, ring, eaves, seed, party } = ctx;
  const edges = ring.map((_, k) => edgeOf(ring, k));
  // Rue : le mur donné par le pipeline, sinon le plus long mur non mitoyen. Porte et vitrine y vont.
  let street = ctx.street !== null && !party[ctx.street] ? ctx.street : -1;
  if (street < 0)
    edges.forEach((e, k) => {
      if (!party[k] && (street < 0 || e.length > edges[street].length))
        street = k;
    });
  const byHeight = Math.max(
    1,
    Math.floor((spec.height + 0.4) / style.floorHeight),
  );
  const floors = Math.min(spec.floors ?? byHeight, byHeight);
  // Sol inconnu : rangs comptés depuis l'égout, la partie enterrée par la pente ne reçoit pas de fenêtres.
  const fallback =
    spec.floors !== null
      ? Math.max(spec.base, eaves - floors * style.floorHeight - 0.2)
      : spec.base;
  const shutters = style.shutters
    ? pick(style.shutters, fract(seed * 5.7))
    : null;
  const ribbon =
    style.ribbon === "always" || (style.ribbon === "far" && lod === "far");
  const win = style.window;
  const streetEdge = street >= 0 ? edges[street] : null;

  // Vitrine : vitrages bornés séparés de trumeaux sur une devanture d'au plus 12 m, porte d'entrée au milieu.
  // Devanture calée sur le sol au milieu du mur sur rue ; chaque vitrage pose ensuite son pied sur le sol à son droit.
  const frontGround = streetEdge
    ? groundOn(ctx, streetEdge, streetEdge.length / 2, fallback)
    : fallback;
  const shopTop = Math.min(frontGround + 2.6, eaves - 0.9);
  const shop =
    style.shop &&
    lod === "near" &&
    streetEdge &&
    streetEdge.length >= 3 &&
    shopTop - frontGround > 1.8
      ? style.shop
      : null;
  let front: Rect | null = null;
  if (shop && streetEdge) {
    const width = Math.min(SHOP_MAX_FRONT, streetEdge.length - 1.2);
    const t0 = (streetEdge.length - width) / 2;
    front = { t0, t1: t0 + width, y0: spec.base, y1: shopTop + 0.7 };
    const panes = spans(width, 0, SHOP_PANE, SHOP_PIER);
    const entry = panes.length >= 2 ? Math.floor(panes.length / 2) : -1;
    const entryColor = style.door?.color ?? shop.glass;
    panes.forEach(([a, b], i) => {
      const mid = t0 + (a + b) / 2;
      const sill = groundOn(ctx, streetEdge, mid, fallback);
      if (i === entry) {
        // Porte d'entrée, plus étroite que le vitrage qu'elle remplace.
        pushPanel(
          out,
          streetEdge,
          mid - 0.6,
          mid + 0.6,
          sill,
          // Sur un mur en pente, la porte garde sa hauteur quitte à dépasser la vitrine, jamais l'égout.
          Math.min(Math.max(shopTop, sill + DOOR_MIN), eaves - DOOR_EAVES_GAP),
          OPENING_OFFSET,
          entryColor,
        );
        return;
      }
      pushPanel(
        out,
        streetEdge,
        t0 + a,
        t0 + b,
        sill + 0.4,
        shopTop,
        OPENING_OFFSET,
        shop.glass,
      );
    });
    // Enseigne au-dessus de la devanture seulement.
    pushPanel(
      out,
      streetEdge,
      t0,
      t0 + width,
      shopTop + 0.15,
      shopTop + 0.6,
      OPENING_OFFSET,
      shop.sign,
    );
  }

  // Porte au milieu du mur sur rue, en proche seulement, bornée au mur en largeur et sous l'égout.
  let door: Rect | null = null;
  if (style.door && streetEdge && lod === "near" && !shop) {
    const e = streetEdge;
    const width = Math.min(style.door.width, e.length - 0.8);
    const bays = Math.max(1, Math.floor(e.length / style.bay));
    const center = ((Math.floor(bays / 2) + 0.5) * e.length) / bays;
    const t = Math.min(
      Math.max(center, width / 2 + 0.4),
      e.length - width / 2 - 0.4,
    );
    // Seuil sur le sol au droit de la porte, borné entre le pied et l'égout.
    const sill = groundOn(ctx, e, t, fallback);
    const top = Math.min(sill + style.door.height, eaves - DOOR_EAVES_GAP);
    if (width >= 0.7 && top - sill >= DOOR_MIN) {
      door = { t0: t - width / 2, t1: t + width / 2, y0: sill, y1: top };
      pushPanel(
        out,
        e,
        door.t0,
        door.t1,
        sill,
        top,
        OPENING_OFFSET,
        style.door.color,
      );
    }
  }

  edges.forEach((e, k) => {
    if (party[k] || e.length < 2) return;
    const onStreet = k === street;
    // Rez-de-chaussée sur le sol au milieu du mur, étages au-dessus, autant que la hauteur visible en tient.
    const ground = groundOn(ctx, e, e.length / 2, fallback);
    const visible = Math.max(
      1,
      Math.floor((eaves - ground + 0.4) / style.floorHeight),
    );
    for (let floor = 0; floor < Math.min(floors, visible); floor++) {
      const y0 = ground + floor * style.floorHeight + (win?.sill ?? 1);
      const y1 = y0 + (win?.height ?? 1);
      if (y1 > eaves - 0.25) continue;
      const blocked = (t0: number, t1: number): boolean =>
        onStreet &&
        (overlaps(door, t0, t1, y0, y1) || overlaps(front, t0, t1, y0, y1));
      if (ribbon) {
        // Fenêtres groupées par deux de loin, vitrages bornés pour l'activité : jamais une bande continue.
        const pane = win ? style.bay + win.width : RIBBON_PANE;
        const pier = win ? Math.max(0.8, style.bay - win.width) : RIBBON_PIER;
        for (const [a, b] of spans(e.length, 0.8, pane, pier))
          if (!blocked(a, b))
            pushPanel(out, e, a, b, y0, y1, OPENING_OFFSET, style.glass);
        continue;
      }
      if (!win || lod === "far") continue;
      const half = win.width / 2;
      for (const t of bayCenters(e.length, style.bay, win.width)) {
        const reach = shutters ? win.width : half + 0.12;
        if (blocked(t - reach, t + reach)) continue;
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
    // Soubassement du pied jusqu'au-dessus du sol au milieu du mur, comme le rez-de-chaussée : jamais sur une fenêtre.
    if (spec.plinth && !party[k])
      pushPanel(
        out,
        e,
        0,
        e.length,
        spec.base,
        groundOn(ctx, e, e.length / 2, spec.base) + spec.plinth.height,
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

/**
 * Mur `k` du contour donné, renuméroté dans le contour normalisé. `normalizeRing` ne fusionne rien sur une emprise
 * du pipeline (sommets à plus de 0,5 m) : il ne fait que retourner le sens, et le mur k devient le mur n - 2 - k.
 */
const remapEdge = (k: number, n: number, reversed: boolean): number =>
  reversed ? (((n - 2 - k) % n) + n) % n : k;

/** Ajoute un bâtiment aux tampons. */
export const buildBuilding = (
  out: Buffers,
  spec: BuildingSpec,
  lod: Lod,
): BuiltBuilding | null => {
  const source = normalizeRing(spec.footprint);
  if (source.length < 3) return null;
  const n = source.length;
  // Renumérotation sûre seulement si aucun sommet n'a été fusionné.
  const sameCount = n === spec.footprint.length;
  const reversed =
    sameCount &&
    (source[0].x !== spec.footprint[0].x ||
      source[0].z !== spec.footprint[0].z);
  const sourceParty = source.map(() => false);
  if (sameCount && spec.party)
    spec.party.forEach((isParty, k) => {
      if (isParty) sourceParty[remapEdge(k, n, reversed)] = true;
    });
  const sourceStreet =
    sameCount && spec.street !== null && spec.street < n
      ? remapEdge(spec.street, n, reversed)
      : null;
  // Une emprise qui se recoupe donnerait des murs retournés et un toit troué : on la rend simple d'abord.
  const kept =
    ringDefects(source) > 0
      ? simpleRingIndices(source)
      : source.map((_, i) => i);
  const ring = kept.map((i) => source[i]);
  if (ring.length < 3 || Math.abs(signedArea(ring)) < 0.05) return null;
  /** Mur d'origine porté par l'arête k, `-1` si elle remplace plusieurs murs. */
  const origin = kept.map((p, k) => {
    const q = kept[(k + 1) % kept.length];
    return q === (p + 1) % n ? p : p === (q + 1) % n ? q : -1;
  });
  const party = origin.map((o) => o >= 0 && sourceParty[o]);
  const streetIndex = sourceStreet === null ? -1 : origin.indexOf(sourceStreet);
  const street = streetIndex >= 0 ? streetIndex : null;
  const seed = seedOf(ring);
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
  const ctx: Context = { out, spec, lod, ring, eaves, seed, party, street };
  const result = buildRoof(out, ring, eaves, roofParams);
  if (spec.open) pushPosts(ctx, result, spec.open);
  else {
    pushWalls(ctx, result, wall);
    if (spec.openings) pushOpenings(ctx, spec.openings);
  }
  if (lod === "near") pushChimneys(ctx, result);
  return { roof: result.kind, result };
};
