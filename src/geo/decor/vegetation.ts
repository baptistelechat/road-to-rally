import { createPolygonTest } from "../../sim/track/decorFootprints";
import { MAX_TREE_SLOPE, slopeAt } from "../../sim/track/scenery";
import type { DecorBuilding, DecorTree, DecorTreeKind } from "../../sim/types";
import { project, roundMm, type LatLon, type PlanePoint } from "../gpx";
import { DECOR_HALF_WIDTH } from "./config";
import type { DecorContext, RawArea, RawLine } from "./types";

/** Au-delà, on garde les arbres les plus proches de la route : au-delà, le FPS chute en forêt */
const MAX_TREES = 20000;
/** Plafonds séparés des buissons de haie (24 km de haie) et des modules de vigne (10 ha) : ils ne volent pas la place des arbres */
const MAX_BUSHES = 10000;
const MAX_VINE_ROWS = 10000;
/** Dégagement minimal au bord de la route, en mètres : le même que la végétation de la story 1.7 */
const ROAD_CLEARANCE = 7;
/** Buissons de haie seuls : 3 m du bord, les haies de bord de route restent (objets légers renversables près de la route) */
const BUSH_ROAD_CLEARANCE = 3;
/** Dégagement autour d'un bâtiment, en mètres : pas de tronc dans un mur */
const BUILDING_CLEARANCE = 1.5;
/** Dégagement à la berge, en mètres : pas de tronc les pieds dans l'eau */
const WATER_CLEARANCE = 1;
/** Pas des buissons « boules fusionnées » le long d'une haie, en mètres : module de 3 m, ils se recouvrent (labo) */
const BUSH_SPACING = 2.4;
/** Écart entre deux rangées de buissons dans une haie dessinée en surface, en mètres */
const BUSH_ROW_SPACING = 2.2;
/** Écart latéral maximal d'un buisson de part et d'autre de la ligne, en mètres */
const BUSH_JITTER = 0.2;
/** Écart de cap d'un buisson autour de la ligne, en radians (labo) */
const BUSH_YAW_JITTER = 0.5;
/** Échelle des buissons : hauteur de 1,8 à 2,6 m, jamais plus courts que leur pas (pas de trou dans la haie) */
const BUSH_MIN_SCALE = 0.85;
const BUSH_MAX_SCALE = 1.25;
/** Un chêne de haie tous les 25 m en moyenne */
const HEDGE_OAK_SPACING = 25;
const OAK_MIN_SCALE = 0.9;
const OAK_MAX_SCALE = 1.35;
/** Module de rang de vigne et écart entre rangs, en mètres (labo) */
const VINE_MODULE = 5;
const VINE_ROW_SPACING = 2;
/** `code_group` RPG des vignes */
const RPG_VINE_GROUP = "21";
/** Côté de la maille du masque de couloir, en mètres : évite de parcourir une forêt de plusieurs km² */
const CORRIDOR_CELL = 50;
/** Côté de la maille de l'index des bâtiments, en mètres */
const BUILDING_CELL = 50;

/** Essences d'arbres d'un peuplement et leurs parts, en cumul croissant jusqu'à 1 (labo végétation). */
type Mix = readonly (readonly [DecorTreeKind, number])[];

/** Échelles d'instance par essence (labo) : un peuplier à 1,75 dépasserait 20 m. */
const SPECIES_SCALE: Partial<Record<DecorTreeKind, readonly [number, number]>> =
  {
    tree: [0.85, 1.35],
    oakTiered: [0.85, 1.3],
    poplar: [0.9, 1.15],
    birch: [0.8, 1.2],
    willow: [0.85, 1.2],
    pine: [0.85, 1.6],
    scotsPine: [0.85, 1.3],
    fruitTree: [0.85, 1.1],
    deadTree: [0.8, 1.2],
  };

