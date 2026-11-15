import { createSpatialGrid } from "../../sim/track/spatialGrid";
import type { DecorBuilding, DecorBuildingKind, Vec3 } from "../../sim/types";
import { project, roundMm, type LatLon, type PlanePoint } from "../gpx";
import { DECOR_HALF_WIDTH } from "./config";
import { resolveTypology } from "./typology";
import type { DecorContext, RawBuilding } from "./types";

// Seuils propres aux bâtiments. Changer une valeur modifie le décor produit : incrémenter `PIPELINE_VERSION`.

/** Deux sommets plus proches que ça sont fusionnés, en mètres */
export const BUILDING_MERGE_DISTANCE = 0.5;
/** Au-delà, l'emprise est simplifiée : le détail d'un mur ne se voit pas à 100 km/h */
export const BUILDING_MAX_VERTICES = 16;
/** Emprise minimale, en m² : en dessous, abri de jardin invisible en course */
export const BUILDING_MIN_AREA = 12;
/** Un sommet dont le triangle avec ses voisins fait moins que ça (m²) est presque aligné : il ne coûte que des triangles */
const BUILDING_FLAT_VERTEX_AREA = 0.05;
export const BUILDING_FLOOR_HEIGHT = 3;
export const BUILDING_DEFAULT_HEIGHT = 6;
export const BUILDING_MIN_HEIGHT = 2.5;
export const BUILDING_MAX_HEIGHT = 40;
export const BUILDING_LIGHT_HEIGHT = 3;
/** Distance minimale au bord de la chaussée, en mètres : une façade de centre-bourg peut mordre sur le bas-côté, jamais sur la route */
export const BUILDING_ROAD_CLEARANCE = 0.5;
/**
 * Pas d'échantillonnage des murs pour le test de la route, égal à la marge. La distance au bord varie d'au plus 1 m
 * par mètre : entre deux échantillons à 0,5 m ou plus du bord, aucun point du mur n'est à moins de 0,25 m.
 */
const EDGE_SAMPLE_STEP = BUILDING_ROAD_CLEARANCE;
const AXIS_GRID_CELL = 25;
/** Un mur est mitoyen si son milieu passe à moins de ça d'un mur voisin, en mètres (tolérance du labo) */
const PARTY_TOLERANCE = 0.3;
/** Un mur plus court n'est jamais mitoyen : un angle qui frôle le voisin ne compte pas */
const PARTY_MIN_LENGTH = 1;
const PARTY_GRID_CELL = 20;

/** Arrondi au centimètre, sans -0 qui changerait l'empreinte */
const roundCm = (value: number): number => Math.round(value * 100) / 100 + 0;

const distance = (a: PlanePoint, b: PlanePoint): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

/** Aire signée dans le plan (x, z). Négative = sens anti-horaire vu du dessus (z vers le sud, donc vers le bas de la carte). */
const signedArea = (ring: PlanePoint[]): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return sum / 2;
};

/** Centre de gravité de la surface : un bâtiment en L a son centre là où pèse la matière */
const centroid = (ring: PlanePoint[], area: number): PlanePoint => {
  let x = 0;
  let z = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const cross = a.x * b.z - b.x * a.z;
    x += (a.x + b.x) * cross;
    z += (a.z + b.z) * cross;
  }
  return { x: x / (6 * area), z: z / (6 * area) };
};

/** Sommets successifs trop proches fusionnés, fermeture comprise. */
const mergeClose = (ring: PlanePoint[], tolerance: number): PlanePoint[] => {
  const kept: PlanePoint[] = [];
  for (const point of ring) {
    const last = kept[kept.length - 1];
    if (!last || distance(point, last) >= tolerance) kept.push(point);
  }
  while (
    kept.length > 1 &&
    distance(kept[0], kept[kept.length - 1]) < tolerance
  )
    kept.pop();
  return kept;
};

const triangleArea = (a: PlanePoint, b: PlanePoint, c: PlanePoint): number =>
  Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / 2;

