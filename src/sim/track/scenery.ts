import { groundHeight, SHOULDER_WIDTH } from "./ribbon";
import type { Pose, SceneryItem, SceneryKind, Track } from "../types";

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
/** En dessous de ce rayon, un virage reçoit des bottes de paille et un panneau */
const BEND_RADIUS = 60;

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

/** Centre, côté droit et cap de l'arche de départ : partagé entre le rendu et les collisions. */
export const startArch = (track: Track): Pose & { halfSpan: number } => {
  const n = track.points.length;
  const step = track.length / n;
  const index = Math.min(n - 1, Math.round(ARCH_S / step));
  const point = track.points[index];
  const next = track.points[(index + 1) % n];
  const yaw = Math.atan2(point.x - next.x, point.z - next.z);
  return {
    position: point,
    rotation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
    halfSpan: track.width / 2 + 1.5,
  };
};

/** Courbure signée en chaque point sur une fenêtre de 10 pas : positive quand la route tourne à droite. */
const signedCurvature = (track: Track): number[] => {
  const { points, closed } = track;
  const n = points.length;
  const span = 5;
  return points.map((p, i) => {
    if (!closed && (i < span || i >= n - span)) return 0;
    const a = points[(i - span + n) % n];
    const b = points[(i + span) % n];
    const ux = p.x - a.x;
    const uz = p.z - a.z;
    const vx = b.x - p.x;
    const vz = b.z - p.z;
    const angle = Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz);
    return (2 * angle) / (Math.hypot(ux, uz) + Math.hypot(vx, vz));
  });
};

/**
 * Décor pseudo-aléatoire le long d'un tracé quelconque.
 * Même tracé et même graine donnent le même décor au bit près.
 */
export const generateScenery = (track: Track, seed: number): SceneryItem[] => {
  const random = createRandom(seed);
  const items: SceneryItem[] = [];
  const { points, width } = track;
  const n = points.length;
  const step = track.length / n;
  const halfWidth = width / 2;

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
    items.push({
      kind,
      position: { x, y: groundHeight(sample, width), z },
      yaw,
      scale,
      colliderRadius:
        sample.distance <= NEAR_SCENERY_DISTANCE ? colliderRadius * scale : 0,
    });
    return true;
  };

  const lateralPoint = (i: number, lateral: number): [number, number] => {
    const p = points[i];
    const a = points[(i - 1 + n) % n];
    const b = points[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return [
      p.x - ((b.z - a.z) / len) * lateral,
      p.z + ((b.x - a.x) / len) * lateral,
    ];
  };

  // Bottes de paille à l'extérieur des virages, panneau 60 m avant le début de chacun.
  const curvature = signedCurvature(track);
  const hayEvery = Math.max(1, Math.round(6 / step));
  const signAhead = Math.round(60 / step);
  const isBend = (i: number): boolean =>
    Math.abs(curvature[(i + n) % n]) > 1 / BEND_RADIUS;
  for (let i = 0; i < n; i++) {
    if (!isBend(i)) continue;
    const outside = curvature[i] > 0 ? -1 : 1;
    const lateral = outside * (halfWidth + FURNITURE_CLEARANCE + 0.8);
    if (i % hayEvery === 0) {
      const [x, z] = lateralPoint(i, lateral);
      place(
        "hay",
        x,
        z,
        random() * Math.PI * 2,
        0.9 + random() * 0.2,
        halfWidth + FURNITURE_CLEARANCE,
        0.75,
      );
    }
    if (!isBend(i - 1)) {
      const j = (i - signAhead + n) % n;
      const [x, z] = lateralPoint(j, lateral);
      const a = points[(j - 1 + n) % n];
      const b = points[(j + 1) % n];
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
  const rollKind = (): SceneryKind => {
    const roll = random();
    return roll < 0.45 ? "pine" : roll < 0.85 ? "tree" : "rock";
  };
  const colliderOf: Record<string, number> = {
    pine: 0.35,
    tree: 0.4,
    rock: 0.9,
  };
  const nearEvery = Math.max(1, Math.round(5 / step));
  for (let i = 0; i < n; i += nearEvery) {
    const side = random() < 0.5 ? -1 : 1;
    const offset = halfWidth + VEGETATION_CLEARANCE + random() * random() * 45;
    const [x, z] = lateralPoint(i, side * offset);
    const kind = rollKind();
    place(
      kind,
      x,
      z,
      random() * Math.PI * 2,
      kind === "rock" ? 0.5 + random() * 0.9 : 0.8 + random() * 0.7,
      halfWidth + VEGETATION_CLEARANCE,
      colliderOf[kind],
    );
  }

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

  // Plots blancs tous les 100 m, de chaque côté : repères de vitesse, et on peut les renverser.
  const postOffset = halfWidth + SHOULDER_WIDTH + 0.5;
  for (let s = 0; s < track.length; s += POST_SPACING) {
    const i = Math.round((s / track.length) * n) % n;
    const p = points[i];
    const q = points[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    for (const side of [-1, 1]) {
      const x = p.x - ((q.z - p.z) / len) * side * postOffset;
      const z = p.z + ((q.x - p.x) / len) * side * postOffset;
      // Au pied du talus quand la route est surélevée, pour ne pas flotter jusqu'au premier choc.
      const postY = groundHeight(track.nearest(x, z), width);
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

  // Une botte posée sur un panneau ou un plot les ferait exploser au premier choc : la botte cède la place.
  const standing = items.filter((item) => item.kind === "post" || item.kind === "sign");
  return items.filter(
    (item) =>
      item.kind !== "hay" ||
      standing.every(
        (other) =>
          Math.hypot(
            other.position.x - item.position.x,
            other.position.z - item.position.z,
          ) > HAY_CLEARANCE,
      ),
  );
};
