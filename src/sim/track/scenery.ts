import {
  BUSH_RADIUS,
  isChicaneSign,
  isHay,
  isLightProp,
  isLooseVegetation,
  VINE_HALF_LENGTH,
  VINE_HALF_WIDTH,
} from "../lightProps";
import { brakeBoardItems } from "./brakeBoards";
import { chicaneSignItems } from "./chicaneSigns";
import { signedCurvature } from "./curvature";
import { createDecorFootprints } from "./decorFootprints";
import { raceCourse, splitGates } from "../splits";
import { isNearBlock } from "./obstacles";
import { rallyDressing, type RallyHairpin } from "./rallyDressing";
import { islandSeparatorItems } from "./islandSeparators";
import { SHOULDER_WIDTH } from "./ribbon";
import type {
  DecorTree,
  DecorTreeKind,
  Pose,
  SceneryItem,
  SceneryKind,
  Track,
  Vec3,
} from "../types";

/** Au-delà de cette distance à l'axe, le décor n'a ni collision ni ombre. */
export const NEAR_SCENERY_DISTANCE = 40;
const POST_SPACING = 100;
const HAY_CLEARANCE = 1.8;
/** Abscisse de l'arche de départ : devant la voiture sur sa grille */
const ARCH_S = 14;
/** Dégagement minimal des arbres et rochers par rapport au bord de route */
const VEGETATION_CLEARANCE = 7;
/** Dégagement minimal du mobilier (bottes, panneaux) par rapport au bord de route */
const FURNITURE_CLEARANCE = 2.6;
/** Écart de hauteur maximal entre le sol d'un objet (public, habillage, panneau) et la route la plus proche, en mètres */
const MAX_ROAD_GAP = 2.5;
/** En dessous de ce rayon, un virage reçoit des bottes de paille et un panneau */
const BEND_RADIUS = 60;
/** Emprise d'un objet léger vu du dessus, demi-côté en mètres : la botte couchée, ou le pied d'un plot ou d'un panneau */
const HAY_FOOTPRINT = 1.1;
const POLE_FOOTPRINT = 0.15;
/** Au-delà de cet écart sur son emprise, l'objet léger flotterait trop : on ne le pose pas, en mètres */
const MAX_PROP_LIFT = 0.5;
/** Part des bottes debout, sur leur face plate. Les autres restent couchées sur le flanc. */
const HAY_UPRIGHT_SHARE = 0.5;
/** Au-delà de cet écart entre le sol et le plan de la botte, le sol n'est pas assez plat pour elle, en mètres */
export const HAY_MAX_GAP = 0.15;
/** Au-delà de cette pente (35°), aucun arbre ne pousse : sur un terrain, en mètre par mètre */
export const MAX_TREE_SLOPE = 0.7;
/** Demi-largeur sur laquelle se lit la pente au pied d'un arbre, en mètres */
export const TREE_SLOPE_REACH = 2;
const HAY_DIAGONAL = HAY_FOOTPRINT * Math.SQRT1_2;
/** Tour de l'emprise d'une botte : huit points symétriques, pour lire la pente sans biais. */
const HAY_RIM: [number, number][] = [
  [HAY_FOOTPRINT, 0],
  [-HAY_FOOTPRINT, 0],
  [0, HAY_FOOTPRINT],
  [0, -HAY_FOOTPRINT],
  [HAY_DIAGONAL, HAY_DIAGONAL],
  [HAY_DIAGONAL, -HAY_DIAGONAL],
  [-HAY_DIAGONAL, HAY_DIAGONAL],
  [-HAY_DIAGONAL, -HAY_DIAGONAL],
];
/** Somme des dx² (ou dz²) sur le tour : le dénominateur de la pente aux moindres carrés. */
const HAY_RIM_WEIGHT = 2 * HAY_FOOTPRINT ** 2 + 4 * HAY_DIAGONAL ** 2;
/** Dégagement du décor autour d'un bloc de chicane, en mètres : la chicane se lit, rien ne s'y coince */
const BLOCK_CLEARANCE = 4;
/** Public : jamais à moins de cette distance du bord de route, en mètres */
const SPECTATOR_CLEARANCE = 6;
/** Au-delà de cette pente (20°), personne ne se tient debout */
const MAX_SPECTATOR_SLOPE = Math.tan((20 * Math.PI) / 180);
/** En dessous de ce rayon, un virage est une épingle : le public s'y masse */
const HAIRPIN_RADIUS = 25;
/** Plafond par spéciale : au-delà, les FPS chutent */
const MAX_SPECTATORS = 600;
/** Part des virages ordinaires (bottes, rayon < 60 m) qui reçoivent un petit groupe */
const BEND_CROWD_SHARE = 0.25;

/**
 * Un arbre réel porte un collider jusqu'à cette distance du bord de route, en mètres. Plus court que
 * `NEAR_SCENERY_DISTANCE` : une forêt fermée en aurait près de 10 000 sur 10 km, ici environ 4 000.
 * Passé de 15 à 25 m le 2026-11-21 : au playtest, des arbres de bord de piste se traversaient après une sortie large.
 */
const DECOR_TREE_COLLIDER_REACH = 25;
/**
 * Au-delà de cette distance au bord de route, un rang de vigne prend la bande économique, en mètres.
 * ponytail: choix figé par la distance à la route (pas à la voiture), `SceneryView` ne change pas de géométrie en course.
 */