// Répartitions du labo (`Recommendations.tsx`), parts cumulées.
/** Feuillus : chêne 50 %, étagé 30 %, bouleau 18 %, arbre mort 2 % */
const BROADLEAF: Mix = [
  ["tree", 0.5],
  ["oakTiered", 0.8],
  ["birch", 0.98],
  ["deadTree", 1],
];
/** Conifères : sapin 60 %, pin sylvestre 40 % */
const CONIFER: Mix = [
  ["pine", 0.6],
  ["scotsPine", 1],
];
/** Mixte : moitié feuillus, moitié conifères, mêmes proportions dans chaque moitié */
const MIXED: Mix = [
  ["tree", 0.25],
  ["oakTiered", 0.4],
  ["birch", 0.49],
  ["deadTree", 0.5],
  ["pine", 0.8],
  ["scotsPine", 1],
];
/** Forêt ouverte : plus de bouleaux et de pins sylvestres, les pionniers */
const OPEN_BROADLEAF: Mix = [
  ["tree", 0.4],
  ["oakTiered", 0.65],
  ["birch", 0.98],
  ["deadTree", 1],
];
const OPEN_CONIFER: Mix = [
  ["pine", 0.45],
  ["scotsPine", 1],
];
const OPEN_MIXED_MIX: Mix = [
  ["tree", 0.2],
  ["oakTiered", 0.32],
  ["birch", 0.49],
  ["deadTree", 0.5],
  ["pine", 0.72],
  ["scotsPine", 1],
];
/** Bois : mixte à dominante feuillue, chêne, étagé, bouleau et 20 % de sapin */
const WOOD: Mix = [
  ["tree", 0.4],
  ["oakTiered", 0.65],
  ["birch", 0.8],
  ["pine", 1],
];

/** Une façon de peupler une zone : une grille, jitterée ou non, d'un arbre par maille. */
interface Planting {
  /** Distingue les tirages de deux peuplements qui partagent une maille */
  salt: number;
  /** Côté de la maille, en mètres : la racine de la surface par arbre */
  cell: number;
  /** Part de la maille sur laquelle l'arbre peut bouger : 0 donne des rangs réguliers */
  jitter: number;
  mix: Mix;
}

const forest = (salt: number, areaPerTree: number, mix: Mix): Planting => ({
  salt,
  cell: Math.sqrt(areaPerTree),
  jitter: 0.9,
  mix,
});

// Densités de la fiche : 1 arbre pour 60 m² en forêt fermée, 1 pour 150 m² en forêt ouverte.
const CLOSED_PINE = forest(1, 60, CONIFER);
const CLOSED_TREE = forest(2, 60, BROADLEAF);
const CLOSED_MIXED = forest(3, 60, MIXED);
const OPEN_PINE = forest(4, 150, OPEN_CONIFER);
const OPEN_TREE = forest(5, 150, OPEN_BROADLEAF);
const OPEN_MIXED = forest(6, 150, OPEN_MIXED_MIX);
const CLOSED_WOOD = forest(12, 60, WOOD);
/** Peupleraie : peupliers en rangs réguliers, comme le verger (labo) */
const POPLAR_ROWS: Planting = {
  salt: 7,
  cell: 7,
  jitter: 0,
  mix: [["poplar", 1]],
};
/** Verger : fruitiers en rangs réguliers */
const ORCHARD: Planting = {
  salt: 8,
  cell: 7,
  jitter: 0,
  mix: [["fruitTree", 1]],
};
const HEDGE_SALT = 9;
const VINE_SALT = 10;
const WILLOW_SALT = 11;
/** Un feuillu à moins de cette distance d'une berge peut devenir un saule, en mètres (labo) */
const WILLOW_REACH = 15;
/** Part des feuillus de bord d'eau changés en saules : une ripisylve, pas un rideau uniforme */
const WILLOW_SHARE = 0.5;
/** Feuillus qu'un bord d'eau change en saule ; ni conifères, ni fruitiers, ni peupliers en rangs */
const WILLOW_CANDIDATES: ReadonlySet<DecorTreeKind> = new Set<DecorTreeKind>([
  "tree",
  "oakTiered",
  "birch",
]);

