// Surfaces d'eau praticables (stories 5.4 et 5.9). Pure et déterministe : mêmes entrées, mêmes nappes au bit près.
// L'eau est à son propre niveau, tiré du relief brut, jamais d'un tablier de pont ; le terrain est creusé dessous.
import { createTrack } from "../../sim/track/createTrack";
import { createSpatialGrid } from "../../sim/track/spatialGrid";
import { createWaterLevel } from "../../sim/track/waterLevel";
import type { DecorWater, Vec3 } from "../../sim/types";
import type { LatLon } from "../gpx";
import {
  clipRing,
  densify,
  insideRings,
  projectRing,
  roundCm,
  signedArea,
  simplifyRing,
  type PlaneRing,
} from "./landcoverGeometry";
import type { DecorInputs } from "./types";

/** Une mare plus petite ne se voit pas à la maille du terrain */
const MIN_AREA = 100;
/** Tolérance de simplification du contour, en mètres */
const SIMPLIFY = 0.5;
/** Pas d'échantillonnage du relief dans l'eau et sur le contour */
const SAMPLE_STEP = 4;
/** Au-delà, le pas grandit : un grand lac ne coûte pas plus qu'une rivière */
const MAX_LEVEL_SAMPLES = 20000;
/** L'eau ne s'approche pas plus du bord d'une route sans pont (gué) */
const ROAD_MARGIN = 1;
/** Plus petite case de la découpe près de la route */
const MIN_CELL = 2;
/** Un morceau plus petit n'apporte rien à l'écran */
const MIN_PIECE_AREA = 0.25;
/** Case d'une eau en pente : chacune garde son propre niveau, en mètres. Petite : peu de pente dans une case */
const WATER_CELL = 32;
/** Écart du relief dans l'eau (décile haut moins décile bas) sous lequel elle garde un seul niveau */
const FLAT_SPREAD = 0.5;
/** Quartile bas du relief dans l'eau : les berges mêlées par l'interpolation tirent vers le haut */
const LEVEL_QUANTILE = 0.25;
/** Fond du relief dans l'eau : le chenal d'un polygone bien plus large que lui */
const LOW_QUANTILE = 0.05;
/** Le niveau ne monte pas plus haut au-dessus de ce fond, en mètres : pas de nappe à hauteur d'une plaine */
const LEVEL_SPAN = 0.4;
/** Échantillons minimum pour le niveau d'une case, sinon ses voisines comptent aussi */
const MIN_CELL_SAMPLES = 3;
/** Plus loin de la route, pas d'eau : le relief fin du couloir (300 m) manque pour creuser le lit */
const WATER_REACH = 320;
/** Un point de structure dans l'eau ou à moins de ça d'une berge : c'est un pont au-dessus de l'eau */
const BRIDGE_WATER_REACH = 5;
/** Profondeur du lit sous la surface, en mètres */
const BED_DEPTH = 0.8;
/** Relief brut plus haut que le niveau d'autant : terre sèche dans le polygone, rien n'y est creusé, en mètres */
const WET_RISE = 1.2;
/** Natures de `surface_hydrographique` qui ne sont pas de l'eau libre en surface (minuscules, sans accents) */
const NOT_OPEN_WATER = [
  "marais",
  "glacier",
  "neve",
  "mangrove",
  "conduit",
  "buse",
  "souterrain",
  "hyporheique",
  "inondable",
  "estran",
];
/** Raccord du lit à la berge, en mètres */
const BED_RAMP = 4;
/** Près d'une route sans pont, rien n'est creusé sous cette distance du bord de la chaussée… */
const FORD_DRY = 3;
/** …et le lit atteint sa profondeur pleine sur cette distance de plus */
const FORD_RAMP = 5;
/** Case des index de route et de berge, en mètres */
const ROAD_CELL = 16;
const BANK_CELL = 8;
/** Portée de la recherche de route sans pont : plus que la demi-diagonale d'une case d'eau */
const ROAD_REACH = 64;

