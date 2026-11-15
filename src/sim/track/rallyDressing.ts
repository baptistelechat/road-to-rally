import {
  BUSH_RADIUS,
  isHay,
  isLightProp,
  RALLY_PROP_SHAPE,
  VINE_HALF_LENGTH,
  VINE_HALF_WIDTH,
} from "../lightProps";
import { CROWD_SPACE, crowdPoseOf } from "./crowdPose";
import { raceCourse, splitGates } from "../splits";
import type {
  RallySceneryKind,
  SceneryItem,
  SceneryKind,
  Track,
  Vec3,
} from "../types";

// Habillage rallye (story 5.5) : placement pur et déterministe, repris du labo « Public et banderoles ».
// Générateur à part, tiré après tout le reste du décor : aucun autre objet ne bouge. Seules les bottes posées
// devant le public d'une épingle cèdent leur place à la barrière de chicane, et le public qui chevaucherait
// quelqu'un ou un objet est retiré à la fin, sans aucun tirage.

const RALLY_KINDS: ReadonlySet<SceneryKind> = new Set<RallySceneryKind>([
  "marshal",
  "rallyTape",
  "rallyTent",
  "rallySail",
  "rallyPlacard",
  "rallyMast",
  "rallyCheckerMast",
  "rallyBanner",
  "rallyBarrier",
]);

export const isRallyKind = (kind: SceneryKind): kind is RallySceneryKind =>
  RALLY_KINDS.has(kind);

/** Une épingle et le côté de son public */
export interface RallyHairpin {
  /** Indice du sommet sur `track.unique.points` */
  apex: number;
  /** Côté extérieur : -1 à gauche, 1 à droite */
  side: number;
  /** Courbure au sommet, en valeur absolue */
  curvature: number;
}

export interface RallyDressingInput {
  track: Track;
  seed: number;
  /** Décor final, dans son ordre : seules des bottes en sortent, le reste garde sa place */
  items: SceneryItem[];
  /** Épingles où au moins un spectateur est resté */
  hairpins: RallyHairpin[];
  /** Abscisse de l'arche de départ (celle de `startArch`) */
  startS: number;
  inBuilding: (x: number, z: number) => boolean;
  inWater: (x: number, z: number) => boolean;
  /** Filtre des chicanes et des îlots de `generateScenery` */
  clear: (item: SceneryItem) => boolean;
}

// Distances au bord de la route, en mètres : la rubalise devant, l'habillage derrière, le public plus loin.
const TAPE_EDGE = 3.6;
const PROP_EDGE = 4.6;
const BANNER_EDGE = 4.4;
const MAST_EDGE = 4.8;
const MARSHAL_EDGE = 4.2;
const TENT_EDGE = 11.5;
/** Barrière des épingles, à la place des bottes (2,6 + 0,8 m), un peu en retrait des plots */
const BARRIER_EDGE = 3.6;
const HAIRPIN_PROP_EDGE = 5.2;
const HAIRPIN_MARSHAL_EDGE = 5;
/** Rien ne se pose plus près de la route, l'autre branche d'une épingle comprise */
const MIN_EDGE = 2.5;
/** Public : comme le reste du public, jamais à moins de 6 m du bord */
const SPECTATOR_EDGE = 6;
const MAX_SPECTATORS = 600;
const MAX_SLOPE = Math.tan((20 * Math.PI) / 180);
/** Au-delà de cet écart sur son emprise, l'objet flotterait trop : on ne le pose pas, en mètres */
const MAX_LIFT = 0.5;
/** Barrière : écart toléré entre ses deux pieds, en mètres */
const BARRIER_MAX_GAP = 0.3;
const BARRIER_MODULE = 2;
/** Pas des modules le long de la barrière : 5 cm de jour, deux corps ne se chevauchent jamais */
const BARRIER_PITCH = 2.05;
/** Demi-longueur de la barrière de part et d'autre du sommet, le long de l'axe : le public tient sur ±12 m */
const BARRIER_REACH = 13;
const TAPE_MODULE = 5;
const MARGIN = 0.1;
/** Emprises au sol des objets, en mètres (rayon vu du dessus) */
const FOOTPRINT: Partial<Record<SceneryKind, number>> = {
  rallySail: 0.8,
  rallyPlacard: 0.55,
  rallyMast: 0.2,
  rallyCheckerMast: 0.2,
  rallyTent: 2.2,
};

