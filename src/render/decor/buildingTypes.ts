// Catalogue des typologies (story 5.2) : un `DecorBuilding` du pipeline devient un ou plusieurs volumes du générateur.
// Styles repris des variantes retenues dans le labo `decor-lab/buildings/typologies.ts`, sans rien en importer.
import { BUILDING_PALETTE, type Rgb } from "@/render/palette";
import type {
  DecorBuilding,
  DecorRoofKind,
  DecorRoofMaterial,
} from "@/sim/types";
import {
  type BuildingSpec,
  type GroundAt,
  type Lod,
  type OpeningStyle,
  buildBuilding,
} from "./buildingGenerator";
import {
  type Point,
  clipPolygon,
  fract,
  normalizeRing,
  obbFrame,
  seedOf,
  signedArea,
} from "./buildingMath";
import { type Buffers, pushBox } from "./buildingMesh";
import type { RoofParams } from "./buildingRoofs";

const { facade: FACADE, roof: ROOF, detail: DETAIL } = BUILDING_PALETTE;

/** Pente par couverture, en degrés : l'ardoise monte, la tuile canal reste basse */
const PITCH: Record<DecorRoofMaterial, number> = {
  slate: 45,
  tile: 40,
  canal: 30,
  metal: 18,
  glass: 25,
  stone: 30,
  membrane: 0,
};
/** Le faîtage suit la rue si le mur sur rue est à moins de 30° du grand axe */
const STREET_ALIGN_COS = Math.cos(Math.PI / 6);
/** Emprise presque carrée : le faîtage suit la rue quel que soit le grand axe */
const SQUARE_RATIO = 1.3;
/** Une chapelle de serre par tranche de cette largeur */
const GREENHOUSE_BAY = 8;
const GREENHOUSE_SINGLE_MAX_WIDTH = 12;

const roofColor = (material: DecorRoofMaterial, seed: number): Rgb => {
  switch (material) {
    // Tuile neuve ou vieillie, tirée par bâtiment.
    case "tile":
      return fract(seed * 7.3) < 0.6 ? ROOF.tile : ROOF.tileDark;
    case "canal":
      return ROOF.canal;
    case "slate":
      return ROOF.slate;
    case "metal":
      return fract(seed * 7.3) < 0.5 ? ROOF.metal : ROOF.metalDark;
    case "glass":
      return ROOF.glass;
    case "stone":
      return ROOF.stone;
    case "membrane":
      return ROOF.membrane;
  }
};

const ridgeCapOf = (material: DecorRoofMaterial): Rgb | null =>
  material === "tile" || material === "canal"
    ? DETAIL.ridge
    : material === "slate"
      ? DETAIL.ridgeSlate
      : null;

const facadeOf = (b: DecorBuilding, seed: number): Rgb[] => {
  switch (b.wallMaterial) {
    case "render":
      return b.type === "house" || b.type === "annex" || b.type === "apartment"
        ? FACADE.renderLight
        : FACADE.render;
    case "stone":
      return b.type === "monument" ? FACADE.stoneLight : FACADE.stone;
    case "granite":
      return FACADE.granite;
    case "brick":
      return FACADE.brick;
    case "wood":
      return FACADE.wood;
    case "metal":
      if (b.type === "silo") return FACADE.silo;
      return fract(seed * 3.1) < 0.6 ? FACADE.metal : FACADE.metalGreen;
    case "glass":
      return FACADE.glass;
  }
};

const roof = (
  kind: DecorRoofKind,
  pitch: number,
  color: Rgb,
  extra: Partial<RoofParams> = {},
): RoofParams => ({
  kind,
  pitch,
  maxRise: 7,
  overhang: 0.3,
  color,
  underside: DETAIL.underside,
  ridgeCap: null,
  parapet: null,
  across: null,
  sealed: null,
  ...extra,
});

const openings = (extra: Partial<OpeningStyle>): OpeningStyle => ({
  floorHeight: 2.8,
  bay: 3,
  window: { width: 0.95, height: 1.3, sill: 0.9 },
  glass: DETAIL.glass,
  frame: null,
  shutters: null,
  door: null,
  shop: null,
  ribbon: "never",
  ...extra,
});