/** Ce que le pipeline sait quand il prépare l'eau, dans le plan local de la spéciale. */
export interface WaterContext {
  origin: LatLon;
  /** Axe unique, altitudes du repère de la spéciale */
  axis: Vec3[];
  widths: number[];
  /** Pont ou tunnel en chaque point de `axis` */
  structures: boolean[];
  /** Relief IGN brut, en altitude locale, `null` hors du couloir fin */
  rawAt: (x: number, z: number) => number | null;
  /** Relief conforme à la route, avant creusement, `null` hors du couloir fin */
  conformAt: (x: number, z: number) => number | null;
}

export interface WaterPlan {
  /** Nappes, dans l'ordre des données : ce que la spéciale garde */
  surfaces: DecorWater[];
  /**
   * Niveau tiré du relief seul, avant le plafond du sol affiché, une valeur par nappe : la terre bien plus haute
   * est sèche. Le plafond (route en déblai) baisse la nappe sans assécher l'eau qu'elle recouvre.
   */
  references: number[];
  /** Polygones d'eau simplifiés, contour puis îles : leurs bords sont les berges */
  polygons: PlaneRing[][];
  /** Vrai en chaque point de l'axe sur un pont au-dessus de l'eau */
  bridged: boolean[];
}

export interface WaterBed {
  /** Niveau de l'eau, `null` hors de l'eau */
  levelAt: (x: number, z: number) => number | null;
  /**
   * Fond du lit sous la nappe, raccordé aux berges et à une route sans pont ; `null` hors de l'eau, ou si le relief
   * brut `raw` (altitude locale, `null` inconnu) y dépasse nettement le niveau : terre sèche, rien à creuser.
   */
  bedAt: (x: number, z: number, raw: number | null) => number | null;
  /** Distance à la berge la plus proche, `Infinity` au-delà de quelques mètres */
  bankDistance: (x: number, z: number) => number;
  /** Dans un polygone d'eau, mais le relief brut `raw` y dépasse nettement le niveau : terre sèche */
  dryAt: (x: number, z: number, raw: number | null) => boolean;
}

/** Minuscules sans accents : la BD TOPO écrit « Écoulement naturel », « Glacier, névé »… */
const normalize = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Eau libre en surface ? Un marais, un glacier ou un conduit busé n'est pas une nappe praticable.
 * Nature absente (anciens caches) : gardée.
 */
export const isOpenWater = (nature: string): boolean => {
  const n = normalize(nature);
  return !NOT_OPEN_WATER.some((word) => n.includes(word));
};

const smooth = (t: number): number => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

const segmentDistance = (
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { distance: number; t: number } => {
  const dx = bx - ax;
  const dz = bz - az;
  const length2 = dx * dx + dz * dz;
  const t =
    length2 > 0
      ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length2))
      : 0;
  return { distance: Math.hypot(px - ax - t * dx, pz - az - t * dz), t };
};

/**
 * Distance au bord de la chaussée la plus proche, les ponts au-dessus de l'eau exclus : c'est la route qui
 * touche l'eau. Sans `exact`, `Infinity` si rien à moins de `ROAD_REACH` : assez pour creuser le lit.
 * Avec, la vraie distance partout : la découpe d'un grand étang en a besoin loin de son centre.
 */
