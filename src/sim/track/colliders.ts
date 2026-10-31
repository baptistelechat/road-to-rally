import type RAPIER_TYPES from "@dimforge/rapier3d-deterministic-compat";
import { isLightProp } from "../lightProps";
import { RAPIER } from "../rapier";
import type { MeshData, SceneryItem, Track } from "../types";
import { embankment, GROUND_Y } from "./ribbon";
import { startArch } from "./scenery";

/** Hauteur des colliders de décor : assez haut pour qu'une voiture ne monte jamais dessus */
const OBSTACLE_HEIGHT = 4;
const GROUND_THICKNESS = 10;
const GROUND_MARGIN = 2000;

const addTrimesh = (world: RAPIER_TYPES.World, mesh: MeshData): void => {
  // FIX_INTERNAL_EDGES : la caisse ne doit pas accrocher les arêtes entre triangles coplanaires.
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(
      mesh.positions,
      mesh.indices,
      RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
    ).setFriction(0.6),
  );
};

const addObstacle = (
  world: RAPIER_TYPES.World,
  x: number,
  y: number,
  z: number,
  radius: number,
): void => {
  // Cylindre vertical glissant : on rebondit dessus sans s'y coincer ni décoller.
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(OBSTACLE_HEIGHT / 2, radius)
      .setTranslation(x, y + OBSTACLE_HEIGHT / 2, z)
      .setFriction(0.2)
      .setRestitution(0.25),
  );
};

/** Route, sol hors route et talus, puis obstacles du décor proche. Tous fixes, dans le monde donné. */
export const addTrackColliders = (
  world: RAPIER_TYPES.World,
  track: Track,
  scenery: SceneryItem[],
): void => {
  addTrimesh(world, track.ribbon);
  const bank = embankment(track.points, track.width, track.closed);
  if (bank) addTrimesh(world, bank);

  const xs = track.points.map((p) => p.x);
  const zs = track.points.map((p) => p.z);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      (Math.max(...xs) - Math.min(...xs)) / 2 + GROUND_MARGIN,
      GROUND_THICKNESS / 2,
      (Math.max(...zs) - Math.min(...zs)) / 2 + GROUND_MARGIN,
    )
      .setTranslation(centerX, GROUND_Y - GROUND_THICKNESS / 2, centerZ)
      .setFriction(0.6),
  );

  for (const item of scenery)
    if (item.colliderRadius > 0 && !isLightProp(item.kind))
      addObstacle(
        world,
        item.position.x,
        item.position.y,
        item.position.z,
        item.colliderRadius,
      );

  const arch = startArch(track);
  const yaw = 2 * Math.atan2(arch.rotation.y, arch.rotation.w);
  for (const side of [-1, 1])
    addObstacle(
      world,
      arch.position.x + Math.cos(yaw) * side * arch.halfSpan,
      arch.position.y + GROUND_Y,
      arch.position.z - Math.sin(yaw) * side * arch.halfSpan,
      0.3,
    );
};