/** Bâtiment du pipeline avec le sol rendu autour de lui, pour poser portes et rez-de-chaussée. */
interface SitedBuilding extends DecorBuilding {
  groundAt: GroundAt | null;
}

/** Volume de base : emprise, hauteur, murs mitoyens et mur sur rue du pipeline. */
const baseSpec = (
  b: SitedBuilding,
  walls: Rgb[],
  roofParams: RoofParams,
  extra: Partial<BuildingSpec> = {},
): BuildingSpec => {
  const party = b.footprint.map(() => false);
  for (const k of b.party) if (k < party.length) party[k] = true;
  return {
    footprint: b.footprint,
    base: b.base,
    height: b.height,
    walls,
    plinth: null,
    corners: null,
    roof: roofParams,
    openings: null,
    chimneys: [],
    chimneyColor: DETAIL.chimney,
    street: b.street,
    party,
    floors: b.floors,
    open: null,
    groundAt: b.groundAt,
    ...extra,
  };
};

/**
 * Travers du faîtage pour un faîtage parallèle à la rue : la normale du mur sur rue, si ce mur suit le grand axe
 * (ou si l'emprise est presque carrée). `null` : le grand axe décide. Un mitoyen, lui, s'aligne sur ses voisins.
 */
const streetAcross = (b: DecorBuilding): Point | null => {
  if (b.party.length > 0) return null;
  const a = b.footprint[b.street];
  const c = b.footprint[(b.street + 1) % b.footprint.length];
  if (!a || !c) return null;
  const length = Math.hypot(c.x - a.x, c.z - a.z);
  if (length < 1e-3) return null;
  const ux = (c.x - a.x) / length;
  const uz = (c.z - a.z) / length;
  const frame = obbFrame(normalizeRing(b.footprint));
  const square = frame.halfU < frame.halfV * SQUARE_RATIO;
  const aligned = Math.abs(ux * frame.ux + uz * frame.uz) > STREET_ALIGN_COS;
  return square || aligned ? { x: uz, z: -ux } : null;
};

const build = (out: Buffers, spec: BuildingSpec, lod: Lod): void => {
  buildBuilding(out, spec, lod);
};

// --- Habitations ---

const townHouse = (
  out: Buffers,
  b: SitedBuilding,
  lod: Lod,
  seed: number,
): void => {
  const tall = b.height > 7;
  const material = b.roofMaterial;
  build(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof(
        b.roof,
        b.roof === "hip" ? Math.min(PITCH[material], 35) : PITCH[material],
        roofColor(material, seed),
        {
          ridgeCap: ridgeCapOf(material),
          across: streetAcross(b),
        },
      ),
      {
        plinth: {
          height: 0.6,
          color: tall ? DETAIL.plinthGrey : DETAIL.plinthStone,
        },
        chimneys: [fract(seed * 11) < 0.5 ? 0.1 : 0.9],
        openings: openings({
          floorHeight: 2.9,
          bay: 2.3,
          window: { width: 0.9, height: 1.35, sill: 0.9 },
          frame: DETAIL.frame,
          // Au-delà de R+1, encadrements clairs sans volets battants.
          shutters: tall ? null : BUILDING_PALETTE.shutters,
          door: { width: 1, height: 2.2, color: DETAIL.doorWood },
          shop:
            b.type === "shop"
              ? { glass: DETAIL.glassBlue, sign: DETAIL.sign }
              : null,
        }),
      },
    ),
    lod,
  );
};