const createFordClearance = (
  axis: Vec3[],
  widths: number[],
  bridged: boolean[],
  exact: boolean,
): ((x: number, z: number) => number) => {
  const grid = createSpatialGrid(ROAD_CELL);
  const all: number[] = [];
  const toEdge = (x: number, z: number, i: number): number => {
    const a = axis[i];
    const b = axis[i + 1];
    const { distance, t } = segmentDistance(x, z, a.x, a.z, b.x, b.z);
    return distance - (widths[i] + (widths[i + 1] - widths[i]) * t) / 2;
  };
  for (let i = 0; i + 1 < axis.length; i++) {
    if (bridged[i] && bridged[i + 1]) continue;
    all.push(i);
    const a = axis[i];
    const b = axis[i + 1];
    grid.insert(
      i,
      Math.min(a.x, b.x),
      Math.min(a.z, b.z),
      Math.max(a.x, b.x),
      Math.max(a.z, b.z),
    );
  }
  const rings = Math.ceil(ROAD_REACH / ROAD_CELL);
  const halfWidest = Math.max(...widths) / 2;
  return (x, z) => {
    const cx = Math.floor(x / ROAD_CELL);
    const cz = Math.floor(z / ROAD_CELL);
    let best = Infinity;
    for (let ox = -rings; ox <= rings; ox++)
      for (let oz = -rings; oz <= rings; oz++)
        for (const i of grid.at(cx + ox, cz + oz) ?? [])
          best = Math.min(best, toEdge(x, z, i));
    // Tout segment à moins de `rings` cases a été vu : au-delà, seul le parcours complet est sûr.
    if (exact && best > rings * ROAD_CELL - halfWidest)
      for (const i of all) best = Math.min(best, toEdge(x, z, i));
    return best;
  };
};

const toOutline = ({ xs, zs }: PlaneRing): { x: number; z: number }[] => {
  const outline: { x: number; z: number }[] = [];
  for (let i = 0; i < xs.length; i++) {
    const point = { x: roundCm(xs[i]), z: roundCm(zs[i]) };
    const last = outline[outline.length - 1];
    if (!last || last.x !== point.x || last.z !== point.z) outline.push(point);
  }
  const first = outline[0];
  const last = outline[outline.length - 1];
  if (outline.length > 1 && first.x === last.x && first.z === last.z)
    outline.pop();
  return outline;
};

/** Polygone découpé par un rectangle, îles comprises. `null` si le contour n'y laisse rien d'utile. */
const clipRings = (
  rings: PlaneRing[],
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): PlaneRing[] | null => {
  const outer = clipRing(rings[0], minX, minZ, maxX, maxZ);
  if (outer.xs.length < 3 || Math.abs(signedArea(outer)) < MIN_PIECE_AREA)
    return null;
  const holes = rings
    .slice(1)
    .map((hole) => clipRing(hole, minX, minZ, maxX, maxZ))
    .filter((hole) => hole.xs.length >= 3 && signedArea(hole) !== 0);
  return [outer, ...holes];
};

/**
 * Découpe récursive en cases autour d'une route sans pont : une case loin de la chaussée garde tout son morceau,
 * une case à cheval sur la marge se redécoupe, la plus petite est jetée. `clearance` est une distance :
 * centre moins demi-diagonale borne toute la case.
 */
const clearPieces = (
  rings: PlaneRing[],
  clearance: (x: number, z: number) => number,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  out: PlaneRing[][],
): void => {
  const piece = clipRings(rings, minX, minZ, maxX, maxZ);
  if (!piece) return;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const halfDiagonal = Math.hypot(width, depth) / 2;
  const clear = clearance((minX + maxX) / 2, (minZ + maxZ) / 2);
  if (clear - halfDiagonal >= ROAD_MARGIN) {
    out.push(piece);
    return;
  }
  if (clear + halfDiagonal < ROAD_MARGIN) return;
  if (Math.max(width, depth) <= MIN_CELL) return;
  // Découpe du plus long côté seulement : des cases proches du carré, moins de morceaux.
  if (width >= depth) {
    const midX = (minX + maxX) / 2;
    clearPieces(piece, clearance, minX, minZ, midX, maxZ, out);
    clearPieces(piece, clearance, midX, minZ, maxX, maxZ, out);
  } else {
    const midZ = (minZ + maxZ) / 2;
    clearPieces(piece, clearance, minX, minZ, maxX, midZ, out);
    clearPieces(piece, clearance, minX, midZ, maxX, maxZ, out);
  }
};

const quantile = (sorted: number[], q: number): number =>
  sorted[Math.floor(q * (sorted.length - 1))];

