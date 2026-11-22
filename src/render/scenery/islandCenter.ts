// Cœur des îlots de rond-point, rendu seul : tout ce qui est planté tient dans le collider cylindrique du cœur
// (`colliders.ts`), la simulation ne voit donc rien de ce fichier.
import { Matrix4, Quaternion, Vector3 } from "three";
import {
  islandCoreRadius,
  SEPARATOR_MIN_ISLAND,
} from "@/sim/track/islandSeparators";
import type { RoundaboutIsland, StageDecor, Track, Vec3 } from "@/sim/types";

const UP = new Vector3(0, 1, 0);
/** Relevés du sol sur le bord du cœur d'îlot, pour en lire la pente */
const SLOPE_SAMPLES = 8;
/** Le cœur s'enfonce d'autant sous son plan moyen : son bord bas ne laisse pas voir de jour sur une route bosselée */
export const ISLAND_SINK = 0.05;

/** Au-delà de ce rayon d'îlot, le massif est complet (PR-20) ; en deçà, une version légère, en mètres */
const FULL_ISLAND = 8;
/** Ville : au moins tant de bâtiments réels à moins de `TOWN_REACH` mètres du centre */
const TOWN_BUILDINGS = 6;
const TOWN_REACH = 80;
/** Montagne : au-dessus de cette altitude, ou plus de `MOUNTAIN_RELIEF` m de dénivelé dans les `RELIEF_REACH` m alentour */
const MOUNTAIN_ALTITUDE = 700;
const MOUNTAIN_RELIEF = 50;
const RELIEF_REACH = 400;

export interface GroundPlane {
  y: number;
  tilt: Quaternion;
  normal: Vector3;
}

/**
 * Plan moyen du sol sous un disque de rayon `radius` (B-14) : le cœur d'un îlot suit la pente de l'anneau au lieu de
 * flotter du côté bas. Relevés en couronne, pentes par moindres carrés (Σ cos² = Σ sin² = N / 2).
 */
export const groundPlane = (
  groundAt: Track["groundAt"],
  x: number,
  z: number,
  radius: number,
  fallback: number,
): GroundPlane => {
  let sum = 0;
  let slopeX = 0;
  let slopeZ = 0;
  for (let k = 0; k < SLOPE_SAMPLES; k++) {
    const angle = (k / SLOPE_SAMPLES) * 2 * Math.PI;
    const h =
      groundAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius) ??
      fallback;
    sum += h;
    slopeX += Math.cos(angle) * h;
    slopeZ += Math.sin(angle) * h;
  }
  const half = (SLOPE_SAMPLES / 2) * radius;
  const normal = new Vector3(-slopeX / half, 1, -slopeZ / half).normalize();
  return {
    y: sum / SLOPE_SAMPLES,
    tilt: new Quaternion().setFromUnitVectors(UP, normal),
    normal,
  };
};

/** Milieu d'un rond-point, d'où sa variante de massif (PR-20) : A2 en ville, A3 en montagne, A1 en campagne. */
export type IslandSetting = "town" | "mountain" | "country";

export const islandSetting = (
  island: RoundaboutIsland,
  decor: StageDecor | undefined,
  points: Vec3[],
): IslandSetting => {
  const { x, y, z } = island.position;
  const near = (decor?.buildings ?? []).filter(({ footprint }) => {
    const corner = footprint[0];
    return corner && Math.hypot(corner.x - x, corner.z - z) <= TOWN_REACH;
  }).length;
  if (near >= TOWN_BUILDINGS) return "town";
  let low = y;
  let high = y;
  for (const p of points)
    if (Math.hypot(p.x - x, p.z - z) <= RELIEF_REACH) {
      low = Math.min(low, p.y);
      high = Math.max(high, p.y);
    }
  return y >= MOUNTAIN_ALTITUDE || high - low >= MOUNTAIN_RELIEF
    ? "mountain"
    : "country";
};

/** Instances du centre des grands îlots, par géométrie. */
export interface IslandPlanting {
  planters: Matrix4[];
  lawns: Matrix4[];
  mounds: Matrix4[];
  flowersPink: Matrix4[];
  flowersYellow: Matrix4[];
  bushes: Matrix4[];
  stones: Matrix4[];
  oaks: Matrix4[];
  birches: Matrix4[];
  pines: Matrix4[];
}

export const emptyPlanting = (): IslandPlanting => ({
  planters: [],
  lawns: [],
  mounds: [],
  flowersPink: [],
  flowersYellow: [],
  bushes: [],
  stones: [],
  oaks: [],
  birches: [],
  pines: [],
});

/** Assez grand pour un massif : les plus petits gardent le cœur seul de PR-16. */
export const hasPlanting = (island: RoundaboutIsland): boolean =>
  island.radius >= SEPARATOR_MIN_ISLAND;