const VINE_DETAIL_REACH = 100;
/**
 * Buissons et rangs de vigne renversables jusqu'à cette distance du bord de route, en mètres. Plus court que les
 * arbres (25 m) : au-delà de 10 m la voiture est déjà en perdition, et la bande de 3 à 10 m garde la haie de bord
 * de route entière pour environ deux fois moins de corps qu'à 15 m dans un vignoble.
 */
const LOOSE_VEGETATION_REACH = 10;
/**
 * Plafond des corps de végétation renversable, les plus proches de la route d'abord. Endormis, ils ne coûtent
 * presque rien au pas ; c'est le premier pas (tous éveillés) et la relecture de `sync` qui grossissent avec eux.
 * Une haie de bord de route continue des deux côtés sur 10 km en compte environ 8 300 : plafonnée ici.
 */
const MAX_LOOSE_VEGETATION = 4000;
/** Au-delà de cette pente (14°), la végétation reste fixe : inclinée dès le départ, elle se lirait comme renversée */
const LOOSE_MAX_SLOPE = 0.25;
/** Au-delà de cet écart entre le sol et le plan de l'emprise, la végétation reste fixe, en mètres */
const LOOSE_MAX_GAP = 0.2;
/** Marge entre deux emprises de corps, en mètres : rien ne se chevauche, rien n'explose au réveil */
const LOOSE_MARGIN = 0.05;
/** Maille de l'index des emprises, en mètres */
const FOOTPRINT_CELL = 8;
/**
 * Rayon du collider de la végétation à l'échelle 1, en mètres : le tronc, pas la ramure. `tree`, `pine` et `rock`
 * inchangés (décor de la story 1.7 au bit près) ; les autres reprennent le pied du tronc du modèle du labo.
 */
const VEGETATION_COLLIDER: Record<string, number> = {
  pine: 0.35,
  tree: 0.4,
  rock: 0.9,
  oakTiered: 0.35,
  poplar: 0.3,
  birch: 0.2,
  willow: 0.45,
  scotsPine: 0.27,
  fruitTree: 0.18,
  deadTree: 0.3,
};
/**
 * Au-delà de cette distance au bord de route, un arbre prend sa version lointaine quand le labo en a une, en
 * mètres. Toujours au-delà de `DECOR_TREE_COLLIDER_REACH` : un arbre qu'on peut percuter garde son modèle détaillé.
 * ponytail: comme la vigne, figé par la distance à la route ; une bascule selon la voiture viendra avec la 5.6.
 */
const TREE_DETAIL_REACH = 60;
const FAR_TREE: Partial<Record<DecorTreeKind, SceneryKind>> = {
  tree: "treeFar",
  pine: "pineFar",
  oakTiered: "oakTieredFar",
  birch: "birchFar",
};
/** Végétation réelle, versions lointaines comprises : déjà écartée des bâtiments et de l'eau par le pipeline. */
const DECOR_VEGETATION: ReadonlySet<SceneryKind> = new Set<SceneryKind>([
  "tree",
  "pine",
  "oakTiered",
  "poplar",
  "birch",
  "willow",
  "scotsPine",
  "fruitTree",
  "deadTree",
  "treeFar",
  "pineFar",
  "oakTieredFar",
  "birchFar",
  "bush",
  "vineRow",
  "vineRowFar",
]);

/**
 * Arbres réels du décor (epic 5) en objets de décor : collider seulement près de la route, comme la végétation
 * pseudo-aléatoire qu'ils remplacent. Déjà posés au sol et filtrés par le pipeline.
 */
const decorTreeItems = (
  track: Track,
  trees: DecorTree[],
  /** Reçoit la distance au bord de route de chaque candidat renversable */
  looseClearance: Map<SceneryItem, number>,
): SceneryItem[] =>
  trees.map(({ kind, position, yaw, scale }): SceneryItem => {
    const sample = track.nearest(position.x, position.z);
    const clearance = sample.distance - sample.width / 2;
    // Haies et vignes : renversables près de la route (tri final dans `generateScenery`), décor seul au-delà.
    if (kind === "bush" || kind === "vineRow") {
      if (clearance <= LOOSE_VEGETATION_REACH) {
        const item: SceneryItem = {
          kind: kind === "bush" ? "bushProp" : "vineRowProp",
          position,
          yaw,
          scale,
          colliderRadius: kind === "bush" ? BUSH_RADIUS : VINE_HALF_WIDTH,
        };
        looseClearance.set(item, clearance);
        return item;
      }
      return {
        kind:
          kind === "vineRow" && clearance > VINE_DETAIL_REACH
            ? "vineRowFar"
            : kind,
        position,
        yaw,
        scale,
        colliderRadius: 0,
      };
    }
    const far = FAR_TREE[kind];
    return {
      kind: far && clearance > TREE_DETAIL_REACH ? far : kind,
      position,
      yaw,
      scale,
      colliderRadius:
        clearance <= DECOR_TREE_COLLIDER_REACH
          ? VEGETATION_COLLIDER[kind] * scale
          : 0,
    };
  });

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

/** Pente du sol en (x, z), 0 si le point sort du terrain. */
export const slopeAt = (
  track: Pick<Track, "groundAt">,
  x: number,
  z: number,
): number => {
  const east = track.groundAt(x + TREE_SLOPE_REACH, z);
  const west = track.groundAt(x - TREE_SLOPE_REACH, z);
  const south = track.groundAt(x, z + TREE_SLOPE_REACH);
  const north = track.groundAt(x, z - TREE_SLOPE_REACH);
  if (east === null || west === null || south === null || north === null)
    return 0;
  return Math.hypot(east - west, south - north) / (2 * TREE_SLOPE_REACH);
};