/** Essence d'un tirage dans [0, 1[ : la première dont la part cumulée dépasse le tirage. */
const pick = (mix: Mix, roll: number): DecorTreeKind => {
  for (const [kind, upTo] of mix) if (roll < upTo) return kind;
  return mix[mix.length - 1][0];
};

/** Échelle d'une essence pour un tirage dans [0, 1[. */
const scaleOf = (kind: DecorTreeKind, roll: number): number => {
  const [min, max] = SPECIES_SCALE[kind] ?? [1, 1];
  return min + roll * (max - min);
};

const normalize = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const isHedgeArea = (nature: string): boolean =>
  normalize(nature).includes("haie");
const isVineArea = (nature: string): boolean =>
  normalize(nature).includes("vigne");

/** Peuplement en grille d'une zone selon sa `nature` BD TOPO, `null` sans arbres (haie et vigne à part, lande, inconnue). */
const plantingOf = (nature: string): Planting | null => {
  const text = normalize(nature);
  if (text.includes("vigne") || text.includes("lande") || text.includes("haie"))
    return null;
  if (text.includes("verger")) return ORCHARD;
  if (text.includes("peupleraie")) return POPLAR_ROWS;
  const pine = text.includes("conif");
  const mixed = text.includes("mixte");
  if (text.includes("ouverte"))
    return pine
      ? OPEN_PINE
      : mixed
        ? OPEN_MIXED
        : text.includes("feuill")
          ? OPEN_TREE
          : OPEN_MIXED;
  if (text.includes("fermee") || text.includes("foret"))
    return pine ? CLOSED_PINE : mixed ? CLOSED_MIXED : CLOSED_TREE;
  // « Bois » sans précision : mixte à dominante feuillue (labo).
  if (text.includes("bois"))
    return pine ? CLOSED_PINE : mixed ? CLOSED_MIXED : CLOSED_WOOD;
  return null;
};

// Hachage entier des coordonnées d'une maille, comme le sol de `groundMesh.ts` : jamais Math.random.
const hash = (x: number, z: number, salt: number): number => {
  let h =
    Math.imul(x, 374761393) +
    Math.imul(z, 668265263) +
    Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Point dans un contour fermé, règle pair-impair. */
const inRing = (ring: PlanePoint[], x: number, z: number): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.z > z !== b.z > z &&
      x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
};

/** Distance d'un point au contour, pour la marge autour des bâtiments. */
const distanceToRing = (ring: PlanePoint[], x: number, z: number): number => {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = dx * dx + dz * dz;
    const t =
      length === 0
        ? 0
        : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / length));
    best = Math.min(best, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
  }
  return best;
};

const cellKey = (ix: number, iz: number): string => `${ix},${iz}`;

/** Rectangle englobant orienté d'aire minimale, axe u le long de son plus long côté. */
interface OrientedBox {
  ux: number;
  uz: number;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
}

// ponytail: O(n²) sur les arêtes du contour ; enveloppe convexe d'abord si des contours de milliers de sommets ralentissent.
const orientedBox = (ring: PlanePoint[]): OrientedBox | null => {
  let best: OrientedBox | null = null;
  let bestArea = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length === 0) continue;
    const ux = (b.x - a.x) / length;
    const uz = (b.z - a.z) / length;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of ring) {
      const u = p.x * ux + p.z * uz;
      const v = p.z * ux - p.x * uz;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    // Inégalité stricte : à égalité, la première arête gagne, le résultat ne dépend que du contour.
    if (area < bestArea) {
      bestArea = area;
      best = { ux, uz, minU, maxU, minV, maxV };
    }
  }
  if (!best || best.maxU - best.minU >= best.maxV - best.minV) return best;
  // Côté v plus long : l'axe tourne d'un quart de tour, v devient u et -u devient v.
  return {
    ux: -best.uz,
    uz: best.ux,
    minU: best.minV,
    maxU: best.maxV,
    minV: -best.maxU,
    maxV: -best.minU,
  };
};