const FLAT = new Quaternion();

/**
 * Massif au centre d'un îlot (PR-20), ajouté à `out` : léger jusqu'à `FULL_ISLAND`, complet au-delà. Pas d'objet
 * repère : ni sculpture, ni machine. Tirages stables d'un chargement à l'autre, calés sur le centre.
 */
export const plantIsland = (
  island: RoundaboutIsland,
  setting: IslandSetting,
  groundAt: Track["groundAt"],
  out: IslandPlanting,
): void => {
  const core = islandCoreRadius(island);
  const { x, z } = island.position;
  const plane = groundPlane(groundAt, x, z, core, island.position.y);
  const full = island.radius > FULL_ISLAND;
  const phase = x * 0.37 + z * 0.11;
  const base = new Matrix4().compose(
    new Vector3(x, plane.y - ISLAND_SINK, z),
    plane.tilt,
    new Vector3(core, 1, core),
  );
  /** Sol sous un point du massif, rehaussé de `lift` (dessus de la jardinière, de la butte) */
  const at = (px: number, pz: number, lift: number): Vector3 =>
    new Vector3(px, (groundAt(px, pz) ?? plane.y) + lift, pz);
  const ring = (
    radius: number,
    count: number,
    offset: number,
    put: (px: number, pz: number, angle: number, k: number) => void,
  ): void => {
    for (let k = 0; k < count; k++) {
      const angle = offset + (k / count) * 2 * Math.PI;
      put(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius, angle, k);
    }
  };
  const along = (radius: number, spacing: number): number =>
    Math.max(4, Math.round((2 * Math.PI * radius) / spacing));
  const item = (position: Vector3, size: number, yaw = 0): Matrix4 =>
    new Matrix4().compose(
      position,
      yaw === 0 ? FLAT : new Quaternion().setFromAxisAngle(UP, yaw),
      new Vector3(size, size, size),
    );
  const treeSize = full ? 1 : 0.8;

  if (setting === "town") {
    // A2 · jardin municipal : jardinière, couronnes de fleurs, buissons taillés aux quatre points cardinaux, arbres.
    const top = 0.7 - ISLAND_SINK;
    out.planters.push(base);
    const patch = Math.min(1, core / 4);
    if (full)
      ring(core * 0.45, along(core * 0.45, 1.2), phase, (px, pz) =>
        out.flowersPink.push(item(at(px, pz, top), patch)),
      );
    ring(core * 0.68, along(core * 0.68, 1.2), phase, (px, pz) =>
      out.flowersYellow.push(item(at(px, pz, top), patch)),
    );
    ring(core * 0.82, 4, Math.PI / 4, (px, pz) =>
      out.bushes.push(item(at(px, pz, top), Math.min(1.2, core * 0.18))),
    );
    if (full)
      ring(core * 0.22, 2, phase, (px, pz, angle) =>
        out.birches.push(item(at(px, pz, top), treeSize, angle)),
      );
    else out.birches.push(item(at(x, z, top), treeSize, phase));
    return;
  }

  if (setting === "mountain") {
    // A3 · rocaille : butte de gravier ocre, rochers en couronne, pins.
    const top = 0.45 - ISLAND_SINK;
    out.mounds.push(base);
    const stone = Math.min(core * 0.3, 0.9);
    ring(
      core * 0.72,
      along(core * 0.72, full ? 1.8 : 2.4),
      phase,
      (px, pz, angle, k) => {
        const size = stone * (0.8 + (0.4 * ((k * 7) % 5)) / 4);
        out.stones.push(
          new Matrix4().compose(
            at(px, pz, top * 0.5),
            new Quaternion().setFromAxisAngle(UP, angle * 3),
            new Vector3(size, size * 0.8, size),
          ),
        );
      },
    );
    if (full)
      ring(core * 0.35, 3, phase, (px, pz, angle) =>
        out.pines.push(item(at(px, pz, top), treeSize, angle)),
      );
    else out.pines.push(item(at(x, z, top), treeSize, phase));
    return;
  }

  // A1 · bosquet bocager : pelouse, haie basse en couronne, feuillus et buissons.
  out.lawns.push(base);
  ring(core * 0.84, along(core * 0.84, 1.4), phase, (px, pz, angle) =>
    out.bushes.push(item(at(px, pz, 0), 0.9, angle)),
  );
  if (full) {
    ring(core * 0.35, 3, phase, (px, pz, angle) =>
      out.oaks.push(item(at(px, pz, 0), treeSize, angle)),
    );
    ring(core * 0.55, 2, phase + Math.PI / 3, (px, pz) =>
      out.bushes.push(item(at(px, pz, 0), 1.1)),
    );
  } else out.oaks.push(item(at(x, z, 0), treeSize, phase));
};