/** Bout de spéciale, en mètres depuis l'arche le long de la route (voir `CONTROL` du labo) */
const CONTROL = {
  tapeFrom: -6,
  tapeTo: 48,
  sails: [-3, 3],
  placards: [5, 6.8],
  banner: 8,
  masts: [13, 14.6, 16.2],
  checkerMast: 17.8,
  tent: 24,
  marshals: [-2.2, 2.2],
  /** Public de l'arrivée : comme celui du départ, centré 26 m après l'arche, sur 40 m */
  crowdCenter: 26,
  crowdSpread: 40,
} as const;

// Générateur mulberry32 : Math.random casserait le déterminisme.
const createRandom = (seed: number): (() => number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

interface Frame {
  point: Vec3;
  /** Sens de la route, unitaire */
  tx: number;
  tz: number;
  /** Cap d'un objet dont l'avant (-Z) regarde dans le sens de la route */
  yaw: number;
  halfWidth: number;
}

interface Disc {
  x: number;
  z: number;
  r: number;
}

interface DiscIndex {
  add: (disc: Disc) => void;
  /** Un disque occupé touche-t-il le segment de `a` à `b`, épaissi de `r` ? */
  hits: (ax: number, az: number, bx: number, bz: number, r: number) => boolean;
}

/** Index des emprises occupées, par mailles de 10 m. */
const createDiscIndex = (): DiscIndex => {
  const CELL = 10;
  const cells = new Map<string, Disc[]>();
  const keys = (x: number, z: number, r: number): string[] => {
    const out: string[] = [];
    for (
      let i = Math.floor((x - r) / CELL);
      i <= Math.floor((x + r) / CELL);
      i++
    )
      for (
        let j = Math.floor((z - r) / CELL);
        j <= Math.floor((z + r) / CELL);
        j++
      )
        out.push(`${i},${j}`);
    return out;
  };
  return {
    add: (disc: Disc): void => {
      for (const key of keys(disc.x, disc.z, disc.r)) {
        const cell = cells.get(key);
        if (cell) cell.push(disc);
        else cells.set(key, [disc]);
      }
    },
    /** Un disque occupé touche-t-il le segment de `a` à `b`, épaissi de `r` ? */
    hits: (
      ax: number,
      az: number,
      bx: number,
      bz: number,
      r: number,
    ): boolean => {
      const cx = (ax + bx) / 2;
      const cz = (az + bz) / 2;
      const reach = Math.hypot(bx - ax, bz - az) / 2 + r + 3;
      return keys(cx, cz, reach).some((key) =>
        (cells.get(key) ?? []).some((disc) => {
          const dx = bx - ax;
          const dz = bz - az;
          const length2 = dx * dx + dz * dz;
          const t =
            length2 === 0
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    1,
                    ((disc.x - ax) * dx + (disc.z - az) * dz) / length2,
                  ),
                );
          return (
            Math.hypot(disc.x - ax - t * dx, disc.z - az - t * dz) <
            disc.r + r + MARGIN
          );
        }),
      );
    },
  };
};

/** Emprise d'un objet existant qu'un corps de l'habillage ne doit pas chevaucher, 0 s'il n'en a pas. */
const footprintOf = (item: SceneryItem): number => {
  if (isHay(item.kind)) return 1.1;
  if (item.kind === "bushProp") return BUSH_RADIUS;
  // Rang de vigne : boîte longue, prise par son disque englobant.
  if (item.kind === "vineRowProp") return VINE_HALF_LENGTH;
  if (isLightProp(item.kind)) return Math.max(item.colliderRadius, 0.15);
  return item.colliderRadius;
};

/** Emprise au sol d'un objet, disque ou boîte orientée, pour la rubalise et le public posés en dernier. */
interface Solid {
  x: number;
  z: number;
  /** Axe X local du modèle dans le monde, unitaire */
  ux: number;
  uz: number;
  halfX: number;
  halfZ: number;
  round: boolean;
}

/** Distance d'un point au bord d'une emprise, 0 dedans. */
const distanceToSolid = (solid: Solid, x: number, z: number): number => {
  const dx = x - solid.x;
  const dz = z - solid.z;
  if (solid.round) return Math.max(0, Math.hypot(dx, dz) - solid.halfX);
  // Axe Z local : X tourné d'un quart de tour, comme `setFromAxisAngle(UP, yaw)`.
  const u = dx * solid.ux + dz * solid.uz;
  const v = -dx * solid.uz + dz * solid.ux;
  return Math.hypot(
    Math.max(0, Math.abs(u) - solid.halfX),
    Math.max(0, Math.abs(v) - solid.halfZ),
  );
};