/** Mailles grossières à moins de la demi-largeur du décor de l'axe : seules zones où chercher des arbres. */
const corridorCells = (context: DecorContext): Set<string> => {
  const cells = new Set<string>();
  const reach = DECOR_HALF_WIDTH + Math.max(0, ...context.widths) / 2;
  let last: PlanePoint | null = null;
  context.axis.forEach((p, i) => {
    const isLast = i === context.axis.length - 1;
    // Un point toutes les demi-mailles suffit : les mailles ajoutées débordent de la portée.
    if (
      last &&
      !isLast &&
      Math.hypot(p.x - last.x, p.z - last.z) < CORRIDOR_CELL / 2
    )
      return;
    last = p;
    const reachOf = reach + CORRIDOR_CELL;
    for (
      let ix = Math.floor((p.x - reachOf) / CORRIDOR_CELL);
      ix <= Math.floor((p.x + reachOf) / CORRIDOR_CELL);
      ix++
    )
      for (
        let iz = Math.floor((p.z - reachOf) / CORRIDOR_CELL);
        iz <= Math.floor((p.z + reachOf) / CORRIDOR_CELL);
        iz++
      )
        cells.add(cellKey(ix, iz));
  });
  return cells;
};

/** Index des bâtiments par maille : chaque arbre ne teste que ses voisins. */
const buildingIndex = (
  buildings: DecorBuilding[],
): ((x: number, z: number) => boolean) => {
  const cells = new Map<string, DecorBuilding[]>();
  for (const building of buildings) {
    const xs = building.footprint.map((p) => p.x);
    const zs = building.footprint.map((p) => p.z);
    const x0 = Math.floor(
      (Math.min(...xs) - BUILDING_CLEARANCE) / BUILDING_CELL,
    );
    const x1 = Math.floor(
      (Math.max(...xs) + BUILDING_CLEARANCE) / BUILDING_CELL,
    );
    const z0 = Math.floor(
      (Math.min(...zs) - BUILDING_CLEARANCE) / BUILDING_CELL,
    );
    const z1 = Math.floor(
      (Math.max(...zs) + BUILDING_CLEARANCE) / BUILDING_CELL,
    );
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const key = cellKey(ix, iz);
        const list = cells.get(key);
        if (list) list.push(building);
        else cells.set(key, [building]);
      }
  }
  return (x, z) =>
    (
      cells.get(
        cellKey(Math.floor(x / BUILDING_CELL), Math.floor(z / BUILDING_CELL)),
      ) ?? []
    ).some(
      ({ footprint }) =>
        inRing(footprint, x, z) ||
        distanceToRing(footprint, x, z) < BUILDING_CLEARANCE,
    );
};

interface Candidate {
  kind: DecorTreeKind;
  x: number;
  z: number;
  yaw: number;
  scale: number;
  clearance: number;
}

