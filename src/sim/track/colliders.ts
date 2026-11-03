import type RAPIER_TYPES from "@dimforge/rapier3d-deterministic-compat";
import { isLightProp, RAY_IGNORED_GROUPS } from "../lightProps";
import { RAPIER } from "../rapier";
import type { MeshData, SceneryItem, Track } from "../types";
import { embankment, GROUND_Y, shoulderStrips } from "./ribbon";
import { finishArch, startArch } from "./scenery";

/** Hauteur des colliders de décor : assez haut pour qu'une voiture ne monte jamais dessus */
const OBSTACLE_HEIGHT = 4;
const GROUND_THICKNESS = 10;
const GROUND_MARGIN = 2000;
/** Glissant, à peine élastique : la voiture s'arrête contre la barrière sans y accrocher ni rebondir. */
const BLOCK_FRICTION = 0.2;
const BLOCK_RESTITUTION = 0.1;

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
  if (track.terrain) addTrimesh(world, track.terrain);
  else {
    const bank = embankment(
      track.unique.points,
      track.unique.widths,
      track.closed,
    );
    if (bank) addTrimesh(world, bank);
  }
  if (!track.closed)
    // Sur spéciale, le terrain n'a pas de talus dessous : les bas-côtés portent eux-mêmes les roues.
    for (const strip of shoulderStrips(
      track.unique.points,
      track.unique.widths,
      track.unique.shoulders,
      false,
    ))
      addTrimesh(world, strip);

  // Avec un terrain, rien sous la voiture hors du couloir : `recovery` la remet en piste.
  if (!track.terrain) {
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
  }

  for (const item of scenery)
    if (item.colliderRadius > 0 && !isLightProp(item.kind))
      addObstacle(
        world,
        item.position.x,
        item.position.y,
        item.position.z,
        item.colliderRadius,
      );

  const arches = track.closed
    ? [startArch(track)]
    : [startArch(track), finishArch(track)];
  for (const arch of arches) {
    const yaw = 2 * Math.atan2(arch.rotation.y, arch.rotation.w);
    for (const side of [-1, 1])
      addObstacle(
        world,
        arch.position.x + Math.cos(yaw) * side * arch.halfSpan,
        arch.position.y + GROUND_Y,
        arch.position.z - Math.sin(yaw) * side * arch.halfSpan,
        0.3,
      );
  }

  // Un bloc plein sur toute sa longueur, pas un collider par poteau : la caisse a son CCD, rien ne passe entre deux.
  // Dernier créé et dans l'ordre de la liste : sans chicane, le monde reste le même au bit près.
  for (const block of track.obstacles)
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        block.span / 2,
        (block.height + block.skirt) / 2,
        block.depth / 2,
      )
        .setTranslation(
          block.position.x,
          block.position.y + (block.height - block.skirt) / 2,
          block.position.z,
        )
        .setRotation({
          x: 0,
          y: Math.sin(block.yaw / 2),
          z: 0,
          w: Math.cos(block.yaw / 2),
        })
        .setFriction(BLOCK_FRICTION)
        .setRestitution(BLOCK_RESTITUTION)
        .setCollisionGroups(RAY_IGNORED_GROUPS),
    );

  // Après les chicanes : sans rond-point, le monde reste le même au bit près.
  for (const island of track.islands)
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(
        (island.height + island.skirt) / 2,
        island.radius,
      )
        .setTranslation(
          island.position.x,
          island.position.y + (island.height - island.skirt) / 2,
          island.position.z,
        )
        .setFriction(BLOCK_FRICTION)
        .setRestitution(BLOCK_RESTITUTION)
        .setCollisionGroups(RAY_IGNORED_GROUPS),
    );
};