/**
 * Emprise d'un corps vue du dessus : rectangle orienté, demi-côtés le long de x et z locaux, ou disque de rayon
 * `halfX` (`round`) pour un cylindre debout : un carré tourné rapprocherait à tort deux buissons voisins.
 */
interface Footprint {
  x: number;
  z: number;
  yaw: number;
  halfX: number;
  halfZ: number;
  round: boolean;
}

/** Axes x et z locaux d'un cap, dans le plan (x, z) : x local = (cos, -sin), z local = (sin, cos). */
const axesOf = (yaw: number): [number, number, number, number] => [
  Math.cos(yaw),
  -Math.sin(yaw),
  Math.sin(yaw),
  Math.cos(yaw),
];

/** Disque contre rectangle orienté : le point du rectangle le plus proche du centre du disque. */
const discHitsBox = (disc: Footprint, box: Footprint): boolean => {
  const [ax, az, bx, bz] = axesOf(box.yaw);
  const tx = disc.x - box.x;
  const tz = disc.z - box.z;
  const u = tx * ax + tz * az;
  const v = tx * bx + tz * bz;
  const du = u - Math.max(-box.halfX, Math.min(box.halfX, u));
  const dv = v - Math.max(-box.halfZ, Math.min(box.halfZ, v));
  return du * du + dv * dv < disc.halfX * disc.halfX;
};

/** Deux emprises se chevauchent-elles ? Disques, disque et rectangle, ou axes séparateurs entre rectangles. */
const footprintsOverlap = (a: Footprint, b: Footprint): boolean => {
  if (a.round && b.round)
    return Math.hypot(b.x - a.x, b.z - a.z) < a.halfX + b.halfX;
  if (a.round) return discHitsBox(a, b);
  if (b.round) return discHitsBox(b, a);
  const [ax, az, bx, bz] = axesOf(a.yaw);
  const [cx, cz, dx, dz] = axesOf(b.yaw);
  const tx = b.x - a.x;
  const tz = b.z - a.z;
  const axes: [number, number][] = [
    [ax, az],
    [bx, bz],
    [cx, cz],
    [dx, dz],
  ];
  for (const [ux, uz] of axes) {
    const reachA =
      a.halfX * Math.abs(ax * ux + az * uz) +
      a.halfZ * Math.abs(bx * ux + bz * uz);
    const reachB =
      b.halfX * Math.abs(cx * ux + cz * uz) +
      b.halfZ * Math.abs(dx * ux + dz * uz);
    if (Math.abs(tx * ux + tz * uz) > reachA + reachB) return false;
  }
  return true;
};

interface FootprintIndex {
  add: (footprint: Footprint) => void;
  hits: (footprint: Footprint) => boolean;
}

/** Index des emprises par mailles : chaque emprise est rangée dans les mailles de son cercle englobant. */
const createFootprintIndex = (): FootprintIndex => {
  const cells = new Map<string, Footprint[]>();
  const keysOf = (f: Footprint): string[] => {
    const r = Math.hypot(f.halfX, f.halfZ);
    const keys: string[] = [];
    for (
      let ix = Math.floor((f.x - r) / FOOTPRINT_CELL);
      ix <= Math.floor((f.x + r) / FOOTPRINT_CELL);
      ix++
    )
      for (
        let iz = Math.floor((f.z - r) / FOOTPRINT_CELL);
        iz <= Math.floor((f.z + r) / FOOTPRINT_CELL);
        iz++
      )
        keys.push(`${ix},${iz}`);
    return keys;
  };
  return {
    add: (f) => {
      for (const key of keysOf(f)) {
        const cell = cells.get(key);
        if (cell) cell.push(f);
        else cells.set(key, [f]);
      }
    },
    hits: (f) =>
      keysOf(f).some((key) =>
        (cells.get(key) ?? []).some((other) => footprintsOverlap(f, other)),
      ),
  };
};

/**
 * Pose d'un corps renversable sur son emprise : plan des moindres carrés sur huit points du tour, posé juste
 * au-dessus du point le plus haut. `null` si le sol manque, est trop raide ou trop irrégulier.
 */
const seatLoose = (
  track: Pick<Track, "groundAt" | "terrain">,
  f: Footprint,
  y: number,
): { y: number; up?: Vec3 } | null => {
  if (!track.terrain) return { y };
  const center = track.groundAt(f.x, f.z);
  if (center === null) return null;
  const [ax, az, bx, bz] = axesOf(f.yaw);
  const offsets: [number, number][] = [
    [f.halfX, 0],
    [-f.halfX, 0],
    [0, f.halfZ],
    [0, -f.halfZ],
    [f.halfX, f.halfZ],
    [f.halfX, -f.halfZ],
    [-f.halfX, f.halfZ],
    [-f.halfX, -f.halfZ],
  ];
  const rim: [number, number, number][] = [];
  for (const [du, dv] of offsets) {
    const h = track.groundAt(f.x + du * ax + dv * bx, f.z + du * az + dv * bz);
    if (h === null) return null;
    rim.push([du, dv, h]);
  }
  // Points symétriques : chaque pente se lit à part, Σ du² = 6 halfX² et Σ dv² = 6 halfZ².
  let slopeU = 0;
  let slopeV = 0;
  for (const [du, dv, h] of rim) {
    slopeU += (du * h) / (6 * f.halfX * f.halfX);
    slopeV += (dv * h) / (6 * f.halfZ * f.halfZ);
  }
  let lift = 0;
  let sink = 0;
  for (const [du, dv, h] of rim) {
    const gap = h - (center + slopeU * du + slopeV * dv);
    lift = Math.max(lift, gap);
    sink = Math.min(sink, gap);
  }
  if (lift - sink > LOOSE_MAX_GAP) return null;
  // Pente dans le monde : x local porte slopeU, z local slopeV.
  const gx = slopeU * ax + slopeV * bx;
  const gz = slopeU * az + slopeV * bz;
  if (Math.hypot(gx, gz) > LOOSE_MAX_SLOPE) return null;
  const length = Math.sqrt(gx * gx + 1 + gz * gz);
  return {
    y: center + lift,
    up: { x: -gx / length, y: 1 / length, z: -gz / length },
  };
};