const house = (
  out: Buffers,
  b: SitedBuilding,
  lod: Lod,
  seed: number,
): void => {
  const material = b.roofMaterial;
  const hip = b.roof === "hip";
  const pitch =
    material === "canal" || hip ? 30 : Math.min(PITCH[material], 38);
  build(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof(b.roof, pitch, roofColor(material, seed), {
        overhang: hip ? 0.5 : 0.4,
        ridgeCap: hip ? null : ridgeCapOf(material),
      }),
      {
        plinth: { height: 0.3, color: DETAIL.plinthGrey },
        chimneys: [hip ? 0.5 : 0.3],
        openings: openings({
          floorHeight: 2.7,
          // Plain-pied : baies larges sans volets battants ; à étage : volets.
          bay: hip ? 3.4 : 3,
          window: hip
            ? { width: 1.3, height: 1.25, sill: 0.9 }
            : { width: 0.95, height: 1.3, sill: 0.9 },
          shutters: hip ? null : BUILDING_PALETTE.shutters,
          door: {
            width: 1,
            height: 2.15,
            color: hip ? DETAIL.doorSteel : DETAIL.doorWood,
          },
        }),
      },
    ),
    lod,
  );
};

const longhouse = (
  out: Buffers,
  b: SitedBuilding,
  lod: Lod,
  seed: number,
): void => {
  const granite = b.wallMaterial === "granite";
  const material = b.roofMaterial;
  build(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof(b.roof, PITCH[material], roofColor(material, seed), {
        overhang: granite ? 0.15 : 0.25,
        ridgeCap: ridgeCapOf(material),
        across: streetAcross(b),
      }),
      {
        corners:
          b.wallMaterial === "render"
            ? null
            : granite
              ? DETAIL.quoinsGranite
              : DETAIL.quoins,
        // Souches sur les pignons.
        chimneys: [0.05, 0.95],
        openings: openings({
          floorHeight: 3,
          bay: granite ? 4 : 4.5,
          window: { width: 0.9, height: 1.2, sill: 0.9 },
          shutters: granite
            ? BUILDING_PALETTE.shuttersBlue
            : BUILDING_PALETTE.shutters,
          door: { width: 1, height: 2.1, color: DETAIL.doorWood },
        }),
      },
    ),
    lod,
  );
};

const apartment = (
  out: Buffers,
  b: SitedBuilding,
  lod: Lod,
  seed: number,
): void => {
  const flat = b.roof === "flat" || b.roof === "parapet";
  build(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof(b.roof, flat ? 0 : 25, roofColor(b.roofMaterial, seed), {
        overhang: flat ? 0 : 0.4,
        underside: flat ? null : DETAIL.underside,
        parapet: { height: 0.9, thickness: 0.3, color: DETAIL.parapetLight },
      }),
      {
        plinth: { height: 0.9, color: DETAIL.plinthGrey },
        chimneys: flat ? [] : [0.2, 0.8],
        openings: openings({
          floorHeight: 2.9,
          bay: 3,
          window: { width: 1.2, height: 1.4, sill: 0.9 },
          frame: b.wallMaterial === "brick" ? DETAIL.frame : null,
          // De loin, un bandeau par étage.
          ribbon: "far",
          door: { width: 1.6, height: 2.4, color: DETAIL.glassBlue },
        }),
      },
    ),
    lod,
  );
};

// --- Agricole et activité ---

const barn = (out: Buffers, b: SitedBuilding, lod: Lod, seed: number): void => {
  const stone = b.wallMaterial === "stone" || b.wallMaterial === "granite";
  const material = b.roofMaterial;
  build(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof(
        b.roof,
        material === "metal" ? 22 : Math.min(PITCH[material], 38),
        roofColor(material, seed),
        { overhang: 0.4, across: streetAcross(b) },
      ),
      {
        plinth: stone ? null : { height: 0.8, color: DETAIL.concrete },
        corners: stone ? DETAIL.quoins : null,
        openings: openings({
          window: null,
          door: { width: 4, height: 4.2, color: DETAIL.doorWood },
        }),
      },
    ),
    lod,
  );
};

const hangar = (out: Buffers, b: SitedBuilding, lod: Lod, seed: number): void =>
  build(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof(
        b.roof === "flat" ? "flat" : "gable",
        12,
        roofColor(b.roofMaterial, seed),
      ),
      { open: DETAIL.post },
    ),
    lod,
  );