/** Niveau tiré du relief trié : quartile bas, mais jamais loin au-dessus du fond (le chenal). */
const levelOf = (sorted: number[]): number =>
  Math.min(
    quantile(sorted, LEVEL_QUANTILE),
    quantile(sorted, LOW_QUANTILE) + LEVEL_SPAN,
  );

interface Polygon {
  /** Anneaux projetés tels quels : échantillonnage et ponts */
  rings: PlaneRing[];
  /** Les mêmes, simplifiés : nappes et berges */
  simplified: PlaneRing[];
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** Points de l'axe sur un pont au-dessus de l'eau : chaque suite de structures qui touche l'eau, entière. */
const findBridges = (
  axis: Vec3[],
  structures: boolean[],
  polygons: Polygon[],
): boolean[] => {
  const bridged = axis.map(() => false);
  const nearWater = (x: number, z: number): boolean =>
    polygons.some((polygon) => {
      if (
        x < polygon.minX - BRIDGE_WATER_REACH ||
        x > polygon.maxX + BRIDGE_WATER_REACH ||
        z < polygon.minZ - BRIDGE_WATER_REACH ||
        z > polygon.maxZ + BRIDGE_WATER_REACH
      )
        return false;
      if (insideRings(polygon.rings, x, z)) return true;
      return polygon.rings.some(({ xs, zs }) => {
        for (let i = 0, j = xs.length - 1; i < xs.length; j = i++)
          if (
            segmentDistance(x, z, xs[j], zs[j], xs[i], zs[i]).distance <=
            BRIDGE_WATER_REACH
          )
            return true;
        return false;
      });
    });
  let i = 0;
  while (i < axis.length) {
    if (!structures[i]) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < axis.length && structures[end + 1]) end++;
    let wet = false;
    for (let k = i; k <= end && !wet; k++)
      wet = nearWater(axis[k].x, axis[k].z);
    if (wet) for (let k = i; k <= end; k++) bridged[k] = true;
    i = end + 1;
  }
  return bridged;
};

/**
 * Nappes d'eau de la spéciale, à leur propre niveau, et ce qu'il faut au terrain pour creuser leur lit.
 * `null` sans données de décor : le terrain et la spéciale restent identiques au bit près.
 */