/** Visvalingam : retire le sommet qui porte le moins de surface, jusqu'au plafond de sommets et sans sommet presque aligné. */
const simplify = (ring: PlanePoint[]): PlanePoint[] => {
  const points = ring.slice();
  while (points.length > 3) {
    let weakest = -1;
    let weakestArea = Infinity;
    for (let i = 0; i < points.length; i++) {
      const area = triangleArea(
        points[(i + points.length - 1) % points.length],
        points[i],
        points[(i + 1) % points.length],
      );
      // Inégalité stricte : à égalité, le premier sommet, pour un résultat fixe.
      if (area < weakestArea) {
        weakest = i;
        weakestArea = area;
      }
    }
    if (
      points.length <= BUILDING_MAX_VERTICES &&
      weakestArea >= BUILDING_FLAT_VERTEX_AREA
    )
      break;
    points.splice(weakest, 1);
  }
  return points;
};

/** Départ au sommet le plus à l'ouest (puis au nord) : la même emprise s'écrit toujours de la même façon. */
const canonicalStart = (ring: PlanePoint[]): PlanePoint[] => {
  let start = 0;
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i];
    const s = ring[start];
    if (p.x < s.x || (p.x === s.x && p.z < s.z)) start = i;
  }
  return [...ring.slice(start), ...ring.slice(0, start)];
};

/** Emprise locale propre, anti-horaire vu du dessus, au centimètre. `null` si trop petite ou dégénérée. */
const footprintOf = (
  exterior: LatLon[],
  origin: LatLon,
): { ring: PlanePoint[]; area: number } | null => {
  if (exterior.length < 3) return null;
  const merged = mergeClose(
    exterior.map((point) => project(point, origin)),
    BUILDING_MERGE_DISTANCE,
  );
  if (merged.length < 3) return null;
  // L'arrondi peut confondre deux sommets voisins : seuls les doublons exacts sont retirés.
  const rounded = mergeClose(
    simplify(merged).map((p) => ({ x: roundCm(p.x), z: roundCm(p.z) })),
    0.005,
  );
  if (rounded.length < 3) return null;
  const area = signedArea(rounded);
  if (Math.abs(area) < BUILDING_MIN_AREA) return null;
  const ring = canonicalStart(area > 0 ? rounded.slice().reverse() : rounded);
  return { ring, area: -Math.abs(area) };
};

const segmentDistance = (
  p: PlanePoint,
  a: PlanePoint,
  b: PlanePoint,
): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  const t =
    length2 > 0
      ? Math.min(
          1,
          Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2),
        )
      : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
};

/** Distance horizontale exacte à l'axe, par grille : au-delà du couloir, `Infinity`. */
const createAxisDistance = (axis: Vec3[]): ((p: PlanePoint) => number) => {
  const grid = createSpatialGrid(AXIS_GRID_CELL);
  const segments = Math.max(axis.length - 1, 1);
  const end = (i: number): Vec3 => axis[Math.min(i + 1, axis.length - 1)];
  for (let i = 0; i < segments; i++) {
    const a = axis[i];
    const b = end(i);
    grid.insert(
      i,
      Math.min(a.x, b.x),
      Math.min(a.z, b.z),
      Math.max(a.x, b.x),
      Math.max(a.z, b.z),
    );
  }
  const maxRing = Math.ceil(DECOR_HALF_WIDTH / AXIS_GRID_CELL) + 1;
  return (p) => {
    const cx = Math.floor(p.x / AXIS_GRID_CELL);
    const cz = Math.floor(p.z / AXIS_GRID_CELL);
    let best = Infinity;
    for (let r = 0; r <= maxRing; r++) {
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const ids = grid.at(cx + dx, cz + dz);
          if (!ids) continue;
          for (const id of ids)
            best = Math.min(best, segmentDistance(p, axis[id], end(id)));
        }
      // Toute case de l'anneau suivant est au moins à r cases du point.
      if (best <= r * AXIS_GRID_CELL) break;
    }
    return best;
  };
};