const workshop = (
  out: Buffers,
  b: SitedBuilding,
  lod: Lod,
  seed: number,
): void => {
  const flat = b.roof === "flat" || b.roof === "parapet";
  build(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof(b.roof, flat ? 0 : 6, roofColor(b.roofMaterial, seed), {
        overhang: flat ? 0 : 0.2,
        underside: null,
        parapet: { height: 0.8, thickness: 0.3, color: DETAIL.parapet },
      }),
      {
        plinth: { height: 1, color: DETAIL.concrete },
        openings: openings({
          floorHeight: Math.max(b.height, 4),
          window: flat ? { width: 1, height: 1, sill: 4.6 } : null,
          glass: DETAIL.glassBlue,
          ribbon: flat ? "always" : "never",
          door: { width: 4.5, height: 4.5, color: DETAIL.doorSteel },
        }),
      },
    ),
    lod,
  );
};

const annex = (
  out: Buffers,
  b: SitedBuilding,
  lod: Lod,
  seed: number,
): void => {
  const shed = b.roof === "shed";
  const material = b.roofMaterial;
  build(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof(
        b.roof,
        shed ? 8 : Math.min(PITCH[material], 35),
        roofColor(shed ? "metal" : material, seed),
        { overhang: shed ? 0.15 : 0.2, underside: null },
      ),
      {
        openings: openings({
          window: null,
          door: {
            width: shed ? 2.4 : 2.2,
            height: 2.1,
            color: shed ? DETAIL.doorSteel : DETAIL.doorWood,
          },
        }),
      },
    ),
    lod,
  );
};

// --- Édifices religieux ---

/** Clocher carré au bout du grand axe de la nef, déduit de son emprise. */
const towerFootprint = (ring: Point[]): Point[] => {
  const f = obbFrame(ring);
  const side = Math.min(f.halfV * 2 * 0.72, 6.5);
  const u = f.uMid + f.halfU - side / 2;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([su, sv]) => {
    const U = u + (su * side) / 2;
    const V = f.vMid + (sv * side) / 2;
    return { x: f.ux * U + f.vx * V, z: f.uz * U + f.vz * V };
  });
};

const square = (cx: number, cz: number, side: number): Point[] => [
  { x: cx - side / 2, z: cz - side / 2 },
  { x: cx + side / 2, z: cz - side / 2 },
  { x: cx + side / 2, z: cz + side / 2 },
  { x: cx - side / 2, z: cz + side / 2 },
];

const church = (
  out: Buffers,
  b: SitedBuilding,
  lod: Lod,
  seed: number,
): void => {
  const material = b.roofMaterial;
  const color = roofColor(material, seed);
  const walls = facadeOf(b, seed);
  buildBuilding(
    out,
    baseSpec(
      b,
      walls,
      roof("gable", Math.max(PITCH[material], 40), color, {
        maxRise: 9,
        ridgeCap: ridgeCapOf(material),
      }),
      {
        floors: null,
        corners: DETAIL.quoins,
        openings: openings({
          floorHeight: Math.max(b.height, 5),
          bay: 5,
          window: {
            width: 1,
            height: Math.min(3.4, b.height * 0.4),
            sill: Math.min(2.6, b.height * 0.3),
          },
          glass: DETAIL.stainedGlass,
          frame: DETAIL.quoins,
          door: { width: 1.8, height: 3.2, color: DETAIL.doorWood },
        }),
      },
    ),
    lod,
  );
  // Clocher : deux fois la nef environ, flèche aiguë.
  const towerHeight = Math.min(28, Math.max(14, b.height * 2.2));
  buildBuilding(
    out,
    {
      ...baseSpec(
        b,
        walls,
        roof("hip", 74, color, { maxRise: 14, overhang: 0.2, underside: null }),
        {
          corners: DETAIL.quoins,
          openings: openings({
            floorHeight: towerHeight + 2,
            bay: 2.6,
            window: { width: 0.9, height: 1.8, sill: towerHeight - 4 },
            glass: DETAIL.doorDark,
          }),
        },
      ),
      footprint: towerFootprint(normalizeRing(b.footprint)),
      height: towerHeight,
      street: null,
      party: null,
      floors: null,
    },
    lod,
  );
};

