import { useFrame } from "@react-three/fiber";
import { type RefObject, useRef } from "react";
import type { Group } from "three";
import { SHADOW_AHEAD, SHADOW_RANGE } from "@/render/Atmosphere";
import type { CarSource } from "@/render/carSource";
import type { Track } from "@/sim/types";

/** Longueur d'une tranche de décor le long de l'axe, en mètres */
export const CHUNK_LENGTH = 200;
/** Une tranche reste visible à moins de cette distance d'abscisse de la voiture */
const VISIBLE_ALONG = 800;
/** …ou à moins de cette distance à vol d'oiseau : une épingle rapproche deux tranches éloignées en abscisse */
const VISIBLE_AROUND = 350;
/**
 * Ombres portées seulement près de la voiture : jusqu'au coin de la zone d'ombre d'`Atmosphere`, avancée devant la
 * voiture, plus la marge du soleil rasant. Plus court, une tranche entière d'arbres allume ses ombres d'un coup au
 * milieu de la zone, sous les yeux.
 */
const SHADOW_AROUND = SHADOW_RANGE * Math.SQRT2 + SHADOW_AHEAD + 40;
/** L'abscisse de la voiture n'est recalculée qu'après ce déplacement : `nearest` alloue, pas question de l'appeler à chaque image */
const RESAMPLE_DISTANCE = 5;

/** Emprise horizontale d'une tranche, pour la distance à vol d'oiseau */
export interface ChunkInfo {
  index: number;
  x: number;
  z: number;
  radius: number;
}

export interface Chunk<T> {
  info: ChunkInfo;
  items: T[];
}

interface Point {
  x: number;
  z: number;
}

const chunkIndex = (track: Track, p: Point): number => {
  const { s } = track.nearest(p.x, p.z);
  // Tracé fermé : l'abscisse boucle, la dernière tranche touche la première.
  const along = track.closed
    ? ((s % track.length) + track.length) % track.length
    : s;
  return Math.floor(along / CHUNK_LENGTH);
};

const bounds = <T>(items: T[], at: (item: T) => Point) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const item of items) {
    const p = at(item);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    radius: Math.hypot(maxX - minX, maxZ - minZ) / 2,
  };
};

/**
 * Range chaque objet dans la tranche de son point d'axe le plus proche, tranches dans l'ordre de l'axe.
 * Sans piste : une seule tranche, jamais masquée (aperçu du tracé).
 */
export const splitIntoChunks = <T>(
  items: T[],
  at: (item: T) => Point,
  track?: Track,
): Chunk<T>[] => {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const index = track ? chunkIndex(track, at(item)) : 0;
    const group = groups.get(index);
    if (group) group.push(item);
    else groups.set(index, [item]);
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([index, group]) => ({
      info: { index, ...bounds(group, at) },
      items: group,
    }));
};

/** Écart d'abscisse entre la voiture et la tranche, 0 si elle est dedans. */
const alongGap = (index: number, s: number, track: Track): number => {
  const start = index * CHUNK_LENGTH;
  const end = start + CHUNK_LENGTH;
  const gap = (at: number): number => Math.max(0, start - at, at - end);
  return track.closed
    ? Math.min(gap(s), gap(s + track.length), gap(s - track.length))
    : gap(s);
};

/**
 * Masque les tranches lointaines et coupe leurs ombres, sans rien recréer ni allouer par image.
 * Chaque enfant direct de `root` est une tranche (`userData.chunk`), chacun de ses maillages porte `userData.shadow`
 * s'il a droit à une ombre de près. Le frustum culling de three fait le reste, sur les sphères englobantes de chaque tranche.
 */
export const useChunkCulling = (
  track?: Track,
  source?: CarSource,
): RefObject<Group | null> => {
  // Créée ici : le compilateur React interdit à un hook de modifier un argument, mais pas sa propre ref.
  const root = useRef<Group>(null);
  // Dernière abscisse connue de la voiture et position où elle a été calculée.
  const followRef = useRef({ s: Number.NaN, x: 0, z: 0 });

  useFrame(() => {
    const follow = followRef.current;
    const group = root.current;
    const pose = source?.getPose();
    if (!group || !track || !pose) return;
    const { x, z } = pose.position;
    const known = !Number.isNaN(follow.s);
    if (
      !known ||
      (x - follow.x) ** 2 + (z - follow.z) ** 2 > RESAMPLE_DISTANCE ** 2
    ) {
      // L'abscisse suivie départage les deux passages d'un aller-retour.
      follow.s = track.nearest(x, z, known ? follow.s : undefined).s;
      follow.x = x;
      follow.z = z;
    }

    const chunks = group.children;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const info = chunk.userData.chunk as ChunkInfo | undefined;
      if (!info) continue;
      // Distance au bord de la tranche, pas à son centre : une tranche de 200 m sous les roues est à 0.
      const around = Math.max(
        0,
        Math.hypot(info.x - x, info.z - z) - info.radius,
      );
      const visible =
        alongGap(info.index, follow.s, track) < VISIBLE_ALONG ||
        around < VISIBLE_AROUND;
      chunk.visible = visible;
      const shadow = visible && around < SHADOW_AROUND;
      const meshes = chunk.children;
      for (let j = 0; j < meshes.length; j++)
        meshes[j].castShadow = shadow && meshes[j].userData.shadow === true;
    }
  });
  return root;
};
