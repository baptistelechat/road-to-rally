// Teinte du sol selon l'occupation réelle (story 5.4). Pure, sans `three` ni React : tourne dans le Worker et dans Node.
import type { LatLon } from "../gpx";
import { DECOR_PALETTE, type Rgb } from "../../render/palette";
import { groundColor } from "../../render/track/groundMesh";
import { projectRing, type PlaneRing } from "./landcoverGeometry";
import type { DecorInputs, Rings } from "./types";
import { isOpenWater } from "./waterSurfaces";

export {
  createWaterBed,
  planWater,
  type WaterBed,
  type WaterContext,
  type WaterPlan,
} from "./waterSurfaces";

/**
 * Couleur du sol en (x, z) du plan local, ou `null` pour garder l'herbe de `groundColor`.
 * `dry` : terre sèche dans un polygone d'eau, l'eau n'y compte pas (story 5.9).
 */
export type GroundTint = (
  x: number,
  z: number,
  dry?: boolean,
) => [number, number, number] | null;

/** Taille d'une case de l'index spatial, en mètres */
const CELL = 64;
/** Décalage des indices de case : la spéciale tient dans ±2 000 km, bien au-delà de 15 km */
const OFFSET = 32768;

/** Priorités : la plus petite gagne quand deux surfaces se recouvrent */
const PRIORITY = {
  water: 0,
  wood: 1,
  orchardOrVine: 2,
  parcel: 3,
  built: 4,
} as const;

const { ground } = DECOR_PALETTE;

/**
 * Groupes de culture du RPG (`code_group`, « RPG.LATEST:parcelles_graphiques ») vers une teinte du sol.
 * Absent de la table : la parcelle garde l'herbe par défaut.
 */
const RPG_GROUPS: Record<string, Rgb> = {
  "1": ground.field, // Blé tendre
  "2": ground.field, // Maïs grain et ensilage
  "3": ground.field, // Orge
  "4": ground.field, // Autres céréales
  "5": ground.field, // Colza
  "6": ground.field, // Tournesol
  "7": ground.field, // Autres oléagineux
  "8": ground.field, // Protéagineux
  "9": ground.field, // Plantes à fibres (lin, chanvre)
  "11": ground.meadow, // Gel (surfaces gelées sans production) : couvert herbacé
  "13": ground.meadow, // Autres gels
  "14": ground.field, // Riz
  "15": ground.field, // Légumineuses à grains
  "16": ground.meadow, // Fourrage
  "17": ground.meadow, // Estives et landes
  "18": ground.meadow, // Prairies permanentes
  "19": ground.meadow, // Prairies temporaires
  "20": ground.orchard, // Vergers
  "21": ground.vineyard, // Vignes
  "22": ground.orchard, // Fruits à coque
  "23": ground.orchard, // Oliviers
  "24": ground.field, // Autres cultures industrielles
  "25": ground.field, // Légumes ou fleurs : sol travaillé
  "26": ground.field, // Canne à sucre
  // 28 (Divers) et les codes inconnus : herbe par défaut.
};

/** Minuscules sans accents : la BD TOPO écrit « Forêt fermée de feuillus », « Vigne »… */
const normalize = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** `nature` d'une zone de végétation vers sa teinte et sa priorité. Haies et landes trop fines : rien. */
const vegetationTint = (nature: string): [Rgb, number] | null => {
  const n = normalize(nature);
  if (n.includes("verger")) return [ground.orchard, PRIORITY.orchardOrVine];
  if (n.includes("vigne")) return [ground.vineyard, PRIORITY.orchardOrVine];
  if (n.includes("bois") || n.includes("foret") || n.includes("peupleraie"))
    return [ground.forestFloor, PRIORITY.wood];
  return null;
};

interface Surface {
  rings: PlaneRing[];
  color: Rgb;
  priority: number;
  /** Rang d'insertion : départage deux priorités égales, toujours dans le même ordre */
  order: number;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** Une surface vue depuis une case de l'index */
interface CellEntry {
  surface: Surface;
  /** Arêtes qui touchent la case, en [ax, az, bx, bz] à plat */
  edges: number[];
  /** Le centre de la case est-il dedans ? Calculé à la première demande, puis gardé */
  centerInside: boolean | null;
}

const cellKey = (cx: number, cz: number): number =>
  (cx + OFFSET) * 65536 + (cz + OFFSET);

/** Règle pair-impair sur tous les anneaux (trous compris), demi-ouverte en z */
const insideSurface = (surface: Surface, x: number, z: number): boolean => {
  let inside = false;
  for (const { xs, zs } of surface.rings)
    for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
      if (zs[i] > z === zs[j] > z) continue;
      const cross = xs[j] + ((z - zs[j]) * (xs[i] - xs[j])) / (zs[i] - zs[j]);
      if (x < cross) inside = !inside;
    }
  return inside;
};

const orient = (
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
): number => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);

/**
 * Appartenance d'un point par rapport au centre de sa case : on part de l'état du centre et chaque arête
 * de la case coupée par le segment point-centre l'inverse. Le segment reste dans la case : aucune autre arête ne compte.
 */
const insideFromCenter = (
  entry: CellEntry,
  x: number,
  z: number,
  cx: number,
  cz: number,
): boolean => {
  if (entry.centerInside === null)
    entry.centerInside = insideSurface(entry.surface, cx, cz);
  let inside = entry.centerInside;
  const { edges } = entry;
  for (let e = 0; e < edges.length; e += 4) {
    const ax = edges[e];
    const az = edges[e + 1];
    const bx = edges[e + 2];
    const bz = edges[e + 3];
    if (
      orient(ax, az, bx, bz, x, z) > 0 !== orient(ax, az, bx, bz, cx, cz) > 0 &&
      orient(x, z, cx, cz, ax, az) > 0 !== orient(x, z, cx, cz, bx, bz) > 0
    )
      inside = !inside;
  }
  return inside;
};