/** Zones de végétation, haies et vignes réelles peuplées d'arbres, buissons et rangs, placement déterministe (story 5.3). Pure. */
export const buildTrees = (
  vegetation: RawArea[],
  hedges: RawLine[],
  /** Parcelles RPG : celles du groupe 21 portent des rangs de vigne */
  fields: RawArea[],
  buildings: DecorBuilding[],
  /** Surfaces d'eau brutes : aucun arbre n'y pousse */
  water: RawArea[],
  context: DecorContext,
): DecorTree[] => {
  const corridor = corridorCells(context);
  const inBuilding = buildingIndex(buildings);
  const candidates: Candidate[] = [];
  // Deux zones qui se chevauchent tirent la même maille : un seul arbre.
  const taken = new Set<string>();
  const toPlane = (ring: LatLon[]): PlanePoint[] =>
    ring.map((point) => project(point, context.origin));
  // Surfaces d'eau entières, trous compris : un îlot garde ses arbres, à distance de sa berge.
  const waterPolygons = water.flatMap((area) =>
    area.polygons.map((polygon) => polygon.map(toPlane)),
  );
  const inWater = createPolygonTest(waterPolygons, WATER_CLEARANCE);
  // Bord d'eau, pour les saules : seuls les feuillus déjà retenus le consultent.
  const nearWater = createPolygonTest(waterPolygons, WILLOW_REACH);

  /** Feuillu de bord d'eau changé en saule une fois sur deux, tirage calé sur la position au décimètre. */
  const riverside = (
    kind: DecorTreeKind,
    x: number,
    z: number,
    scale: number,
  ): [DecorTreeKind, number] => {
    if (!WILLOW_CANDIDATES.has(kind) || !nearWater(x, z)) return [kind, scale];
    const ix = Math.round(x * 10);
    const iz = Math.round(z * 10);
    if (hash(ix, iz, WILLOW_SALT) >= WILLOW_SHARE) return [kind, scale];
    return ["willow", scaleOf("willow", hash(ix, iz, WILLOW_SALT + 100))];
  };

  /** Tests bon marché d'abord ; le sol et la pente attendent le tri et le plafond. */
  const consider = (
    kind: DecorTreeKind,
    rawX: number,
    rawZ: number,
    yaw: number,
    scale: number,
  ): void => {
    const x = roundMm(rawX);
    const z = roundMm(rawZ);
    const clearance = context.roadClearance(x, z);
    const minimum = kind === "bush" ? BUSH_ROAD_CLEARANCE : ROAD_CLEARANCE;

    if (clearance < minimum || clearance > DECOR_HALF_WIDTH) return;
    if (inBuilding(x, z) || inWater(x, z)) return;
    const [species, size] = riverside(kind, x, z, scale);
    candidates.push({
      kind: species,
      x,
      z,
      yaw: roundMm(yaw),
      scale: roundMm(size),
      clearance: roundMm(clearance),
    });
  };

  for (const area of vegetation) {
    const planting = plantingOf(area.nature);
    if (!planting) continue;
    const { cell, salt, jitter } = planting;
    for (const polygon of area.polygons) {
      const rings = polygon.map(toPlane).filter((ring) => ring.length >= 3);
      if (rings.length === 0) continue;
      const [outer, ...holes] = rings;
      // Sans étalement : un grand massif forestier peut compter des dizaines de milliers de sommets.
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of outer) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }
      // Mailles grossières du couloir dans l'emprise de la zone, puis mailles fines alignées sur une grille globale.
      for (
        let cx = Math.floor(minX / CORRIDOR_CELL);
        cx <= Math.floor(maxX / CORRIDOR_CELL);
        cx++
      )
        for (
          let cz = Math.floor(minZ / CORRIDOR_CELL);
          cz <= Math.floor(maxZ / CORRIDOR_CELL);
          cz++
        ) {
          if (!corridor.has(cellKey(cx, cz))) continue;
          const x0 = Math.max(minX, cx * CORRIDOR_CELL);
          const x1 = Math.min(maxX, (cx + 1) * CORRIDOR_CELL);
          const z0 = Math.max(minZ, cz * CORRIDOR_CELL);
          const z1 = Math.min(maxZ, (cz + 1) * CORRIDOR_CELL);
          for (
            let ix = Math.floor(x0 / cell);
            ix <= Math.floor(x1 / cell);
            ix++
          )
            for (
              let iz = Math.floor(z0 / cell);
              iz <= Math.floor(z1 / cell);
              iz++
            ) {
              const key = `${salt}:${ix},${iz}`;
              if (taken.has(key)) continue;
              const offset = (1 - jitter) / 2;
              const x = (ix + offset + hash(ix, iz, salt) * jitter) * cell;
              const z =
                (iz + offset + hash(ix, iz, salt + 100) * jitter) * cell;
              if (
                !inRing(outer, x, z) ||
                holes.some((hole) => inRing(hole, x, z))
              )
                continue;
              taken.add(key);
              const kind = pick(planting.mix, hash(ix, iz, salt + 200));
              consider(
                kind,
                x,
                z,
                hash(ix, iz, salt + 300) * Math.PI * 2,
                scaleOf(kind, hash(ix, iz, salt + 400)),
              );
            }
        }
    }
  }

  const inCorridor = (x: number, z: number): boolean =>
    corridor.has(
      cellKey(Math.floor(x / CORRIDOR_CELL), Math.floor(z / CORRIDOR_CELL)),
    );

  /**
   * Grille alignée sur le rectangle englobant orienté du contour extérieur : `step` le long des rangs, `gap` entre
   * rangs, centrée sur le rectangle. `visit` reçoit chaque point du couloir dans la zone (hors trous) et le sens des rangs.
   */
  const orientedRings = (
    rings: PlanePoint[][],
    step: number,
    gap: number,
    visit: (x: number, z: number, ux: number, uz: number) => void,
  ): void => {
    const [outer, ...holes] = rings;
    const box = orientedBox(outer);
    if (!box) return;
    const { ux, uz, minU, maxU, minV, maxV } = box;
    const along = Math.max(1, Math.floor((maxU - minU) / step));
    const across = Math.max(1, Math.floor((maxV - minV) / gap));
    const u0 = (minU + maxU - along * step) / 2 + step / 2;
    const v0 = (minV + maxV - across * gap) / 2 + gap / 2;
    for (let r = 0; r < across; r++)
      for (let k = 0; k < along; k++) {
        const u = u0 + k * step;
        const v = v0 + r * gap;
        const x = u * ux - v * uz;
        const z = u * uz + v * ux;
        // Couloir d'abord : une grande parcelle hors couloir ne coûte qu'une recherche par point.
        if (!inCorridor(x, z) || !inRing(outer, x, z)) continue;
        if (holes.some((hole) => inRing(hole, x, z))) continue;
        visit(x, z, ux, uz);
      }
  };

  /** Module de rang de vigne : piquet en tête vers -u, tous les rangs dans le même sens ; jamais plus court que 5 m. */
  const plantVine = (x: number, z: number, ux: number, uz: number): void =>
    consider(
      "vineRow",
      x,
      z,
      Math.atan2(-uz, ux),
      1 + hash(Math.round(x * 10), Math.round(z * 10), VINE_SALT) * 0.06,
    );

  /** Buisson de haie et, de loin en loin, un chêne. Tirages calés sur la position au décimètre : indépendants de l'ordre. */
  const plantHedge = (
    bx: number,
    bz: number,
    ux: number,
    uz: number,
    salt: number,
  ): void => {
    const ix = Math.round(bx * 10);
    const iz = Math.round(bz * 10);
    const lateral = (hash(ix, iz, salt) - 0.5) * 2 * BUSH_JITTER;
    // Cap sur la ligne, retourné une fois sur deux : les modules ne se répètent pas.
    const flip = hash(ix, iz, salt + 100) < 0.5 ? Math.PI : 0;
    consider(
      "bush",
      bx - uz * lateral,
      bz + ux * lateral,
      Math.atan2(-uz, ux) +
        flip +
        (hash(ix, iz, salt + 300) - 0.5) * 2 * BUSH_YAW_JITTER,
      BUSH_MIN_SCALE +
        hash(ix, iz, salt + 400) * (BUSH_MAX_SCALE - BUSH_MIN_SCALE),
    );
    if (hash(ix, iz, salt + 500) < BUSH_SPACING / HEDGE_OAK_SPACING)
      consider(
        "tree",
        bx,
        bz,
        hash(ix, iz, salt + 600) * Math.PI * 2,
        OAK_MIN_SCALE +
          hash(ix, iz, salt + 700) * (OAK_MAX_SCALE - OAK_MIN_SCALE),
      );
  };

  // Haies en ligne : un buisson tous les 2,4 m, aligné sur le segment.
  for (const hedge of hedges) {
    const line = toPlane(hedge.line);
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length === 0) continue;
      const ux = (b.x - a.x) / length;
      const uz = (b.z - a.z) / length;
      let d = carry;
      for (; d < length; d += BUSH_SPACING)
        plantHedge(a.x + ux * d, a.z + uz * d, ux, uz, HEDGE_SALT);
      // Reste du pas reporté sur le segment suivant : l'espacement ne se casse pas aux sommets.
      carry = d - length;
    }
  }

  // Haies et vignes dessinées en surface : rangées le long du plus long côté, la BD TOPO ne donne pas le sens des rangs.
  const vinePolygons: PlanePoint[][][] = [];
  for (const area of vegetation) {
    const hedge = isHedgeArea(area.nature);
    if (!hedge && !isVineArea(area.nature)) continue;
    for (const polygon of area.polygons) {
      const rings = polygon.map(toPlane).filter((ring) => ring.length >= 3);
      if (rings.length === 0) continue;
      if (hedge)
        orientedRings(rings, BUSH_SPACING, BUSH_ROW_SPACING, (x, z, ux, uz) =>
          plantHedge(x, z, ux, uz, HEDGE_SALT + 1000),
        );
      else {
        vinePolygons.push(rings);
        orientedRings(rings, VINE_MODULE, VINE_ROW_SPACING, plantVine);
      }
    }
  }
  // Parcelles RPG de vigne, hors des vignes BD TOPO déjà plantées : les deux sources décrivent souvent la même parcelle.
  const inVine = createPolygonTest(vinePolygons, 0);
  for (const area of fields) {
    if (area.nature.trim() !== RPG_VINE_GROUP) continue;
    for (const polygon of area.polygons) {
      const rings = polygon.map(toPlane).filter((ring) => ring.length >= 3);
      if (rings.length === 0) continue;
      orientedRings(rings, VINE_MODULE, VINE_ROW_SPACING, (x, z, ux, uz) => {
        if (!inVine(x, z)) plantVine(x, z, ux, uz);
      });
    }
  }

  // Tri stable et total : distance à la route, puis coordonnées. Les plus proches passent avant le plafond.
  candidates.sort(
    (a, b) => a.clearance - b.clearance || a.x - b.x || a.z - b.z,
  );

  const ground = { groundAt: context.groundAt };
  const trees: DecorTree[] = [];
  // Un plafond par famille : arbres, buissons de haie, modules de vigne.
  const forest = { count: MAX_TREES };
  const left: Record<DecorTreeKind, { count: number }> = {
    tree: forest,
    pine: forest,
    oakTiered: forest,
    poplar: forest,
    birch: forest,
    willow: forest,
    scotsPine: forest,
    fruitTree: forest,
    deadTree: forest,
    bush: { count: MAX_BUSHES },
    vineRow: { count: MAX_VINE_ROWS },
  };
  for (const candidate of candidates) {
    const budget = left[candidate.kind];
    if (budget.count <= 0) continue;
    const y = context.groundAt(candidate.x, candidate.z);
    if (y === null) continue;
    if (slopeAt(ground, candidate.x, candidate.z) > MAX_TREE_SLOPE) continue;
    budget.count--;
    trees.push({
      kind: candidate.kind,
      position: { x: candidate.x, y: roundMm(y), z: candidate.z },
      yaw: candidate.yaw,
      scale: candidate.scale,
    });
  }
  return trees;
};