const chapel = (
  out: Buffers,
  b: SitedBuilding,
  lod: Lod,
  seed: number,
): void => {
  const material = b.roofMaterial;
  const built = buildBuilding(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof("gable", Math.max(PITCH[material], 45), roofColor(material, seed), {
        ridgeCap: ridgeCapOf(material),
      }),
      {
        floors: null,
        corners: DETAIL.quoins,
        openings: openings({
          floorHeight: Math.max(b.height, 4),
          bay: 3.5,
          window: { width: 0.8, height: 2.2, sill: 1.8 },
          glass: DETAIL.stainedGlass,
          door: { width: 1.4, height: 2.6, color: DETAIL.doorWood },
        }),
      },
    ),
    lod,
  );
  const ridge = built?.result.ridge;
  if (!built || !ridge) return;
  // Clocheton posé sur le faîtage, côté entrée.
  const [r0, r1] = ridge;
  const p = { x: r0.x + (r1.x - r0.x) * 0.12, z: r0.z + (r1.z - r0.z) * 0.12 };
  buildBuilding(
    out,
    {
      ...baseSpec(
        b,
        [DETAIL.quoins],
        roof("hip", 64, ROOF.slate, {
          maxRise: 3,
          overhang: 0.15,
          underside: null,
        }),
        {
          openings: openings({
            floorHeight: 3,
            bay: 1.2,
            window: { width: 0.5, height: 0.9, sill: 1 },
            glass: DETAIL.doorDark,
          }),
        },
      ),
      footprint: square(p.x, p.z, 1.4),
      base: built.result.heightAt(p) - 0.6,
      height: 2.4,
      street: null,
      party: null,
      floors: null,
    },
    lod,
  );
};

const tower = (out: Buffers, b: SitedBuilding, lod: Lod, seed: number): void =>
  build(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof("hip", 72, roofColor(b.roofMaterial, seed), {
        maxRise: 10,
        overhang: 0.2,
        underside: null,
      }),
      {
        floors: null,
        corners: DETAIL.quoins,
        openings: openings({
          floorHeight: b.height + 2,
          bay: 2.6,
          window: { width: 0.9, height: 1.8, sill: Math.max(1, b.height - 4) },
          glass: DETAIL.doorDark,
        }),
      },
    ),
    lod,
  );

// --- Ouvrages ---

const silo = (out: Buffers, b: SitedBuilding, lod: Lod, seed: number): void => {
  const built = buildBuilding(
    out,
    baseSpec(
      b,
      facadeOf(b, seed),
      roof("hip", 30, roofColor("metal", seed), {
        maxRise: 4,
        overhang: 0.2,
        underside: null,
      }),
    ),
    lod,
  );
  if (!built || lod !== "near") return;
  // Échelle sur le mur côté route.
  const a = b.footprint[b.street];
  const c = b.footprint[(b.street + 1) % b.footprint.length];
  if (!a || !c) return;
  const length = Math.hypot(c.x - a.x, c.z - a.z);
  if (length < 0.6) return;
  const ux = (c.x - a.x) / length;
  const uz = (c.z - a.z) / length;
  // Normale sortante : le contour du pipeline tourne dans le sens négatif, l'extérieur est à gauche.
  const outward = signedArea(b.footprint) < 0 ? -1 : 1;
  pushBox(out, {
    cx: (a.x + c.x) / 2 + uz * 0.08 * outward,
    cz: (a.z + c.z) / 2 - ux * 0.08 * outward,
    ux,
    uz,
    halfU: 0.25,
    halfV: 0.06,
    y0: b.base + 0.5,
    y1: b.base + b.height,
    color: ROOF.metalDark,
    top: false,
  });
};