// Une `Map` plutôt qu'un objet : un usage nommé « toString » ne doit rien trouver.
const KIND_BY_USAGE = new Map<string, DecorBuildingKind>([
  ["Résidentiel", "house"],
  ["Agricole", "farm"],
  ["Industriel", "industrial"],
  ["Commercial et services", "industrial"],
  ["Religieux", "church"],
]);

const kindOf = (usage: string | null): DecorBuildingKind =>
  (usage !== null ? KIND_BY_USAGE.get(usage.trim()) : undefined) ?? "other";

/** Niveaux, rez-de-chaussée compris : `nombre_d_etages`, sinon la hauteur par tranches de 3 m. */
const floorsOf = (raw: RawBuilding, wall: number): number =>
  raw.floors !== null && raw.floors >= 1
    ? Math.min(Math.round(raw.floors), Math.ceil(BUILDING_MAX_HEIGHT / 2))
    : Math.max(1, Math.round(wall / BUILDING_FLOOR_HEIGHT));

/** Hauteur des murs : IGN, sinon étages, sinon valeur par défaut. Une construction légère reste basse. */
const wallHeight = (raw: RawBuilding): number => {
  if (raw.light) return BUILDING_LIGHT_HEIGHT;
  const height =
    raw.height !== null && Number.isFinite(raw.height) && raw.height > 0
      ? raw.height
      : raw.floors !== null && Number.isFinite(raw.floors) && raw.floors > 0
        ? raw.floors * BUILDING_FLOOR_HEIGHT
        : BUILDING_DEFAULT_HEIGHT;
  return Math.min(BUILDING_MAX_HEIGHT, Math.max(BUILDING_MIN_HEIGHT, height));
};

/** Points du contour tous les `EDGE_SAMPLE_STEP` mètres, sommets compris. */
const edgeSamples = (ring: PlanePoint[]): PlanePoint[] => {
  const samples: PlanePoint[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const steps = Math.max(1, Math.ceil(distance(a, b) / EDGE_SAMPLE_STEP));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      samples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return samples;
};

interface Placed {
  ring: PlanePoint[];
  area: number;
  base: number;
  height: number;
  wall: number;
  raw: RawBuilding;
  axisDistance: number;
  id: string;
  part: number;
}

/** Murs mitoyens de chaque emprise : milieu à moins de `PARTY_TOLERANCE` d'un mur d'une autre emprise. */
const partyWalls = (rings: PlanePoint[][]): number[][] => {
  const grid = createSpatialGrid(PARTY_GRID_CELL);
  rings.forEach((ring, id) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    grid.insert(
      id,
      minX - PARTY_TOLERANCE,
      minZ - PARTY_TOLERANCE,
      maxX + PARTY_TOLERANCE,
      maxZ + PARTY_TOLERANCE,
    );
  });
  return rings.map((ring, self) => {
    const party: number[] = [];
    ring.forEach((a, k) => {
      const b = ring[(k + 1) % ring.length];
      if (distance(a, b) < PARTY_MIN_LENGTH) return;
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const ids =
        grid.at(
          Math.floor(mid.x / PARTY_GRID_CELL),
          Math.floor(mid.z / PARTY_GRID_CELL),
        ) ?? [];
      const touches = ids.some(
        (id) =>
          id !== self &&
          rings[id].some(
            (p, i, other) =>
              segmentDistance(mid, p, other[(i + 1) % other.length]) <
              PARTY_TOLERANCE,
          ),
      );
      if (touches) party.push(k);
    });
    return party;
  });
};