/** Pas de l'axe : un tracé fermé a autant de segments que de points, un tracé ouvert un de moins. */
const stepOf = (track: Track): number =>
  track.length / (track.closed ? track.points.length : track.points.length - 1);

/** Au-delà de cet écart entre la route et le sol sous un pied, l'arche cède la place à une banderole, en mètres */
const ARCH_MAX_LEG = 3;
/** Mâts de la banderole au ras du bas-côté : distance au bord de route, en mètres */
const BANNER_MAST_EDGE = 0.4;
const BANNER_MAST_RADIUS = 0.1;
/** Rayon des pieds d'une arche de départ ou d'arrivée, comme leur collider (`colliders.ts`) */
const ARCH_FOOT_RADIUS = 0.3;
/** Demi-épaisseur de la glissière d'un terre-plein, comme son collider (`colliders.ts`), plus un jour entre pied et béton */
const MEDIAN_CLEARANCE = 0.15 + 0.2;
/** Une glissière plus loin que ça devant ou derrière l'arche ne la gêne pas, en mètres */
const MEDIAN_BAND = 4;

/**
 * Demi-écartement maximal des pieds avant de toucher la glissière d'un terre-plein (PR-19, B-12), `null` sans
 * terre-plein dans l'emprise de l'arche. `right` est le côté droit de la route, unitaire.
 */
const medianLimit = (
  track: Track,
  point: Vec3,
  right: { x: number; z: number },
  reach: number,
  footRadius: number,
): number | null => {
  let nearest = Number.POSITIVE_INFINITY;
  for (const { points } of track.medians)
    for (const m of points) {
      const dx = m.x - point.x;
      const dz = m.z - point.z;
      const lateral = Math.abs(dx * right.x + dz * right.z);
      const along = Math.abs(dx * right.z - dz * right.x);
      if (along <= MEDIAN_BAND && lateral < nearest) nearest = lateral;
    }
  const limit = nearest - MEDIAN_CLEARANCE - footRadius;
  return limit < reach ? limit : null;
};

export interface RallyArch extends Pose {
  /** Demi-écartement des pieds, ou des mâts de la banderole */
  halfSpan: number;
  /** Sol sous le pied gauche puis droit : le pied descend ou se raccourcit jusqu'à lui (PR-10, option A) */
  feet: [number, number];
  /** Un pied sans sol à moins de `ARCH_MAX_LEG` : banderole tendue entre deux mâts (PR-10, option C) */
  banner: boolean;
  postRadius?: number;
}

/**
 * Centre, côté droit et cap d'une arche à l'abscisse `s`.
 * @param footRadius rayon des pieds, pour qu'ils restent hors de la glissière d'un terre-plein
 */
const archAt = (
  track: Track,
  s: number,
  allowBanner: boolean,
  footRadius = ARCH_FOOT_RADIUS,
): RallyArch => {
  const n = track.points.length;
  // Le circuit garde son pas moyen, et ses colliders d'arche au bit près.
  const index = track.closed
    ? Math.min(n - 1, Math.round(s / stepOf(track)))
    : track.indexAt(s);
  const point = track.points[index];
  // Dernier point d'un tracé ouvert : le cap vient du segment précédent.
  const atEnd = !track.closed && index === n - 1;
  const from = atEnd ? track.points[index - 1] : point;
  const to = atEnd ? point : track.points[(index + 1) % n];
  const yaw = Math.atan2(from.x - to.x, from.z - to.z);
  const rotation = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
  const halfWidth = track.widths[index] / 2;
  // Sur une 2×2 voies, les pieds se rapprochent pour rester avant la glissière du terre-plein (PR-19, option B).
  const median = medianLimit(
    track,
    point,
    { x: Math.cos(yaw), z: -Math.sin(yaw) },
    halfWidth + 1.5,
    footRadius,
  );
  const halfSpan = Math.min(halfWidth + 1.5, median ?? Number.POSITIVE_INFINITY);
  // Même placement des pieds que leurs colliders (`colliders.ts`) : gauche puis droite.
  const groundUnder = (side: number): number | null =>
    track.terrain
      ? track.groundAt(
          point.x + Math.cos(yaw) * side * halfSpan,
          point.z - Math.sin(yaw) * side * halfSpan,
        )
      : point.y;
  const grounds = [groundUnder(-1), groundUnder(1)];
  // Pas la place entre la voie et le terre-plein : banderole, comme un pied sans sol (PR-19, option C).
  const cramped = median !== null && median < halfWidth + BANNER_MAST_EDGE;
  const banner =
    allowBanner &&
    (cramped ||
      grounds.some((g) => g === null || Math.abs(g - point.y) > ARCH_MAX_LEG));
  if (banner)
    return {
      position: point,
      rotation,
      halfSpan: Math.min(
        halfWidth + BANNER_MAST_EDGE,
        (median ?? Number.POSITIVE_INFINITY) + footRadius - BANNER_MAST_RADIUS,
      ),
      feet: [point.y, point.y],
      banner,
      postRadius: BANNER_MAST_RADIUS,
    };
  return {
    position: point,
    rotation,
    halfSpan,
    feet: [grounds[0] ?? point.y, grounds[1] ?? point.y],
    banner,
  };
};