/** Serre : un tunnel si elle est étroite, sinon des chapelles accolées de 8 m, faîtages parallèles. */
const greenhouse = (
  out: Buffers,
  b: SitedBuilding,
  lod: Lod,
  seed: number,
): void => {
  const walls = facadeOf(b, seed);
  const ring = normalizeRing(b.footprint);
  const frame = obbFrame(ring);
  const width = frame.halfV * 2;
  const glassRoof = (): RoofParams =>
    roof("gable", 25, ROOF.glass, {
      overhang: 0,
      underside: null,
      across: { x: frame.vx, z: frame.vz },
    });
  const door = openings({
    window: null,
    door: { width: 2, height: 2, color: DETAIL.doorSteel },
  });
  if (width <= GREENHOUSE_SINGLE_MAX_WIDTH) {
    build(out, baseSpec(b, walls, glassRoof(), { openings: door }), lod);
    return;
  }
  const count = Math.ceil(width / GREENHOUSE_BAY);
  const step = width / count;
  const v0 = frame.vMid - frame.halfV;
  for (let i = 0; i < count; i++) {
    const low = v0 + i * step;
    const high = low + step;
    const across = (p: Point): number => p.x * frame.vx + p.z * frame.vz;
    const strip = clipPolygon(
      clipPolygon(ring, (p) => low - across(p)),
      (p) => across(p) - high,
    );
    if (strip.length < 3 || Math.abs(signedArea(strip)) < 4) continue;
    build(
      out,
      {
        ...baseSpec(b, walls, glassRoof(), {
          openings: i === Math.floor(count / 2) ? door : null,
        }),
        footprint: strip,
        street: null,
        party: null,
        floors: null,
      },
      lod,
    );
  }
};

const monument = (
  out: Buffers,
  b: SitedBuilding,
  lod: Lod,
  seed: number,
): void => {
  const walls = facadeOf(b, seed);
  if (b.roof === "hip") {
    // Obélisque : socle bas, fût effilé jusqu'au pyramidion.
    const ring = normalizeRing(b.footprint);
    const frame = obbFrame(ring);
    const cx = frame.ux * frame.uMid + frame.vx * frame.vMid;
    const cz = frame.uz * frame.uMid + frame.vz * frame.vMid;
    const side = Math.min(frame.halfU, frame.halfV) * 2;
    build(
      out,
      {
        ...baseSpec(b, walls, roof("flat", 0, ROOF.stone)),
        height: 1,
        street: null,
        party: null,
        floors: null,
      },
      lod,
    );
    build(
      out,
      {
        ...baseSpec(
          b,
          walls,
          roof("hip", 65, ROOF.stone, {
            maxRise: 1.2,
            overhang: 0,
            underside: null,
          }),
        ),
        footprint: square(cx, cz, Math.max(0.6, side * 0.3)),
        base: b.base + 1,
        height: Math.max(2, b.height - 1),
        street: null,
        party: null,
        floors: null,
      },
      lod,
    );
    return;
  }
  build(
    out,
    baseSpec(
      b,
      walls,
      roof("parapet", 0, ROOF.stone, {
        parapet: { height: 0.6, thickness: 0.4, color: DETAIL.quoins },
      }),
      { floors: null, plinth: { height: 1.2, color: DETAIL.plinthStone } },
    ),
    lod,
  );
};

type Builder = (out: Buffers, b: SitedBuilding, lod: Lod, seed: number) => void;

const BUILDERS: Record<DecorBuilding["type"], Builder> = {
  townHouse,
  shop: townHouse,
  house,
  longhouse,
  barn,
  hangar,
  workshop,
  apartment,
  church,
  chapel,
  tower,
  annex,
  silo,
  greenhouse,
  monument,
};

/** Ajoute un bâtiment typé aux tampons, en version proche ou lointaine. `groundAt` : sol rendu, `null` s'il est inconnu. */
export const pushTypedBuilding = (
  out: Buffers,
  building: DecorBuilding,
  lod: Lod,
  groundAt: GroundAt | null = null,
): void => {
  if (building.footprint.length < 3) return;
  BUILDERS[building.type](
    out,
    { ...building, groundAt },
    lod,
    seedOf(building.footprint),
  );
};