/** Mur côté route : le mur non mitoyen dont le milieu est le plus près de l'axe (tous mitoyens : le plus près). */
const streetWall = (
  ring: PlanePoint[],
  party: number[],
  axisDistance: (p: PlanePoint) => number,
): number => {
  let best = -1;
  let bestDistance = Infinity;
  let bestParty = true;
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length];
    const isParty = party.includes(k);
    const d = axisDistance({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    // Un mur libre l'emporte toujours sur un mur mitoyen ; à égalité, le premier.
    if ((bestParty && !isParty) || (bestParty === isParty && d < bestDistance)) {
      best = k;
      bestDistance = d;
      bestParty = isParty;
    }
  });
  return Math.max(best, 0);
};

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** Bâtiments bruts vers emprises locales prêtes à extruder (story 5.2). Pure : mêmes entrées, même résultat au bit près. */
export const buildBuildings = (
  raw: RawBuilding[],
  context: DecorContext,
  /** `code_insee` du département, pour les toitures régionales ; `null` : tuile plate */
  department: string | null = null,
): DecorBuilding[] => {
  if (raw.length === 0 || context.axis.length === 0) return [];
  const axisDistance = createAxisDistance(context.axis);
  let maxWidth = 0;
  for (const width of context.widths) maxWidth = Math.max(maxWidth, width);
  // Au-delà de cette distance à l'axe, aucun point de l'emprise ne peut toucher la marge de la route.
  const safeDistance =
    maxWidth / 2 + BUILDING_ROAD_CLEARANCE + EDGE_SAMPLE_STEP;

  const placed: Placed[] = [];
  for (const source of raw) {
    source.polygons.forEach((rings, part) => {
      // Un MultiPolygon donne un bâtiment par bloc ; les cours intérieures sont ignorées.
      const footprint = rings[0] ? footprintOf(rings[0], context.origin) : null;
      if (!footprint) return;
      const { ring, area } = footprint;
      const center = centroid(ring, area);
      const toAxis = axisDistance(center);
      if (toAxis > DECOR_HALF_WIDTH) return;

      let radius = 0;
      for (const p of ring) radius = Math.max(radius, distance(p, center));
      if (toAxis - radius < safeDistance) {
        const probes = [center, ...edgeSamples(ring)];
        if (
          probes.some(
            (p) => context.roadClearance(p.x, p.z) < BUILDING_ROAD_CLEARANCE,
          )
        )
          return;
      }

      // Pied au point le plus bas du sol : jamais en l'air, enterré côté amont.
      const centerGround = context.groundAt(center.x, center.z);
      if (centerGround === null) return;
      let base = centerGround;
      for (const p of ring) {
        const ground = context.groundAt(p.x, p.z);
        if (ground === null) return;
        base = Math.min(base, ground);
      }
      // La hauteur réelle se lit au centre : la partie enterrée par la pente s'y ajoute.
      const wall = wallHeight(source);
      const height = roundCm(wall + (centerGround - base));

      placed.push({
        ring,
        area: -area,
        base: roundMm(base),
        height,
        wall,
        raw: source,
        axisDistance: roundMm(toAxis),
        id: source.id,
        part,
      });
    });
  }

  // Tri total : distance à l'axe, puis position, puis identifiant IGN. L'ordre d'arrivée ne compte plus.
  placed.sort(
    (a, b) =>
      a.axisDistance - b.axisDistance ||
      a.ring[0].x - b.ring[0].x ||
      a.ring[0].z - b.ring[0].z ||
      compareText(a.id, b.id) ||
      a.part - b.part,
  );
  // Mitoyenneté sur l'ensemble des emprises gardées : elle ne dépend pas de l'ordre, seulement des voisins.
  const party = partyWalls(placed.map((entry) => entry.ring));
  return placed.map((entry, i): DecorBuilding => {
    const floors = floorsOf(entry.raw, entry.wall);
    const typology = resolveTypology({
      raw: entry.raw,
      ring: entry.ring,
      area: entry.area,
      wallHeight: entry.wall,
      floors,
      hasParty: party[i].length > 0,
      department,
    });
    return {
      footprint: entry.ring,
      base: entry.base,
      height: entry.height,
      kind: kindOf(entry.raw.usage),
      type: typology.type,
      floors,
      roof: typology.roof,
      roofMaterial: typology.roofMaterial,
      wallMaterial: typology.wallMaterial,
      party: party[i],
      street: streetWall(entry.ring, party[i], axisDistance),
    };
  });
};