/** Arche de départ, devant la voiture sur sa grille : partagée entre le rendu et les collisions. Toujours une arche : elle porte les feux. */
export const startArch = (track: Track): RallyArch =>
  archAt(track, track.startS + ARCH_S, false);

/** Arche d'arrivée, sur la ligne : partagée entre le rendu et les collisions. */
export const finishArch = (track: Track): RallyArch =>
  archAt(track, track.finishS, true);

/**
 * Arches des intermédiaires, aux mêmes abscisses que le chrono (`splitGates`) : partagées entre le rendu et les
 * collisions, leurs pieds se percutent comme les poteaux du départ.
 */
/** Rayon des boudins d'une arche de secteur : rendu et collider ont la même épaisseur, en mètres */
export const SPLIT_ARCH_TUBE = 0.65;

export const splitArches = (track: Track): RallyArch[] => {
  const course = raceCourse(track);
  return splitGates(course.startS, course.finishS - course.startS).map((s) => ({
    postRadius: SPLIT_ARCH_TUBE,
    ...archAt(track, track.closed ? s % track.length : s, true, SPLIT_ARCH_TUBE),
  }));
};

export { signedCurvature };

/**
 * Décor pseudo-aléatoire le long d'un tracé quelconque.
 * Même tracé et même graine donnent le même décor au bit près.
 */