export const planWater = (
  decor: DecorInputs | null | undefined,
  context: WaterContext,
): WaterPlan | null => {
  if (!decor) return null;
  const { axis, widths, rawAt, conformAt } = context;
  const areas = decor.water
    .filter((area) => isOpenWater(area.nature))
    .sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const polygons: Polygon[] = [];
  for (const area of areas)
    for (const polygon of area.polygons) {
      const rings = polygon
        .map((ring) => projectRing(ring, context.origin))
        .filter((ring) => ring.xs.length >= 3);
      if (rings.length === 0) continue;
      const outer = rings[0];
      const surface =
        Math.abs(signedArea(outer)) -
        rings
          .slice(1)
          .reduce((sum, hole) => sum + Math.abs(signedArea(hole)), 0);
      if (surface <= MIN_AREA) continue;
      polygons.push({
        rings,
        simplified: rings.map((ring) => simplifyRing(ring, SIMPLIFY)),
        minX: Math.min(...outer.xs),
        minZ: Math.min(...outer.zs),
        maxX: Math.max(...outer.xs),
        maxZ: Math.max(...outer.zs),
      });
    }

  const bridged = findBridges(axis, context.structures, polygons);
  const ford = createFordClearance(axis, widths, bridged, true);
  const road = createTrack(axis, widths, false);
  const roadClearance = (x: number, z: number): number => {
    const sample = road.nearest(x, z);
    return sample.distance - sample.width / 2;
  };

  const surfaces: DecorWater[] = [];
  const references: number[] = [];
  const kept: PlaneRing[][] = [];
  for (const polygon of polygons) {
    const { rings, simplified, minX, minZ, maxX, maxZ } = polygon;
    // Relief brut dans l'eau : l'IGN y mesure la surface de l'eau, ni le tablier ni le remblai de la route.
    let step = SAMPLE_STEP;
    const boxArea = (maxX - minX) * (maxZ - minZ);
    if (boxArea / (step * step) > MAX_LEVEL_SAMPLES)
      step = Math.sqrt(boxArea / MAX_LEVEL_SAMPLES);
    const samples: { x: number; z: number; y: number }[] = [];
    const columns = Math.ceil((maxX - minX) / step);
    const rows = Math.ceil((maxZ - minZ) / step);
    for (let ix = 0; ix < columns; ix++)
      for (let iz = 0; iz < rows; iz++) {
        const x = minX + (ix + 0.5) * step;
        const z = minZ + (iz + 0.5) * step;
        if (!insideRings(rings, x, z)) continue;
        const y = rawAt(x, z);
        if (y !== null) samples.push({ x, z, y });
      }
    // Une eau plus étroite que le pas : son contour à défaut.
    if (samples.length === 0)
      for (const { x, z } of densify(rings[0], SAMPLE_STEP)) {
        const y = rawAt(x, z);
        if (y !== null) samples.push({ x, z, y });
      }
    // Entièrement hors du relief fin : rien sur quoi la poser.
    if (samples.length === 0) continue;
    const sorted = samples.map((s) => s.y).sort((a, b) => a - b);
    const polygonLevel = levelOf(sorted);
    const flat = quantile(sorted, 0.9) - quantile(sorted, 0.1) <= FLAT_SPREAD;

    // Échantillons rangés par case : le niveau d'une case d'eau en pente ne lit que ses voisins.
    const buckets = new Map<string, number[]>();
    if (!flat)
      for (const { x, z, y } of samples) {
        const key = `${Math.floor(x / WATER_CELL)},${Math.floor(z / WATER_CELL)}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(y);
        else buckets.set(key, [y]);
      }
    const cellLevel = (cx: number, cz: number): number => {
      let values = buckets.get(`${cx},${cz}`) ?? [];
      if (values.length < MIN_CELL_SAMPLES) {
        values = [];
        for (let ox = -1; ox <= 1; ox++)
          for (let oz = -1; oz <= 1; oz++)
            values.push(...(buckets.get(`${cx + ox},${cz + oz}`) ?? []));
      }
      if (values.length < MIN_CELL_SAMPLES) return polygonLevel;
      return levelOf([...values].sort((a, b) => a - b));
    };

    // Une eau plate reste d'un seul tenant ; une eau en pente se découpe en cases, chacune à son niveau.
    const tiles: {
      cx: number;
      cz: number;
      box: [number, number, number, number];
    }[] = [];
    if (flat) tiles.push({ cx: 0, cz: 0, box: [minX, minZ, maxX, maxZ] });
    else
      for (
        let cx = Math.floor(minX / WATER_CELL);
        cx <= Math.floor(maxX / WATER_CELL);
        cx++
      )
        for (
          let cz = Math.floor(minZ / WATER_CELL);
          cz <= Math.floor(maxZ / WATER_CELL);
          cz++
        )
          tiles.push({
            cx,
            cz,
            box: [
              cx * WATER_CELL,
              cz * WATER_CELL,
              (cx + 1) * WATER_CELL,
              (cz + 1) * WATER_CELL,
            ],
          });

    let used = false;
    for (const { cx, cz, box } of tiles) {
      const [x0, z0, x1, z1] = box;
      const tile = clipRings(simplified, x0, z0, x1, z1);
      if (!tile) continue;
      const centerX = (x0 + x1) / 2;
      const centerZ = (z0 + z1) / 2;
      const halfDiagonal = Math.hypot(x1 - x0, z1 - z0) / 2;
      if (roadClearance(centerX, centerZ) - halfDiagonal > WATER_REACH)
        continue;
      // Contour de la case : le relief brut y trouve le chenal d'un polygone trop large (référence de l'eau),
      // le sol affiché y borne la nappe, qui ne monte jamais au-dessus de lui (au gué, celui que la route impose).
      let rawLevel = flat ? polygonLevel : cellLevel(cx, cz);
      let level = rawLevel;
      for (const { x, z } of densify(tile[0], SAMPLE_STEP)) {
        const raw = rawAt(x, z);
        if (raw !== null) rawLevel = Math.min(rawLevel, raw);
        const ground = conformAt(x, z);
        if (ground !== null) level = Math.min(level, ground);
      }
      const reference = roundCm(rawLevel);
      const y = roundCm(Math.min(level, rawLevel));
      const fordClear = ford(centerX, centerZ);
      const pieces: PlaneRing[][] = [];
      if (fordClear - halfDiagonal >= ROAD_MARGIN) pieces.push(tile);
      else clearPieces(tile, ford, x0, z0, x1, z1, pieces);
      for (const piece of pieces) {
        const outline = toOutline(piece[0]);
        if (outline.length < 3) continue;
        const holes = piece
          .slice(1)
          .map(toOutline)
          .filter((hole) => hole.length >= 3);
        surfaces.push(
          holes.length > 0 ? { outline, holes, y } : { outline, y },
        );
        references.push(reference);
        used = true;
      }
    }
    if (used) kept.push(simplified);
  }
  return { surfaces, references, polygons: kept, bridged };
};

/** Lit de l'eau : niveau, fond creusé et distance aux berges, pour le terrain. Pure. */
export const createWaterBed = (
  plan: WaterPlan,
  axis: Vec3[],
  widths: number[],
): WaterBed => {
  const levelAt = createWaterLevel(plan.surfaces);
  // Mêmes contours, au niveau du relief : c'est lui qui dit où l'eau recouvre vraiment le sol.
  const referenceAt = createWaterLevel(
    plan.surfaces.map((surface, i) => ({
      ...surface,
      y: plan.references[i],
    })),
  );
  const dryAt = (x: number, z: number, raw: number | null): boolean => {
    const reference = referenceAt(x, z);
    return reference !== null && raw !== null && raw > reference + WET_RISE;
  };
  const ford = createFordClearance(axis, widths, plan.bridged, false);
  const edges: number[] = [];
  const grid = createSpatialGrid(BANK_CELL);
  for (const rings of plan.polygons)
    for (const { xs, zs } of rings)
      for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
        grid.insert(
          edges.length / 4,
          Math.min(xs[i], xs[j]),
          Math.min(zs[i], zs[j]),
          Math.max(xs[i], xs[j]),
          Math.max(zs[i], zs[j]),
        );
        edges.push(xs[j], zs[j], xs[i], zs[i]);
      }
  // Trois cases de 8 m de côté autour du point : toute berge à moins de 8 m est vue.
  const bankDistance = (x: number, z: number): number => {
    const cx = Math.floor(x / BANK_CELL);
    const cz = Math.floor(z / BANK_CELL);
    let best = Infinity;
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++)
        for (const e of grid.at(cx + ox, cz + oz) ?? []) {
          const o = e * 4;
          best = Math.min(
            best,
            segmentDistance(
              x,
              z,
              edges[o],
              edges[o + 1],
              edges[o + 2],
              edges[o + 3],
            ).distance,
          );
        }
    return best;
  };
  return {
    levelAt,
    bankDistance,
    dryAt,
    bedAt: (x, z, raw) => {
      const level = levelAt(x, z);
      if (level === null) return null;
      // Polygone plus large que l'eau (lit majeur, plaine) : la terre au-dessus du niveau reste, la nappe passe dessous.
      if (dryAt(x, z, raw)) return null;
      const bank = smooth(bankDistance(x, z) / BED_RAMP);
      // Le terrain est conforme à une route sans pont : on n'y creuse rien, puis le lit s'enfonce en s'éloignant.
      const road = smooth((ford(x, z) - FORD_DRY) / FORD_RAMP);
      return level - BED_DEPTH * bank * road;
    },
  };
};