interface SolidIndex {
  add: (solid: Solid) => void;
  /** Une emprise passe-t-elle à moins de `r` du point ? */
  near: (x: number, z: number, r: number) => boolean;
}

/** Index des emprises par mailles de 10 m : chaque emprise est rangée dans toutes les mailles qu'elle couvre. */
const createSolidIndex = (): SolidIndex => {
  const CELL = 10;
  const cells = new Map<string, Solid[]>();
  return {
    add: (solid: Solid): void => {
      const reach = solid.round
        ? solid.halfX
        : Math.hypot(solid.halfX, solid.halfZ);
      for (
        let i = Math.floor((solid.x - reach) / CELL);
        i <= Math.floor((solid.x + reach) / CELL);
        i++
      )
        for (
          let j = Math.floor((solid.z - reach) / CELL);
          j <= Math.floor((solid.z + reach) / CELL);
          j++
        ) {
          const key = `${i},${j}`;
          const cell = cells.get(key);
          if (cell) cell.push(solid);
          else cells.set(key, [solid]);
        }
    },
    near: (x: number, z: number, r: number): boolean => {
      for (
        let i = Math.floor((x - r) / CELL);
        i <= Math.floor((x + r) / CELL);
        i++
      )
        for (
          let j = Math.floor((z - r) / CELL);
          j <= Math.floor((z + r) / CELL);
          j++
        )
          for (const solid of cells.get(`${i},${j}`) ?? [])
            if (distanceToSolid(solid, x, z) < r) return true;
      return false;
    },
  };
};

/** Axe X local d'un objet de cap `yaw` (voir `distanceToSolid`). */
const axisOf = (yaw: number): [number, number] => [
  Math.cos(yaw),
  -Math.sin(yaw),
];

/** Emprise d'un objet du décor final, `null` pour le public et ce qui n'a pas de corps. */
const solidOf = (item: SceneryItem): Solid | null => {
  const { kind, position, yaw, scale } = item;
  if (kind === "spectator" || kind === "marshal") return null;
  const [ux, uz] = axisOf(yaw);
  const box = (halfX: number, halfZ: number, offsetX = 0): Solid => ({
    x: position.x + ux * offsetX * scale,
    z: position.z + uz * offsetX * scale,
    ux,
    uz,
    halfX: halfX * scale,
    halfZ: halfZ * scale,
    round: false,
  });
  const disc = (r: number): Solid => ({
    x: position.x,
    z: position.z,
    ux,
    uz,
    halfX: r,
    halfZ: r,
    round: true,
  });
  switch (kind) {
    // Voile : la plume part du mât vers +X, sur 0,75 m.
    case "rallySail":
      return box(0.42, 0.08, 0.375);
    // Mâts : la toile flotte au-dessus des têtes, seul le pied compte.
    case "rallyMast":
    case "rallyCheckerMast":
      return disc(0.15);
    // Banderole : haubans à 1,2 m au-delà des piquets.
    case "rallyBanner":
      return box(4.3, 0.5);
    case "rallyTent":
      return box(1.6, 1.6);
    case "vineRowProp":
      return box(VINE_HALF_LENGTH, VINE_HALF_WIDTH);
    default: {
      const shape = RALLY_PROP_SHAPE[kind];
      if (shape) return box(shape.halfX, Math.max(shape.halfZ, 0.06));
      const r = footprintOf(item);
      return r > 0 ? disc(r) : null;
    }
  }
};