export const generateScenery = (track: Track, seed: number): SceneryItem[] => {
  const random = createRandom(seed);
  const items: SceneryItem[] = [];
  const { closed } = track;
  // Un aller-retour reçoit son décor une seule fois : le retour longe celui de l'aller.
  const { points, widths } = track.unique;
  const n = points.length;
  const step = stepOf(track);
  const span = track.shared ? step * (n - 1) : track.length;
  // Voisin sur l'axe : on boucle sur un tracé fermé, on s'arrête aux extrémités sur un tracé ouvert.
  const at = (i: number) =>
    closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];

  /**
   * Altitude de pose d'un objet léger sur un terrain, `null` si la pente est trop forte. Sur le point le plus haut
   * de son emprise : enfoncé, il se réveillerait au premier contact et dévalerait la pente sans le moindre choc.
   */
  const seatOnTerrain = (
    x: number,
    z: number,
    y: number,
    reach: number,
  ): number | null => {
    if (!track.terrain) return y;
    let top = y;
    for (const dx of [-reach, reach])
      for (const dz of [-reach, reach])
        top = Math.max(top, track.groundAt(x + dx, z + dz) ?? y);
    return top - y > MAX_PROP_LIFT ? null : top;
  };

  /**
   * Pose d'une botte sur un terrain : inclinée selon la pente, juste au-dessus du point le plus haut de son plan.
   * `null` si le sol est trop raide ou trop irrégulier pour qu'elle y repose à plat.
   */
  const seatHay = (
    x: number,
    z: number,
    y: number,
  ): { y: number; up?: Vec3 } | null => {
    if (!track.terrain) return { y };
    const rim: number[] = [];
    for (const [dx, dz] of HAY_RIM) {
      const height = track.groundAt(x + dx, z + dz);
      if (height === null || Math.abs(height - y) > MAX_PROP_LIFT) return null;
      rim.push(height);
    }
    let slopeX = 0;
    let slopeZ = 0;
    HAY_RIM.forEach(([dx, dz], i) => {
      slopeX += (dx * rim[i]) / HAY_RIM_WEIGHT;
      slopeZ += (dz * rim[i]) / HAY_RIM_WEIGHT;
    });
    let lift = 0;
    let sink = 0;
    HAY_RIM.forEach(([dx, dz], i) => {
      const gap = rim[i] - (y + slopeX * dx + slopeZ * dz);
      lift = Math.max(lift, gap);
      sink = Math.min(sink, gap);
    });
    if (lift - sink > HAY_MAX_GAP) return null;
    const length = Math.sqrt(slopeX * slopeX + 1 + slopeZ * slopeZ);
    return {
      y: y + lift,
      up: { x: -slopeX / length, y: 1 / length, z: -slopeZ / length },
    };
  };

  const place = (
    kind: SceneryKind,
    x: number,
    z: number,
    yaw: number,
    scale: number,
    minDistance: number,
    colliderRadius: number,
  ): boolean => {
    const sample = track.nearest(x, z);
    if (sample.distance < minDistance) return false;
    const ground = track.groundAt(x, z);
    if (ground === null) return false;
    if (
      track.terrain &&
      (kind === "tree" || kind === "pine") &&
      slopeAt(track, x, z) > MAX_TREE_SLOPE
    )
      return false;
    const hay = isHay(kind) ? seatHay(x, z, ground) : null;
    if (isHay(kind) && !hay) return false;
    const y =
      hay?.y ??
      (isLightProp(kind)
        ? seatOnTerrain(x, z, ground, POLE_FOOTPRINT)
        : ground);
    if (y === null) return false;
    items.push({
      kind,
      position: { x, y, z },
      yaw,
      ...(hay?.up ? { up: hay.up } : {}),
      scale,
      colliderRadius:
        sample.distance <= NEAR_SCENERY_DISTANCE ? colliderRadius * scale : 0,
    });
    return true;
  };

  const lateralPoint = (i: number, lateral: number): [number, number] => {
    const p = points[i];
    const a = at(i - 1);
    const b = at(i + 1);
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return [
      p.x - ((b.z - a.z) / len) * lateral,
      p.z + ((b.x - a.x) / len) * lateral,
    ];
  };

  // Bottes de paille à l'extérieur des virages, panneau 60 m avant le début de chacun.
  const curvature = signedCurvature(track, points);
  const hayEvery = Math.max(1, Math.round(6 / step));
  const signAhead = Math.round(60 / step);
  // Générateur à part : le choix debout ou couché ne décale pas le tirage du reste du décor.
  const hayRandom = createRandom(seed ^ 0x5bd1e995);
  const isBend = (i: number): boolean =>
    Math.abs(curvature[(i + n) % n]) > 1 / BEND_RADIUS;
  for (let i = 0; i < n; i++) {
    if (!isBend(i)) continue;
    const outside = curvature[i] > 0 ? -1 : 1;
    const halfWidth = widths[i] / 2;
    const lateral = outside * (halfWidth + FURNITURE_CLEARANCE + 0.8);
    if (i % hayEvery === 0) {
      const [x, z] = lateralPoint(i, lateral);
      place(
        hayRandom() < HAY_UPRIGHT_SHARE ? "hayUpright" : "hay",
        x,
        z,
        random() * Math.PI * 2,
        0.9 + random() * 0.2,
        halfWidth + FURNITURE_CLEARANCE,
        0.75,
      );
    }
    if (!isBend(i - 1) && (closed || i >= signAhead)) {
      const j = (i - signAhead + n) % n;
      const [x, z] = lateralPoint(j, lateral);
      const a = at(j - 1);
      const b = at(j + 1);
      // Le panneau regarde le pilote qui arrive.
      place(
        "sign",
        x,
        z,
        Math.atan2(a.x - b.x, a.z - b.z),
        1,
        halfWidth + FURNITURE_CLEARANCE,
        0.2,
      );
    }
  }

  // Végétation proche : un bouquet tous les quelques mètres, de chaque côté, pour faire défiler la vitesse.
  // Avec un décor réel, seuls les rochers restent : les arbres viennent des vraies zones de végétation.
  const decor = track.decor;
  const rollKind = (): SceneryKind => {
    const roll = random();
    return roll < 0.45 ? "pine" : roll < 0.85 ? "tree" : "rock";
  };
  const nearEvery = Math.max(1, Math.round(5 / step));
  for (let i = 0; i < n; i += nearEvery) {
    const side = random() < 0.5 ? -1 : 1;
    const halfWidth = widths[i] / 2;
    const offset = halfWidth + VEGETATION_CLEARANCE + random() * random() * 45;
    const [x, z] = lateralPoint(i, side * offset);
    const kind = rollKind();
    // Tirés dans l'ordre d'origine (cap puis échelle) : sans décor, la suite des tirages ne bouge pas.
    const yaw = random() * Math.PI * 2;
    const scale = kind === "rock" ? 0.5 + random() * 0.9 : 0.8 + random() * 0.7;
    if (decor && kind !== "rock") continue;
    place(
      kind,
      x,
      z,
      yaw,
      scale,
      halfWidth + VEGETATION_CLEARANCE,
      VEGETATION_COLLIDER[kind],
    );
  }

  const looseClearance = new Map<SceneryItem, number>();
  if (decor) {
    // Les arbres réels remplacent la végétation proche et lointaine. Retirés comme le reste près des chicanes.
    for (const tree of decorTreeItems(track, decor.trees, looseClearance))
      items.push(tree);
  } else {
    // Végétation lointaine : un fond sans collision ni ombre.
    const xs = points.map((p) => p.x);
    const zs = points.map((p) => p.z);
    const minX = Math.min(...xs) - 280;
    const maxX = Math.max(...xs) + 280;
    const minZ = Math.min(...zs) - 280;
    const maxZ = Math.max(...zs) + 280;
    for (let i = 0; i < 420; i++) {
      const x = minX + random() * (maxX - minX);
      const z = minZ + random() * (maxZ - minZ);
      const kind = random() < 0.6 ? "pine" : "tree";
      place(
        kind,
        x,
        z,
        random() * Math.PI * 2,
        0.9 + random() * 0.9,
        NEAR_SCENERY_DISTANCE,
        0,
      );
    }
  }

  // Plots blancs tous les 100 m, de chaque côté : repères de vitesse, et on peut les renverser.
  for (let s = 0; s < span; s += POST_SPACING) {
    const i = closed
      ? Math.round((s / span) * n) % n
      : Math.min(n - 2, Math.round(s / step));
    const p = points[i];
    const q = points[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    const postOffset = widths[i] / 2 + SHOULDER_WIDTH + 0.5;
    for (const side of [-1, 1]) {
      const x = p.x - ((q.z - p.z) / len) * side * postOffset;
      const z = p.z + ((q.x - p.x) / len) * side * postOffset;
      // Dans une épingle, le plot d'une branche peut tomber sur la voisine : on le retire.
      const sample = track.nearest(x, z);
      if (sample.distance < sample.width / 2 + 2) continue;
      // Au pied du talus quand la route est surélevée, pour ne pas flotter jusqu'au premier choc.
      const ground = track.groundAt(x, z);
      const postY =
        ground === null ? null : seatOnTerrain(x, z, ground, POLE_FOOTPRINT);
      if (postY === null) continue;
      items.push({
        kind: "post",
        position: {
          x,
          y: postY,
          z,
        },
        yaw: 0,
        scale: 1,
        colliderRadius: 0.1,
      });
    }
  }

  // Public : générateur à part, tiré après tout le reste et ajouté en fin de liste. Avec ou sans lui,
  // le reste du décor est identique au bit près ; il n'en retire jamais rien.
  const spectatorRandom = createRandom(seed ^ 0x27d4eb2d);
  const crowd: SceneryItem[] = [];
  /** Épingles et leur public, pour l'habillage rallye (story 5.5) */
  const hairpinGroups: (RallyHairpin & { members: SceneryItem[] })[] = [];
  const indexAt = (i: number): number =>
    closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
  // Emprises des bâtiments et de l'eau réels, partagées avec le retrait du mobilier plus bas.
  const { inBuilding, inWater } = createDecorFootprints(decor);

  /** Groupe de `size` spectateurs sur `spread` mètres autour de l'indice `center`, du côté `side`. */
  const crowdAt = (
    center: number,
    side: number,
    size: number,
    spread: number,
  ): void => {
    for (let k = 0; k < size; k++) {
      // Toujours quatre tirages par spectateur, même écarté : la suite ne dépend pas des filtres.
      const along = (spectatorRandom() - 0.5) * spread;
      const depth = spectatorRandom() * 3;
      const turn = (spectatorRandom() - 0.5) * 0.8;
      const scale = 0.9 + spectatorRandom() * 0.2;
      if (crowd.length >= MAX_SPECTATORS) continue;
      const i = indexAt(center + Math.round(along / step));
      const lateral = widths[i] / 2 + SPECTATOR_CLEARANCE + 0.5 + depth;
      const [x, z] = lateralPoint(i, side * lateral);
      // La route la plus proche, l'autre branche d'une épingle comprise.
      const sample = track.nearest(x, z);
      if (sample.distance - sample.width / 2 < SPECTATOR_CLEARANCE) continue;
      const ground = track.groundAt(x, z);
      if (ground === null) continue;
      if (track.terrain && slopeAt(track, x, z) > MAX_SPECTATOR_SLOPE) continue;
      if (inBuilding(x, z) || inWater(x, z)) continue;
      const p = points[i];
      crowd.push({
        kind: "spectator",
        position: { x, y: ground, z },
        // Face à la route, à peu près : le cap varie aussi la teinte au rendu.
        yaw: Math.atan2(p.x - x, p.z - z) + turn,
        scale,
        colliderRadius: 0,
      });
    }
  };
  const groupSize = (min: number, max: number): number =>
    min + Math.floor(spectatorRandom() * (max - min + 1));

  // Le départ d'abord, des deux côtés, de 20 à 60 m après la ligne : jamais coupé par le plafond.
  const startIndex = indexAt(Math.round((track.startS + 40) / step));
  for (const side of [-1, 1]) crowdAt(startIndex, side, groupSize(12, 20), 40);
  // Puis chaque virage à bottes, à l'extérieur et derrière elles : toujours aux épingles, parfois ailleurs.
  // ponytail: un virage qui chevauche l'indice 0 d'un circuit compte pour deux, sans gravité.
  for (let i = 0; i < n;) {
    if (!isBend(i)) {
      i++;
      continue;
    }
    let apex = i;
    let j = i;
    for (; j < n && isBend(j); j++)
      if (Math.abs(curvature[j]) > Math.abs(curvature[apex])) apex = j;
    const roll = spectatorRandom();
    const side = curvature[apex] > 0 ? -1 : 1;
    if (Math.abs(curvature[apex]) > 1 / HAIRPIN_RADIUS) {
      const from = crowd.length;
      crowdAt(apex, side, groupSize(12, 20), 24);
      hairpinGroups.push({
        apex,
        side,
        curvature: Math.abs(curvature[apex]),
        members: crowd.slice(from),
      });
    } else if (roll < BEND_CROWD_SHARE)
      crowdAt(apex, side, groupSize(6, 10), 14);
    i = j;
  }

  // Retiré après coup : les tirages ne se décalent pas, le reste du décor ne bouge pas.
  const clearOfBlocks = (item: SceneryItem): boolean =>
    !track.obstacles.some((block) =>
      isNearBlock(block, item.position.x, item.position.z, BLOCK_CLEARANCE),
    ) &&
    // Rien sur l'îlot ni à cheval sur sa barrière.
    !track.islands.some(
      ({ position, radius }) =>
        Math.hypot(
          item.position.x - position.x,
          item.position.z - position.z,
        ) <=
        radius + BLOCK_CLEARANCE,
    );

  // Mobilier et rochers hors des bâtiments et de l'eau réels, retirés après coup comme le reste. Les arbres réels
  // sont déjà écartés par le pipeline. Sans décor, rien n'est retiré : le décor reste le même au bit près.
  const clearOfDecor = (item: SceneryItem): boolean =>
    !decor ||
    DECOR_VEGETATION.has(item.kind) ||
    isLooseVegetation(item.kind) ||
    !(
      inBuilding(item.position.x, item.position.z) ||
      inWater(item.position.x, item.position.z)
    );

  // Une botte posée sur un panneau ou un plot les ferait exploser au premier choc : la botte cède la place.
  // Les annonces de chicane passent en dernier : sans chicane, le décor et le monde restent les mêmes au bit près.
  const signs = chicaneSignItems(track).filter(clearOfDecor);
  const standing = [...items, ...signs].filter(
    (item) =>
      (item.kind === "post" ||
        item.kind === "sign" ||
        isChicaneSign(item.kind)) &&
      clearOfDecor(item),
  );
  const kept = items.filter(
    (item) =>
      clearOfBlocks(item) &&
      clearOfDecor(item) &&
      (!isHay(item.kind) ||
        standing.every(
          (other) =>
            Math.hypot(
              other.position.x - item.position.x,
              other.position.z - item.position.z,
            ) > HAY_CLEARANCE,
        )),
  );
  // Public, habillage et panneaux restent à hauteur de route : jamais perchés sur un versant ni au fond d'un ravin.
  // La végétation n'y est pas soumise.
  const atRoadLevel = (item: SceneryItem): boolean =>
    !track.terrain ||
    Math.abs(
      item.position.y - track.nearest(item.position.x, item.position.z).point.y,
    ) <= MAX_ROAD_GAP;
  const clearForObject = (item: SceneryItem): boolean =>
    clearOfBlocks(item) && atRoadLevel(item);
  // Le public après : aucun indice d'objet existant ne bouge.
  const crowdKept = crowd.filter(clearForObject);
  // Habillage rallye tout à la fin, générateur à part : seules les bottes devant le public des épingles cèdent la place.
  const keptCrowd = new Set(crowdKept);
  // Panneaux de freinage après tout le reste : sans eux, le décor et le monde restent les mêmes au bit près.
  // Un panneau posé sur un objet léger les ferait exploser au premier pas : il cède la place.
  const withBoards = (base: SceneryItem[]): SceneryItem[] => {
    const light = base.filter((item) => isLightProp(item.kind));
    const boards = brakeBoardItems(track).filter(
      (board) =>
        clearForObject(board) &&
        clearOfDecor(board) &&
        light.every(
          (other) =>
            Math.hypot(
              other.position.x - board.position.x,
              other.position.z - board.position.z,
            ) > HAY_CLEARANCE,
        ),
    );
    // Séparateurs des îlots de rond-point en tout dernier : sans rond-point, rien ne change au bit près.
    return [...base, ...boards, ...islandSeparatorItems(track)];
  };
  const dress = (base: SceneryItem[]): SceneryItem[] =>
    withBoards(
      rallyDressing({
        track,
        seed,
        items: base,
        hairpins: hairpinGroups.filter((group) =>
          group.members.some((member) => keptCrowd.has(member)),
        ),
        startS: track.startS + ARCH_S,
        inBuilding,
        inWater,
        clear: clearForObject,
      }),
    );
  if (looseClearance.size === 0)
    return dress([...kept, ...signs, ...crowdKept]);

  // Végétation renversable tout à la fin : les objets légers d'origine gardent leur ordre et leurs corps.
  // Un candidat qui chevauche un autre corps, un collider fixe, un bâtiment ou l'eau, sur un sol trop raide,
  // ou au-delà du plafond, redevient un décor fixe sans collider : il reste dessiné, avec son ombre.
  const occupied = createFootprintIndex();
  for (const item of [...kept, ...signs]) {
    if (isLooseVegetation(item.kind)) continue;
    const half = isHay(item.kind)
      ? HAY_FOOTPRINT
      : isLightProp(item.kind)
        ? Math.max(item.colliderRadius, POLE_FOOTPRINT)
        : item.colliderRadius;
    if (half > 0)
      occupied.add({
        x: item.position.x,
        z: item.position.z,
        yaw: 0,
        halfX: half,
        halfZ: half,
        round: true,
      });
  }
  // Les plus proches de la route d'abord, puis l'ordre du pipeline : tri total, même décor au bit près.
  const candidates = kept
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isLooseVegetation(item.kind))
    .sort(
      (a, b) =>
        (looseClearance.get(a.item) ?? 0) - (looseClearance.get(b.item) ?? 0) ||
        a.index - b.index,
    );
  const accepted = new Map<SceneryItem, SceneryItem>();
  for (const { item } of candidates) {
    if (accepted.size >= MAX_LOOSE_VEGETATION) break;
    const bush = item.kind === "bushProp";
    const footprint: Footprint = {
      x: item.position.x,
      z: item.position.z,
      yaw: item.yaw,
      halfX: (bush ? BUSH_RADIUS : VINE_HALF_LENGTH) + LOOSE_MARGIN,
      halfZ: (bush ? BUSH_RADIUS : VINE_HALF_WIDTH) + LOOSE_MARGIN,
      round: bush,
    };
    if (occupied.hits(footprint)) continue;
    const [ax, az, bx, bz] = axesOf(item.yaw);
    const signsOf: [number, number][] = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    const blocked = signsOf.some(([su, sv]) => {
      const x =
        footprint.x + su * footprint.halfX * ax + sv * footprint.halfZ * bx;
      const z =
        footprint.z + su * footprint.halfX * az + sv * footprint.halfZ * bz;
      return inBuilding(x, z) || inWater(x, z);
    });
    if (blocked) continue;
    const seat = seatLoose(track, footprint, item.position.y);
    if (!seat) continue;
    occupied.add(footprint);
    accepted.set(item, {
      ...item,
      position: { ...item.position, y: seat.y },
      ...(seat.up ? { up: seat.up } : {}),
    });
  }
  const fixed = kept.flatMap((item): SceneryItem[] => {
    if (!isLooseVegetation(item.kind)) return [item];
    if (accepted.has(item)) return [];
    return [
      {
        ...item,
        kind: item.kind === "bushProp" ? "bush" : "vineRow",
        colliderRadius: 0,
      },
    ];
  });
  const loose = kept.flatMap((item) => {
    const seated = accepted.get(item);
    return seated ? [seated] : [];
  });
  return dress([...fixed, ...signs, ...crowdKept, ...loose]);
};
