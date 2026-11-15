import { DETAIL, FACADE, ROOF, SHUTTERS, SHUTTERS_BLUE } from "./colors";
import {
  type BuildingSpec,
  type Lod,
  type OpeningStyle,
  buildBuilding,
} from "./generator";
import { type Point, normalizeRing, obbFrame } from "./math";
import { type Buffers, pushBox } from "./mesh";
import type { RoofKind, RoofParams } from "./roofs";

// Catalogue des propositions : chaque typologie en deux variantes, construites depuis une emprise.

export type RoofChoice = "auto" | "hip" | "gable";

export interface Variant {
  id: string;
  label: string;
  note: string;
  /** Le choix « croupe / pignon » s'applique */
  choosable: boolean;
  /** Nombre de bâtiments de la variante : la rangée de bourg en compte trois */
  count: number;
  /** Ajoute la variante aux tampons et rend le toit obtenu pour chaque bâtiment */
  build: (out: Buffers, lod: Lod, choice: RoofChoice) => RoofKind[];
}

export interface Typology {
  id: string;
  label: string;
  /** Part dans un village rural type, pour l'estimation à 500 bâtiments */
  share: number;
  /** Données IGN qui y mènent */
  source: string;
  variants: [Variant, Variant];
}

export const ROOF_LABEL: Record<RoofKind, string> = {
  gable: "deux pans",
  hip: "croupe",
  flat: "plat",
  parapet: "plat + acrotère",
  shed: "monopente",
};

const rect = (w: number, d: number, cx = 0, cz = 0): Point[] => [
  { x: cx - w / 2, z: cz - d / 2 },
  { x: cx + w / 2, z: cz - d / 2 },
  { x: cx + w / 2, z: cz + d / 2 },
  { x: cx - w / 2, z: cz + d / 2 },
];