/** Départ, intermédiaires, arrivée et épingles : l'habillage complet, ajouté à la fin du décor. */
export const rallyDressing = ({
  track,
  seed,
  items,
  hairpins,
  startS,
  inBuilding,
  inWater,
  clear,
}: RallyDressingInput): SceneryItem[] => {
  const random = createRandom(seed ^ 0x3c6ef372);
  const { points, widths, closed } = track;
  const n = points.length;
  const step = track.length / (closed ? n : n - 1);
  const uniqueCount = track.unique.points.length;

  const wrapIndex = (i: number): number =>
    closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));

  const frameAt = (index: number): Frame => {
    const i = wrapIndex(index);
    const a = points[wrapIndex(i - 1)];
    const b = points[wrapIndex(i + 1)];
    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const tx = (b.x - a.x) / length;
    const tz = (b.z - a.z) / length;
    return {
      point: points[i],
      tx,
      tz,
      yaw: Math.atan2(-tx, -tz),
      halfWidth: widths[i] / 2,
    };
  };

  /** Indice de l'abscisse `s`, comme `archAt` ; `null` hors d'un tracé ouvert. */
  const indexOfS = (s: number): number | null => {
    if (closed) {
      const wrapped = ((s % track.length) + track.length) % track.length;
      return Math.min(n - 1, Math.round(wrapped / step));
    }
    if (s < 0 || s > track.length) return null;
    return track.indexAt(s);
  };

  /** Point à `lateral` mètres à droite de l'axe (à gauche si négatif). */
  const beside = (frame: Frame, lateral: number): [number, number] => [
    frame.point.x - frame.tz * lateral,
    frame.point.z + frame.tx * lateral,
  ];

  const edgeOf = (x: number, z: number): number => {
    const sample = track.nearest(x, z);
    return sample.distance - sample.width / 2;
  };

  const slopeAt = (x: number, z: number): number => {
    const reach = 2;
    const east = track.groundAt(x + reach, z);
    const west = track.groundAt(x - reach, z);
    const south = track.groundAt(x, z + reach);
    const north = track.groundAt(x, z - reach);
    if (east === null || west === null || south === null || north === null)
      return 0;
    return Math.hypot(east - west, south - north) / (2 * reach);
  };

  /** Altitude de pose sur le point le plus haut de l'emprise, `null` si le sol manque ou si l'objet flotterait. */
  const seat = (x: number, z: number, reach: number): number | null => {
    const ground = track.groundAt(x, z);
    if (ground === null) return null;
    if (!track.terrain) return ground;
    let top = ground;
    for (const [dx, dz] of [
      [reach, 0],
      [-reach, 0],
      [0, reach],
      [0, -reach],
    ]) {
      const height = track.groundAt(x + dx, z + dz);
      if (height === null) return null;
      top = Math.max(top, height);
    }
    return top - ground > MAX_LIFT ? null : top;
  };

  const blocked = (x: number, z: number): boolean =>
    inBuilding(x, z) || inWater(x, z);

  // Bottes remplacées par les barrières : décidé avant tout, sur les modules candidats.
  interface Module {
    ax: number;
    az: number;
    bx: number;
    bz: number;
  }
  const modulesOf = (hairpin: RallyHairpin): Module[] => {
    const reach = Math.round(BARRIER_REACH / step);
    const line: [number, number][] = [];
    let last = -1;
    for (let k = hairpin.apex - reach; k <= hairpin.apex + reach; k++) {
      const i = wrapIndex(k);
      if (i === last || i >= uniqueCount) continue;
      last = i;
      const frame = frameAt(i);
      line.push(beside(frame, hairpin.side * (frame.halfWidth + BARRIER_EDGE)));
    }
    const lengths = [0];
    for (let k = 1; k < line.length; k++)
      lengths.push(
        lengths[k - 1] +
          Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]),
      );
    const total = lengths[lengths.length - 1];
    const count = Math.floor(
      (total + BARRIER_PITCH - BARRIER_MODULE) / BARRIER_PITCH,
    );
    if (count <= 0) return [];
    /** Point de la ligne à la longueur `at` */
    const at = (target: number): [number, number] => {
      let k = 1;
      while (k < lengths.length - 1 && lengths[k] < target) k++;
      const span = lengths[k] - lengths[k - 1] || 1;
      const t = (target - lengths[k - 1]) / span;
      return [
        line[k - 1][0] + (line[k][0] - line[k - 1][0]) * t,
        line[k - 1][1] + (line[k][1] - line[k - 1][1]) * t,
      ];
    };
    const offset = (total - (count - 1) * BARRIER_PITCH - BARRIER_MODULE) / 2;
    return Array.from({ length: count }, (_, j) => {
      const from = offset + j * BARRIER_PITCH;
      const [ax, az] = at(from);
      const [bx, bz] = at(from + BARRIER_MODULE);
      return { ax, az, bx, bz };
    });
  };
  const barriers = hairpins.map((hairpin) => ({
    hairpin,
    modules: modulesOf(hairpin),
  }));
  const removed = new Set<SceneryItem>();
  const pointToModule = (x: number, z: number, m: Module): number => {
    const dx = m.bx - m.ax;
    const dz = m.bz - m.az;
    const length2 = dx * dx + dz * dz || 1;
    const t = Math.max(
      0,
      Math.min(1, ((x - m.ax) * dx + (z - m.az) * dz) / length2),
    );
    return Math.hypot(x - m.ax - t * dx, z - m.az - t * dz);
  };
  for (const item of items) {
    if (!isHay(item.kind)) continue;
    if (
      barriers.some(({ modules }) =>
        modules.some(
          (m) => pointToModule(item.position.x, item.position.z, m) < 1.6,
        ),
      )
    )
      removed.add(item);
  }
  const base =
    removed.size > 0 ? items.filter((item) => !removed.has(item)) : items;

  const occupied = createDiscIndex();
  for (const item of base) {
    const r = footprintOf(item);
    if (r > 0) occupied.add({ x: item.position.x, z: item.position.z, r });
  }

  const dressing: SceneryItem[] = [];
  let spectators = base.reduce(
    (sum, item) => sum + (item.kind === "spectator" ? 1 : 0),
    0,
  );

  /** Pose un objet ponctuel s'il tient : hors route, hors bâtiment et eau, sol assez plat, sans chevauchement. */
  const put = (
    kind: RallySceneryKind,
    x: number,
    z: number,
    yaw: number,
  ): boolean => {
    const footprint = FOOTPRINT[kind] ?? 0;
    if (edgeOf(x, z) < MIN_EDGE || blocked(x, z)) return false;
    const y = kind === "rallyTent" ? track.groundAt(x, z) : seat(x, z, 0.15);
    if (y === null) return false;
    if (kind === "rallyTent" && track.terrain && slopeAt(x, z) > MAX_SLOPE)
      return false;
    const shape = RALLY_PROP_SHAPE[kind];
    const item: SceneryItem = {
      kind,
      position: { x, y, z },
      yaw,
      scale: 1,
      // Tente fixe : un collider près de la route ; les objets légers prennent le leur dans `lightProps`.
      colliderRadius:
        kind === "rallyTent"
          ? 1.6
          : shape
            ? Math.max(shape.halfX, shape.halfZ)
            : 0,
    };
    if (!clear(item)) return false;
    if (footprint > 0 && occupied.hits(x, z, x, z, footprint)) return false;
    if (footprint > 0) occupied.add({ x, z, r: footprint });
    dressing.push(item);
    return true;
  };

  // Emprises vues par la rubalise : tout le décor final, rempli juste avant de la poser, puis ses propres modules.
  const tapeSolids = createSolidIndex();
  const tapeShape = RALLY_PROP_SHAPE.rallyTape;
  /** Le corps d'un module de rubalise recoupe-t-il une emprise ? Échantillonné tous les 25 cm. */
  const tapeBlocked = (item: SceneryItem): boolean => {
    const half = tapeShape?.halfX ?? 2.35;
    const reach = (tapeShape?.halfZ ?? 0.05) + 0.05;
    const [ux, uz] = axisOf(item.yaw);
    const count = Math.ceil((2 * half) / 0.25);
    for (let k = 0; k <= count; k++) {
      const t = -half + (2 * half * k) / count;
      if (
        tapeSolids.near(
          item.position.x + ux * t,
          item.position.z + uz * t,
          reach,
        )
      )
        return true;
    }
    return false;
  };

  /** Pose un objet long (barrière, banderole, rubalise) entre `a` et `b`, s'il tient. */
  const putSpan = (
    kind: RallySceneryKind,
    ax: number,
    az: number,
    bx: number,
    bz: number,
    thickness: number,
    maxGap: number,
  ): boolean => {
    const x = (ax + bx) / 2;
    const z = (az + bz) / 2;
    if (
      [edgeOf(ax, az), edgeOf(x, z), edgeOf(bx, bz)].some(
        (edge) => edge < MIN_EDGE,
      )
    )
      return false;
    if (blocked(ax, az) || blocked(x, z) || blocked(bx, bz)) return false;
    const heights = [
      track.groundAt(ax, az),
      track.groundAt(x, z),
      track.groundAt(bx, bz),
    ];
    let top = -Infinity;
    let bottom = Infinity;
    for (const height of heights) {
      if (height === null) return false;
      top = Math.max(top, height);
      bottom = Math.min(bottom, height);
    }
    if (track.terrain && top - bottom > maxGap) return false;
    const item: SceneryItem = {
      kind,
      position: { x, y: top, z },
      // Longueur le long de x local.
      yaw: Math.atan2(-(bz - az), bx - ax),
      scale: 1,
      colliderRadius: Math.hypot(bx - ax, bz - az) / 2,
    };
    if (!clear(item)) return false;
    // Rubalise, posée en dernier : son corps ne recoupe aucune emprise, barrières des épingles comprises.
    if (
      kind === "rallyTape"
        ? tapeBlocked(item)
        : occupied.hits(ax, az, bx, bz, thickness)
    )
      return false;
    dressing.push(item);
    if (kind === "rallyTape") {
      const solid = solidOf(item);
      if (solid) tapeSolids.add(solid);
    }
    // La banderole occupe sa place ; les barrières, voisines bout à bout, la prennent après leur rangée.
    if (kind === "rallyBanner")
      occupied.add({ x, z, r: Math.hypot(bx - ax, bz - az) / 2 + thickness });
    return true;
  };

  /** Petite variation déterministe d'orientation */
  const jitter = (amount: number): number => (random() - 0.5) * amount;

  /** Face à la route : le personnage ou la pancarte regarde le point `target` de l'axe. */
  const facing = (x: number, z: number, target: Vec3): number =>
    Math.atan2(target.x - x, target.z - z);

  /** Rubalise d'un côté, de `fromS` à `toS`, en modules droits de 5 m le long de la route. */
  const tapeAlong = (fromS: number, toS: number, side: number): void => {
    const line: [number, number][] = [];
    let last = -1;
    for (let s = fromS; s <= toS; s += step) {
      const i = indexOfS(s);
      if (i === null || i === last) continue;
      last = i;
      const frame = frameAt(i);
      line.push(beside(frame, side * (frame.halfWidth + TAPE_EDGE)));
    }
    if (line.length < 2) return;
    let carry = 0;
    let anchor = line[0];
    for (let k = 1; k < line.length; k++) {
      carry += Math.hypot(
        line[k][0] - line[k - 1][0],
        line[k][1] - line[k - 1][1],
      );
      if (carry < TAPE_MODULE) continue;
      putSpan(
        "rallyTape",
        anchor[0],
        anchor[1],
        line[k][0],
        line[k][1],
        0,
        0.4,
      );
      anchor = line[k];
      carry = 0;
    }
  };

  /** Public de l'arrivée, comme celui du départ : sans collider, toujours tiré en entier. */
  const crowdAround = (center: number, side: number, size: number): void => {
    for (let k = 0; k < size; k++) {
      const along = (random() - 0.5) * CONTROL.crowdSpread;
      const depth = random() * 3;
      const turn = (random() - 0.5) * 0.8;
      const scale = 0.9 + random() * 0.2;
      if (spectators >= MAX_SPECTATORS) continue;
      const i = indexOfS(center + along);
      if (i === null) continue;
      const frame = frameAt(i);
      const [x, z] = beside(
        frame,
        side * (frame.halfWidth + SPECTATOR_EDGE + 0.5 + depth),
      );
      if (edgeOf(x, z) < SPECTATOR_EDGE || blocked(x, z)) continue;
      const ground = track.groundAt(x, z);
      if (ground === null) continue;
      if (track.terrain && slopeAt(x, z) > MAX_SLOPE) continue;
      const item: SceneryItem = {
        kind: "spectator",
        position: { x, y: ground, z },
        yaw: facing(x, z, frame.point) + turn,
        scale,
        colliderRadius: 0,
      };
      if (!clear(item)) continue;
      dressing.push(item);
      spectators++;
    }
  };

  /** Rubalises à poser en dernier : de, à, côté */
  const tapeRuns: [number, number, number][] = [];

  /** Départ ou arrivée : même dispositif (voir `ControlZone` du labo), seuls le damier et le public changent. */
  const controlZone = (archS: number, finish: boolean): void => {
    const archIndex = indexOfS(archS);
    if (archIndex === null) return;
    const archPoint = frameAt(archIndex).point;
    /** Repère à `dx` mètres de l'arche, ou `null` hors du tracé */
    const at = (dx: number): Frame | null => {
      const i = indexOfS(archS + dx);
      return i === null ? null : frameAt(i);
    };
    // Rubalise posée tout à la fin (sans tirage) : les barrières et l'habillage passent avant.
    for (const side of [-1, 1])
      tapeRuns.push([archS + CONTROL.tapeFrom, archS + CONTROL.tapeTo, side]);
    // Voiles des deux côtés, avant et après l'arche ; la voile se présente au pilote qui arrive.
    for (const dx of CONTROL.sails)
      for (const side of [-1, 1]) {
        const frame = at(dx);
        if (!frame) continue;
        const [x, z] = beside(frame, side * (frame.halfWidth + PROP_EDGE));
        put("rallySail", x, z, frame.yaw + Math.PI + jitter(0.6));
      }
    // Pancartes à droite, au public ; banderole, mâts et tente à gauche (droite = côté sud du labo).
    CONTROL.placards.forEach((dx, k) => {
      const frame = at(dx);
      if (!frame) return;
      const [x, z] = beside(frame, frame.halfWidth + PROP_EDGE + k * 0.3);
      put("rallyPlacard", x, z, facing(x, z, frame.point) + jitter(0.5));
    });
    const banner = at(CONTROL.banner);
    if (banner) {
      const half = (RALLY_PROP_SHAPE.rallyBanner?.halfX ?? 3) - 0.05;
      const [cx, cz] = beside(banner, -(banner.halfWidth + BANNER_EDGE));
      putSpan(
        "rallyBanner",
        cx - banner.tx * half,
        cz - banner.tz * half,
        cx + banner.tx * half,
        cz + banner.tz * half,
        0.1,
        MAX_LIFT,
      );
    }
    const masts = CONTROL.masts.map((dx): [number, RallySceneryKind] => [
      dx,
      "rallyMast",
    ]);
    if (finish) masts.push([CONTROL.checkerMast, "rallyCheckerMast"]);
    for (const [dx, kind] of masts) {
      const frame = at(dx);
      if (!frame) continue;
      const [x, z] = beside(frame, -(frame.halfWidth + MAST_EDGE));
      // Toile le long de la route, face au public d'en face.
      put(kind, x, z, frame.yaw + Math.PI / 2);
    }
    const tent = at(CONTROL.tent);
    if (tent) {
      const [x, z] = beside(tent, -(tent.halfWidth + TENT_EDGE));
      // Façade (+Z local) tournée vers la route.
      put("rallyTent", x, z, tent.yaw + Math.PI / 2);
    }
    // Commissaires derrière la rubalise, côté public : un avant et un après la ligne, de chaque côté.
    for (const dx of CONTROL.marshals)
      for (const side of [-1, 1]) {
        const frame = at(dx);
        if (!frame) continue;
        const [x, z] = beside(frame, side * (frame.halfWidth + MARSHAL_EDGE));
        if (edgeOf(x, z) < MIN_EDGE || blocked(x, z)) continue;
        const ground = track.groundAt(x, z);
        if (ground === null) continue;
        const item: SceneryItem = {
          kind: "marshal",
          position: { x, y: ground, z },
          yaw: facing(x, z, archPoint),
          scale: 1,
          colliderRadius: 0,
        };
        if (clear(item)) dressing.push(item);
      }
    // L'arrivée reçoit son public ; celui du départ existe déjà (`generateScenery`).
    if (finish)
      for (const side of [-1, 1])
        crowdAround(
          archS + CONTROL.crowdCenter,
          side,
          12 + Math.floor(random() * 9),
        );
  };

  controlZone(startS, false);
  if (!closed) controlZone(track.finishS, true);

  // Intermédiaires : une voile de chaque côté de l'arche, en quinconce, et une pancarte.
  const course = raceCourse(track);
  for (const s of splitGates(course.startS, course.finishS - course.startS)) {
    const place = (
      dx: number,
      side: number,
      kind: RallySceneryKind,
      extra = 0,
    ): void => {
      const i = indexOfS(s + dx);
      if (i === null) return;
      const frame = frameAt(i);
      const [x, z] = beside(
        frame,
        side * (frame.halfWidth + PROP_EDGE + extra),
      );
      put(
        kind,
        x,
        z,
        kind === "rallySail"
          ? frame.yaw + Math.PI + jitter(0.6)
          : facing(x, z, frame.point) + jitter(0.5),
      );
    };
    place(-2.5, 1, "rallySail");
    place(2.5, -1, "rallySail");
    place(3, 1, "rallyPlacard", 0.3);
  }

  // Épingles : barrière de chicane devant le public, un commissaire au point de corde, derrière la barrière.
  const placed: Module[] = [];
  for (const { hairpin, modules } of barriers) {
    for (const m of modules)
      if (putSpan("rallyBarrier", m.ax, m.az, m.bx, m.bz, 0.1, BARRIER_MAX_GAP))
        placed.push(m);
    const apex = frameAt(hairpin.apex);
    const [x, z] = beside(
      apex,
      hairpin.side * (apex.halfWidth + HAIRPIN_MARSHAL_EDGE),
    );
    const ground = track.groundAt(x, z);
    if (ground !== null && edgeOf(x, z) >= MIN_EDGE && !blocked(x, z)) {
      const item: SceneryItem = {
        kind: "marshal",
        position: { x, y: ground, z },
        yaw: facing(x, z, apex.point),
        scale: 1,
        colliderRadius: 0,
      };
      if (clear(item)) dressing.push(item);
    }
  }
  for (const m of placed)
    occupied.add({
      x: (m.ax + m.bx) / 2,
      z: (m.az + m.bz) / 2,
      r: BARRIER_MODULE / 2 + 0.1,
    });
  // Les trois épingles les plus serrées : une voile à chaque bout de la barrière, trois pancartes aux bouts du public.
  const tightest = [...hairpins]
    .sort((a, b) => b.curvature - a.curvature || a.apex - b.apex)
    .slice(0, 3);
  for (const hairpin of tightest) {
    const along = (meters: number): Frame =>
      frameAt(hairpin.apex + Math.round(meters / step));
    for (const meters of [-(BARRIER_REACH + 1.5), BARRIER_REACH + 1.5]) {
      const frame = along(meters);
      const [x, z] = beside(
        frame,
        hairpin.side * (frame.halfWidth + BARRIER_EDGE + 0.4),
      );
      put("rallySail", x, z, frame.yaw + Math.PI + jitter(0.6));
    }
    for (const meters of [-11, -9.5, 11]) {
      const frame = along(meters);
      const [x, z] = beside(
        frame,
        hairpin.side * (frame.halfWidth + HAIRPIN_PROP_EDGE),
      );
      put("rallyPlacard", x, z, facing(x, z, frame.point) + jitter(0.5));
    }
  }

  // Rubalise : après tout le reste, elle cède la place à ce qu'elle recouperait (barrière d'une épingle proche).
  for (const item of [...base, ...dressing]) {
    const solid = solidOf(item);
    if (solid) tapeSolids.add(solid);
  }
  for (const [fromS, toS, side] of tapeRuns) tapeAlong(fromS, toS, side);

  // Public et commissaires retirés après coup, sans rien déplacer : personne n'en chevauche un autre, ni un objet.
  // `tapeSolids` tient désormais tout le décor final, rubalise comprise.
  const all = [...base, ...dressing];
  const solids = tapeSolids;
  // Bulles des personnes gardées, par mailles de 10 m ; les commissaires passent avant le public.
  const people = createSolidIndex();
  const crowded = new Set<SceneryItem>();
  const persons = [
    ...all.filter((item) => item.kind === "marshal"),
    ...all.filter((item) => item.kind === "spectator"),
  ];
  for (const person of persons) {
    const space = CROWD_SPACE[crowdPoseOf(person)];
    const { x, z } = person.position;
    if (solids.near(x, z, space.body * person.scale)) {
      crowded.add(person);
      continue;
    }
    const [ux, uz] = axisOf(person.yaw);
    const bubble: Solid = {
      // Axe Z local : (−uz, ux), voir `distanceToSolid`.
      x: x + (ux * space.offsetX - uz * space.offsetZ) * person.scale,
      z: z + (uz * space.offsetX + ux * space.offsetZ) * person.scale,
      ux,
      uz,
      halfX: space.radius * person.scale,
      halfZ: space.radius * person.scale,
      round: true,
    };
    if (people.near(bubble.x, bubble.z, bubble.halfX)) {
      crowded.add(person);
      continue;
    }
    people.add(bubble);
  }
  return crowded.size > 0 ? all.filter((item) => !crowded.has(item)) : all;
};