/** Index spatial : chaque case connaît les surfaces dont l'emprise la recouvre, triées par priorité. */
const buildIndex = (surfaces: Surface[]): Map<number, CellEntry[]> => {
  const index = new Map<number, CellEntry[]>();
  for (const surface of surfaces) {
    const c0x = Math.floor(surface.minX / CELL);
    const c0z = Math.floor(surface.minZ / CELL);
    const c1x = Math.floor(surface.maxX / CELL);
    const c1z = Math.floor(surface.maxZ / CELL);
    const local = new Map<number, CellEntry>();
    for (let cx = c0x; cx <= c1x; cx++)
      for (let cz = c0z; cz <= c1z; cz++)
        local.set(cellKey(cx, cz), {
          surface,
          edges: [],
          centerInside: null,
        });
    // Chaque arête va dans les cases que recouvre son emprise : un peu large, jamais trop juste.
    for (const { xs, zs } of surface.rings)
      for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
        const e0x = Math.floor(Math.min(xs[i], xs[j]) / CELL);
        const e0z = Math.floor(Math.min(zs[i], zs[j]) / CELL);
        const e1x = Math.floor(Math.max(xs[i], xs[j]) / CELL);
        const e1z = Math.floor(Math.max(zs[i], zs[j]) / CELL);
        for (let cx = e0x; cx <= e1x; cx++)
          for (let cz = e0z; cz <= e1z; cz++)
            local.get(cellKey(cx, cz))?.edges.push(xs[j], zs[j], xs[i], zs[i]);
      }
    for (const [key, entry] of local) {
      const list = index.get(key);
      if (list) list.push(entry);
      else index.set(key, [entry]);
    }
  }
  for (const list of index.values())
    list.sort(
      (a, b) =>
        a.surface.priority - b.surface.priority ||
        a.surface.order - b.surface.order,
    );
  return index;
};

/** Luminance moyenne de l'herbe de `groundColor` : sert de référence pour garder ses taches */
const GRASS_LUMINANCE = 0.3;
/** Part de la couleur de `groundColor` gardée telle quelle : la terre reste visible dans un champ */
const GROUND_SHARE = 0.15;

/** La teinte, modulée par le bruit de `groundColor` : pas d'aplat uniforme. */
const shade = (color: Rgb, x: number, z: number): [number, number, number] => {
  const base = groundColor(x, z);
  const luminance = (base[0] + base[1] + base[2]) / 3;
  const factor = 0.5 + (0.5 * luminance) / GRASS_LUMINANCE;
  const channel = (k: 0 | 1 | 2): number =>
    Math.min(
      1,
      color[k] * factor * (1 - GROUND_SHARE) + base[k] * GROUND_SHARE,
    );
  return [channel(0), channel(1), channel(2)];
};

/**
 * Teinte du terrain selon l'occupation du sol réelle : champs, vignes, bois, eau.
 * Priorité eau > bois > verger et vigne > parcelle RPG > bâti > herbe (`null`).
 * `null` sans données : le terrain garde ses couleurs d'avant, au bit près. Pure.
 */
export const createGroundTint = (
  decor: DecorInputs | null | undefined,
  origin: LatLon,
): GroundTint | null => {
  if (!decor) return null;
  const surfaces: Surface[] = [];
  const add = (
    area: { polygons: Rings[] },
    color: Rgb,
    priority: number,
  ): void => {
    for (const polygon of area.polygons) {
      const rings = polygon
        .map((ring) => projectRing(ring, origin))
        .filter((ring) => ring.xs.length >= 3);
      if (rings.length === 0) continue;
      const { xs, zs } = rings[0];
      surfaces.push({
        rings,
        color,
        priority,
        order: surfaces.length,
        minX: Math.min(...xs),
        minZ: Math.min(...zs),
        maxX: Math.max(...xs),
        maxZ: Math.max(...zs),
      });
    }
  };
  // Un marais ou un conduit busé n'est pas peint en eau : la nappe n'y est pas non plus.
  for (const area of decor.water)
    if (isOpenWater(area.nature))
      add(area, DECOR_PALETTE.water, PRIORITY.water);
  for (const area of decor.vegetation) {
    const tint = vegetationTint(area.nature);
    if (tint) add(area, tint[0], tint[1]);
  }
  for (const area of decor.fields) {
    const color = RPG_GROUPS[area.nature.trim()];
    if (color) add(area, color, PRIORITY.parcel);
  }
  for (const building of decor.buildings)
    add(building, ground.built, PRIORITY.built);
  if (surfaces.length === 0) return null;

  const index = buildIndex(surfaces);
  return (x, z, dry = false) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    const entries = index.get(cellKey(cx, cz));
    if (!entries) return null;
    const centerX = (cx + 0.5) * CELL;
    const centerZ = (cz + 0.5) * CELL;
    for (const entry of entries) {
      const { surface } = entry;
      if (dry && surface.priority === PRIORITY.water) continue;
      if (
        x < surface.minX ||
        x > surface.maxX ||
        z < surface.minZ ||
        z > surface.maxZ
      )
        continue;
      if (insideFromCenter(entry, x, z, centerX, centerZ))
        return shade(surface.color, x, z);
    }
    return null;
  };
};