const roof = (
  kind: RoofKind,
  pitch: number,
  color: RoofParams["color"],
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

const spec = (
  footprint: Point[],
  height: number,
  walls: BuildingSpec["walls"],
  roofParams: RoofParams,
  extra: Partial<BuildingSpec> = {},
): BuildingSpec => ({
  footprint,
  base: 0,
  height,
  walls,
  plinth: null,
  corners: null,
  roof: roofParams,
  openings: null,
  chimneys: [],
  chimneyColor: DETAIL.chimney,
  street: null,
  open: null,
  ...extra,
});

const withChoice = (s: BuildingSpec, choice: RoofChoice): BuildingSpec =>
  choice === "auto" || (s.roof.kind !== "gable" && s.roof.kind !== "hip")
    ? s
    : { ...s, roof: { ...s.roof, kind: choice } };

/** Chaque bâtiment voit les autres comme voisins : les murs communs deviennent mitoyens. */
const buildAll = (out: Buffers, lod: Lod, specs: BuildingSpec[]): RoofKind[] =>
  specs.flatMap((s, i) => {
    const neighbors = specs.filter((_, j) => j !== i).map((o) => o.footprint);
    const built = buildBuilding(out, s, lod, neighbors);
    return built ? [built.roof] : [];
  });

const variant = (
  id: string,
  label: string,
  note: string,
  choosable: boolean,
  specs: BuildingSpec[],
): Variant => ({
  id,
  label,
  note,
  choosable,
  count: specs.length,
  build: (out, lod, choice) =>
    buildAll(
      out,
      lod,
      choosable ? specs.map((s) => withChoice(s, choice)) : specs,
    ),
});

// --- Maisons de bourg : rangée de trois, pignons sur les murs mitoyens, façade sur la rue (+z).

const townHouse = (
  height: number,
  extra: Partial<OpeningStyle> = {},
): OpeningStyle =>
  openings({
    floorHeight: 2.9,
    bay: 2.3,
    window: { width: 0.9, height: 1.35, sill: 0.9 },
    frame: DETAIL.frame,
    shutters: SHUTTERS,
    door: { width: 1, height: 2.2, color: DETAIL.doorWood },
    ...extra,
    ...(height > 7 ? { shutters: null } : {}),
  });

/** La rue passe devant, côté +z */
const STREET: Point = { x: 0, z: 1 };

const ROW = [
  rect(6, 10, -6, 0),
  rect(6.5, 10, 0.25, 0),
  // Fond de parcelle biais : une emprise quelconque, pas un rectangle.
  [
    { x: 3.5, z: -5 },
    { x: 9, z: -5.8 },
    { x: 9, z: 5 },
    { x: 3.5, z: 5 },
  ],
];

const bourgA = ROW.map((fp, i) =>
  spec(
    fp,
    [6.2, 6.6, 6][i],
    FACADE.render,
    roof("gable", 40, ROOF.tile, { ridgeCap: DETAIL.ridge }),
    {
      plinth: { height: 0.6, color: DETAIL.plinthStone },
      street: STREET,
      openings: townHouse(6),
      chimneys: [0.9],
    },
  ),
);

const bourgB = ROW.map((fp, i) =>
  spec(
    fp,
    [9, 8.6, 9.4][i],
    FACADE.renderLight,
    roof("gable", 45, ROOF.slate, { ridgeCap: DETAIL.ridgeSlate }),
    {
      plinth: { height: 0.5, color: DETAIL.plinthGrey },
      street: STREET,
      openings: townHouse(
        9,
        i === 1 ? { shop: { glass: DETAIL.glassBlue, sign: DETAIL.sign } } : {},
      ),
      chimneys: [0.1],
    },
  ),
);

// --- Église : nef et clocher carré à flèche, tous deux déduits de l'emprise de la nef.

const NAVE = rect(11, 26);

const towerFootprint = (footprint: Point[]): Point[] => {
  const f = obbFrame(normalizeRing(footprint));
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

const church: Variant = {
  id: "church",
  label: "Église à clocher-porche",
  note: "Nef pierre, toit ardoise, vitraux hauts ; clocher carré au bout du grand axe, flèche à 74°.",
  choosable: false,
  count: 1,
  build: (out, lod) => {
    const nave = spec(
      NAVE,
      9,
      FACADE.stoneOchre,
      roof("gable", 48, ROOF.slate, {
        maxRise: 9,
        ridgeCap: DETAIL.ridgeSlate,
      }),
      {
        corners: DETAIL.quoins,
        openings: openings({
          floorHeight: 9,
          bay: 5,
          window: { width: 1, height: 3.4, sill: 2.6 },
          glass: DETAIL.stainedGlass,
          frame: DETAIL.quoins,
          door: { width: 1.8, height: 3.2, color: DETAIL.doorWood },
        }),
      },
    );
    const tower = spec(
      towerFootprint(NAVE),
      20,
      FACADE.stoneOchre,
      roof("hip", 74, ROOF.slate, {
        maxRise: 14,
        overhang: 0.2,
        underside: null,
      }),
      {
        corners: DETAIL.quoins,
        openings: openings({
          floorHeight: 22,
          bay: 2.6,
          window: { width: 0.9, height: 1.8, sill: 16 },
          glass: DETAIL.doorDark,
        }),
      },
    );
    return [
      buildBuilding(out, nave, lod),
      buildBuilding(out, tower, lod),
    ].flatMap((b) => (b ? [b.roof] : []));
  },
};

const chapel: Variant = {
  id: "chapel",
  label: "Chapelle à clocheton",
  note: "Petite nef tuile ; clocheton posé sur le faîtage, côté entrée.",
  choosable: false,
  count: 1,
  build: (out, lod) => {
    const nave = spec(
      rect(7, 14),
      5.5,
      FACADE.render,
      roof("gable", 50, ROOF.tile, { ridgeCap: DETAIL.ridge }),
      {
        corners: DETAIL.quoins,
        openings: openings({
          floorHeight: 6,
          bay: 3.5,
          window: { width: 0.8, height: 2.2, sill: 1.8 },
          glass: DETAIL.stainedGlass,
          door: { width: 1.4, height: 2.6, color: DETAIL.doorWood },
        }),
      },
    );
    const built = buildBuilding(out, nave, lod);
    if (!built) return [];
    const ridge = built.result.ridge;
    if (!ridge) return [built.roof];
    const [r0, r1] = ridge;
    const p = {
      x: r0.x + (r1.x - r0.x) * 0.12,
      z: r0.z + (r1.z - r0.z) * 0.12,
    };
    const y = built.result.heightAt(p);
    const belfry = spec(
      rect(1.4, 1.4, p.x, p.z),
      2.4,
      [DETAIL.quoins],
      roof("hip", 64, ROOF.slate, {
        maxRise: 3,
        overhang: 0.15,
        underside: null,
      }),
      {
        base: y - 0.6,
        openings: openings({
          floorHeight: 3,
          bay: 1.2,
          window: { width: 0.5, height: 0.9, sill: 1 },
          glass: DETAIL.doorDark,
        }),
      },
    );
    const top = buildBuilding(out, belfry, lod);
    return [built.roof, ...(top ? [top.roof] : [])];
  },
};

// --- Silos : prisme octogonal, la croupe sur huit pans fait le toit conique.

/** Polygone régulier, côtés plats face aux axes */
const polygon = (n: number, r: number, cx = 0, cz = 0): Point[] =>
  Array.from({ length: n }, (_, k) => {
    const a = ((k + 0.5) * 2 * Math.PI) / n;
    return { x: cx + r * Math.cos(a), z: cz + r * Math.sin(a) };
  });

const SILO_PITCH = 30;

const siloVariant = (
  id: string,
  label: string,
  note: string,
  count: number,
  r: number,
  h: number,
): Variant => ({
  id,
  label,
  note,
  choosable: false,
  count,
  build: (out, lod) => {
    const apothem = r * Math.cos(Math.PI / 8);
    // Écart de 0,5 m : au-delà de la tolérance de mitoyenneté (0,3 m).
    const step = 2 * apothem + 0.5;
    const xs = Array.from(
      { length: count },
      (_, i) => (i - (count - 1) / 2) * step,
    );
    const roofs = buildAll(
      out,
      lod,
      xs.map((x) =>
        spec(
          polygon(8, r, x),
          h,
          FACADE.silo,
          roof("hip", SILO_PITCH, ROOF.steel, {
            maxRise: 4,
            overhang: 0.2,
            underside: null,
          }),
        ),
      ),
    );
    // Échelle sur la face avant, en proche seulement.
    if (lod === "near")
      for (const x of xs)
        pushBox(out, {
          cx: x,
          cz: apothem + 0.08,
          ux: 1,
          uz: 0,
          halfU: 0.25,
          halfV: 0.06,
          y0: 0.5,
          y1: h,
          color: ROOF.steelDark,
          top: false,
        });
    // Passerelle d'une pointe à l'autre, visible aussi de loin.
    if (count > 1) {
      const apex = h + Math.tan((SILO_PITCH * Math.PI) / 180) * apothem;
      pushBox(out, {
        cx: 0,
        cz: 0,
        ux: 1,
        uz: 0,
        halfU: xs[xs.length - 1],
        halfV: 0.45,
        y0: apex - 0.2,
        y1: apex + 0.15,
        color: ROOF.steelDark,
        top: true,
      });
    }
    return roofs;
  },
});

// --- Serres : deux pans à 25°, tout en gris-bleu très clair.

const greenhouseRoof = (extra: Partial<RoofParams> = {}): RoofParams =>
  roof("gable", 25, ROOF.greenhouse, {
    overhang: 0,
    underside: null,
    ...extra,
  });

const greenhouseDoor = openings({
  window: null,
  door: { width: 2, height: 2, color: DETAIL.doorSteel },
});

// Chapelles accolées : faîtages parallèles aux murs communs, chéneaux sur les murs mitoyens.
const CHAPELS = [-8, 0, 8].map((cx, i) =>
  spec(
    rect(8, 28, cx),
    3,
    FACADE.greenhouse,
    greenhouseRoof({ across: { x: 1, z: 0 } }),
    {
      street: STREET,
      openings: i === 1 ? greenhouseDoor : null,
    },
  ),
);

// --- Monuments : pierre claire, toit plat, aucune ouverture.

const obelisk: Variant = {
  id: "monumentA",
  label: "Obélisque sur socle",
  note: "Monument aux morts : socle à deux gradins, fût de pierre, pyramidion ; aucune ouverture.",
  choosable: false,
  count: 1,
  build: (out, lod) =>
    [
      spec(rect(3.2, 3.2), 1, FACADE.stoneLight, roof("flat", 0, ROOF.stone)),
      spec(
        rect(1.8, 1.8),
        0.9,
        FACADE.stoneLight,
        roof("flat", 0, ROOF.stone),
        {
          base: 1,
        },
      ),
      spec(
        rect(0.9, 0.9),
        5.5,
        FACADE.stoneLight,
        roof("hip", 65, ROOF.stone, {
          maxRise: 1.2,
          overhang: 0,
          underside: null,
        }),
        { base: 1.9 },
      ),
    ].flatMap((s) => {
      const built = buildBuilding(out, s, lod);
      return built ? [built.roof] : [];
    }),
};

export const TYPOLOGIES: Typology[] = [
  {
    id: "bourg",
    label: "Maison de bourg mitoyenne",
    share: 0.2,
    source:
      "Résidentiel, mitoyen (arête commune avec un voisin), 2 étages ou plus",
    variants: [
      variant(
        "bourgA",
        "R+1 tuile, volets",
        "Rangée de trois, faîtage parallèle à la rue, pignons mitoyens, volets battants.",
        false,
        bourgA,
      ),
      variant(
        "bourgB",
        "R+2 ardoise, commerce",
        "Plus haute, encadrements clairs, vitrine et enseigne au rez-de-chaussée du milieu.",
        false,
        bourgB,
      ),
    ],
  },
  {
    id: "pavillon",
    label: "Pavillon récent",
    share: 0.4,
    source: "Résidentiel, isolé, 1 ou 2 logements, 0 ou 1 étage",
    variants: [
      variant(
        "pavillonA",
        "Plain-pied 4 pans",
        "Crépi clair, toit en croupe, débord 50 cm, baies larges sans volets battants.",
        true,
        [
          spec(
            rect(11, 8.5),
            2.8,
            FACADE.renderLight,
            roof("hip", 30, ROOF.tile, { overhang: 0.5 }),
            {
              plinth: { height: 0.3, color: DETAIL.plinthGrey },
              openings: openings({
                floorHeight: 2.7,
                bay: 3.4,
                window: { width: 1.3, height: 1.25, sill: 0.9 },
                door: { width: 1, height: 2.15, color: DETAIL.doorSteel },
              }),
              chimneys: [0.5],
            },
          ),
        ],
      ),
      variant(
        "pavillonB",
        "R+1 combles, pignon",
        "Crépi ocre, deux pans à 35°, une cheminée, volets.",
        true,
        [
          spec(
            rect(9.5, 8),
            5.4,
            FACADE.render,
            roof("gable", 35, ROOF.tileDark, {
              overhang: 0.4,
              ridgeCap: DETAIL.ridge,
            }),
            {
              plinth: { height: 0.3, color: DETAIL.plinthGrey },
              openings: openings({
                floorHeight: 2.7,
                bay: 3,
                shutters: SHUTTERS,
                door: { width: 1, height: 2.15, color: DETAIL.doorWood },
              }),
              chimneys: [0.3],
            },
          ),
        ],
      ),
    ],
  },
  {
    id: "longere",
    label: "Longère / ferme en pierre",
    share: 0.1,
    source:
      "Résidentiel ou Agricole, très allongée (rapport ≥ 2,5), hauteur ≤ 5 m",
    variants: [
      variant(
        "longereA",
        "Pierre ocre, tuile",
        "24 × 7 m, chaînages d'angle, cheminées sur les pignons, volets colorés.",
        true,
        [
          spec(
            rect(24, 7),
            3.4,
            FACADE.stoneOchre,
            roof("gable", 40, ROOF.tile, {
              overhang: 0.25,
              ridgeCap: DETAIL.ridge,
            }),
            {
              corners: DETAIL.quoins,
              openings: openings({
                floorHeight: 3,
                bay: 4.5,
                window: { width: 0.9, height: 1.2, sill: 0.9 },
                shutters: SHUTTERS,
                door: { width: 1, height: 2.1, color: DETAIL.doorWood },
              }),
              chimneys: [0.05, 0.95],
            },
          ),
        ],
      ),
      variant(
        "longereB",
        "Granit, ardoise",
        "Bretonne : 20 × 6,5 m, toit à 45°, volets bleus, souches en pignon.",
        true,
        [
          spec(
            rect(20, 6.5),
            3,
            FACADE.granite,
            roof("gable", 45, ROOF.slate, {
              overhang: 0.15,
              ridgeCap: DETAIL.ridgeSlate,
            }),
            {
              corners: DETAIL.quoinsGranite,
              openings: openings({
                floorHeight: 3,
                bay: 4,
                window: { width: 0.85, height: 1.15, sill: 0.9 },
                shutters: SHUTTERS_BLUE,
                door: { width: 1, height: 2, color: DETAIL.doorWood },
              }),
              chimneys: [0.04, 0.96],
            },
          ),
        ],
      ),
    ],
  },
  {
    id: "grange",
    label: "Grange / hangar agricole",
    share: 0.08,
    source:
      "Agricole, ou « Industriel, agricole ou commercial » hors bourg ; construction légère → hangar ouvert",
    variants: [
      variant(
        "grangeA",
        "Grange bardage bois",
        "Soubassement maçonné, bardage sombre, grande porte, pente 22°.",
        false,
        [
          spec(
            rect(16, 11),
            5.5,
            FACADE.wood,
            roof("gable", 22, ROOF.steelDark, { overhang: 0.4 }),
            {
              plinth: { height: 0.8, color: DETAIL.concrete },
              openings: openings({
                window: null,
                door: { width: 4, height: 4.2, color: DETAIL.doorWood },
              }),
            },
          ),
        ],
      ),
      variant(
        "grangeB",
        "Hangar tôle ouvert",
        "Toit à 12° sur poteaux, sous-face visible de loin comme de près.",
        false,
        [
          spec(
            rect(20, 10),
            5,
            FACADE.wood,
            roof("gable", 12, ROOF.steel, { overhang: 0.3 }),
            { open: DETAIL.post },
          ),
        ],
      ),
    ],
  },
  {
    id: "activite",
    label: "Bâtiment d'activité",
    share: 0.04,
    source:
      "Industriel, ou Commercial et services hors bourg, grande emprise (> 300 m²)",
    variants: [
      variant(
        "activiteA",
        "Bac acier, acrotère",
        "Toit plat derrière acrotère, soubassement béton, bandeau vitré haut, porte sectionnelle.",
        false,
        [
          spec(
            rect(30, 18),
            7,
            FACADE.steelLight,
            roof("parapet", 0, ROOF.gravel, {
              parapet: {
                height: 0.8,
                thickness: 0.3,
                color: [0.62, 0.64, 0.66],
              },
            }),
            {
              plinth: { height: 1, color: DETAIL.concrete },
              openings: openings({
                floorHeight: 7,
                window: { width: 1, height: 1, sill: 4.6 },
                glass: DETAIL.glassBlue,
                ribbon: "always",
                door: { width: 4.5, height: 4.5, color: DETAIL.doorSteel },
              }),
            },
          ),
        ],
      ),
      variant(
        "activiteB",
        "Entrepôt faible pente",
        "Bardage vert, deux pans à 6°, grande porte.",
        false,
        [
          spec(
            rect(26, 16),
            6.5,
            FACADE.steelGreen,
            roof("gable", 6, ROOF.steel, { overhang: 0.2, underside: null }),
            {
              plinth: { height: 1, color: DETAIL.concrete },
              openings: openings({
                window: null,
                door: { width: 5, height: 5, color: DETAIL.doorSteel },
              }),
            },
          ),
        ],
      ),
    ],
  },
  {
    id: "immeuble",
    label: "Petit immeuble",
    share: 0.02,
    source: "Résidentiel, 4 logements ou plus, ou 3 étages et plus",
    variants: [
      variant(
        "immeubleA",
        "R+3 toit plat",
        "Crépi clair, acrotère, rangs de fenêtres ; de loin, un bandeau par étage.",
        false,
        [
          spec(
            rect(22, 11),
            12.2,
            FACADE.renderLight,
            roof("parapet", 0, ROOF.gravel, {
              parapet: {
                height: 0.9,
                thickness: 0.3,
                color: [0.8, 0.79, 0.75],
              },
            }),
            {
              plinth: { height: 0.9, color: DETAIL.plinthGrey },
              openings: openings({
                floorHeight: 2.9,
                bay: 3,
                window: { width: 1.2, height: 1.4, sill: 0.9 },
                ribbon: "far",
                door: { width: 1.6, height: 2.4, color: DETAIL.glassBlue },
              }),
            },
          ),
        ],
      ),
      variant(
        "immeubleB",
        "R+4 brique, 4 pans",
        "Années 60 : brique, encadrements clairs, toit en croupe.",
        true,
        [
          spec(
            rect(18, 10),
            15,
            FACADE.brick,
            roof("hip", 25, ROOF.tileDark, { overhang: 0.4 }),
            {
              plinth: { height: 0.9, color: DETAIL.plinthGrey },
              openings: openings({
                floorHeight: 2.9,
                bay: 3,
                window: { width: 1.2, height: 1.4, sill: 0.9 },
                frame: DETAIL.frame,
                ribbon: "far",
                door: { width: 1.6, height: 2.4, color: DETAIL.doorWood },
              }),
              chimneys: [0.2, 0.8],
            },
          ),
        ],
      ),
    ],
  },
  {
    id: "eglise",
    label: "Église",
    share: 0.01,
    source: "nature « Église » ou « Chapelle », ou usage Religieux",
    variants: [church, chapel],
  },
  {
    id: "annexe",
    label: "Annexe / garage",
    share: 0.125,
    source: "usage « Annexe », ou moins de 30 m², ou hauteur < 3 m",
    variants: [
      variant(
        "annexeA",
        "Garage monopente",
        "Bac acier à 8°, porte basculante.",
        false,
        [
          spec(
            rect(5.5, 6),
            2.6,
            FACADE.render,
            roof("shed", 8, ROOF.steel, { overhang: 0.15, underside: null }),
            {
              openings: openings({
                window: null,
                door: { width: 2.4, height: 2.1, color: DETAIL.doorSteel },
              }),
            },
          ),
        ],
      ),
      variant(
        "annexeB",
        "Remise deux pans",
        "Pierre, tuile à 35°, porte bois.",
        true,
        [
          spec(
            rect(4.5, 6.5),
            2.4,
            FACADE.stoneOchre,
            roof("gable", 35, ROOF.tile, { overhang: 0.2 }),
            {
              openings: openings({
                window: null,
                door: { width: 2.2, height: 2, color: DETAIL.doorWood },
              }),
            },
          ),
        ],
      ),
    ],
  },
  {
    id: "silo",
    label: "Silo",
    share: 0.01,
    source: "nature « Silo »",
    variants: [
      siloVariant(
        "siloA",
        "Silo seul",
        "Prisme octogonal de 16 m, toit conique en tôle à 30°, échelle en façade.",
        1,
        3.5,
        16,
      ),
      siloVariant(
        "siloB",
        "Batterie de 3",
        "Trois silos accolés de 14 m, passerelle d'une pointe à l'autre.",
        3,
        3,
        14,
      ),
    ],
  },
  {
    id: "serre",
    label: "Serre",
    share: 0.01,
    source: "nature « Serre »",
    variants: [
      variant(
        "serreA",
        "Tunnel simple",
        "Une chapelle de 8 × 24 m, deux pans à 25°, porte au pignon.",
        false,
        [
          spec(rect(8, 24), 2.2, FACADE.greenhouse, greenhouseRoof(), {
            street: STREET,
            openings: greenhouseDoor,
          }),
        ],
      ),
      {
        ...variant(
          "serreB",
          "Multi-chapelles",
          "Trois chapelles accolées de 8 × 28 m ; une seule emprise IGN, comptée comme un bâtiment.",
          false,
          CHAPELS,
        ),
        count: 1,
      },
    ],
  },
  {
    id: "monument",
    label: "Monument",
    share: 0.005,
    source: "nature « Arc de triomphe », « Monument »…",
    variants: [
      obelisk,
      variant(
        "monumentB",
        "Bloc massif",
        "Arc ou mémorial plein : pierre claire, corniche en acrotère, soubassement, aucune ouverture.",
        false,
        [
          spec(
            rect(14, 8),
            12,
            FACADE.stoneLight,
            roof("parapet", 0, ROOF.stone, {
              parapet: {
                height: 0.6,
                thickness: 0.4,
                color: [0.86, 0.83, 0.76],
              },
            }),
            { plinth: { height: 1.2, color: DETAIL.plinthStone } },
          ),
        ],
      ),
    ],
  },
  {
    id: "repli",
    label: "Emprises difficiles (repli)",
    share: 0,
    source: "Hors typologie : contrôle que tout générateur retombe proprement",
    variants: [
      variant(
        "repliA",
        "En L, croupe demandée",
        "Concave : pas de croupe exacte, on tente deux pans, sinon plat.",
        true,
        [
          spec(
            [
              { x: -6, z: -5.5 },
              { x: 6, z: -5.5 },
              { x: 6, z: -0.5 },
              { x: -1, z: -0.5 },
              { x: -1, z: 5.5 },
              { x: -6, z: 5.5 },
            ],
            3,
            FACADE.renderLight,
            roof("hip", 30, ROOF.tile, { overhang: 0.4 }),
            {
              openings: openings({ floorHeight: 2.8, shutters: SHUTTERS }),
              chimneys: [0.5],
            },
          ),
        ],
      ),
      variant(
        "repliB",
        "12 sommets, pignon demandé",
        "Forme découpée : le faîtage ne coupe pas le contour deux fois, toit plat.",
        true,
        [
          spec(
            [
              { x: -5.5, z: -5 },
              { x: 3.5, z: -5 },
              { x: 3.5, z: -3 },
              { x: 5.5, z: -3 },
              { x: 5.5, z: 3 },
              { x: 1.5, z: 3 },
              { x: 1.5, z: 5 },
              { x: -3.5, z: 5 },
              { x: -3.5, z: 3 },
              { x: -5.5, z: 3 },
              { x: -6.5, z: 0 },
              { x: -5.5, z: -2 },
            ],
            6,
            FACADE.render,
            roof("gable", 38, ROOF.tile),
            {
              plinth: { height: 0.5, color: DETAIL.plinthStone },
              openings: openings({ floorHeight: 2.9 }),
            },
          ),
        ],
      ),
    ],
  },
];
