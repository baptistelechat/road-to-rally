import type RAPIER_TYPES from "@dimforge/rapier3d-deterministic-compat";
import { isLightProp, RAY_IGNORED_GROUPS } from "../lightProps";
import { RAPIER } from "../rapier";
import type { MeshData, SceneryItem, Track } from "../types";
import {
  buildingBox,
  buildingHullPoints,
  nearBuildings,
} from "./buildingColliders";
import { embankment, GROUND_Y, shoulderStrips } from "./ribbon";
import { finishArch, splitArches, startArch } from "./scenery";
import { islandCoreRadius } from "./islandSeparators";

/** Hauteur des colliders de décor : assez haut pour qu'une voiture ne monte jamais dessus */
const OBSTACLE_HEIGHT = 4;
const GROUND_THICKNESS = 10;
const GROUND_MARGIN = 2000;
/** Glissant, à peine élastique : la voiture s'arrête contre la barrière sans y accrocher ni rebondir. */
const BLOCK_FRICTION = 0.2;
const BLOCK_RESTITUTION = 0.1;
/** Garde-corps d'un pont : hauteur au-dessus de la chaussée et partie enterrée, en mètres */
const PARAPET_HEIGHT = 1;
const PARAPET_SKIRT = 0.3;
/**
 * Paroi du garde-corps en deçà de la demi-largeur du tablier, en mètres : 5 cm avant la face du parapet de pierre
 * dessiné (+0,3 - 0,45). Pile sur la face, la carrosserie entrait dans le mur ; à 20 cm, le choc semblait loin du mur
 * au volant (essais de Baptiste, 21/11).
 */
const PARAPET_INNER_GAP = 0.2;
/** Épaisseur du collider de la glissière d'un terre-plein, en mètres */
const MEDIAN_THICKNESS = 0.3;
/** Obstacles du décor (arbres, poteaux, bâtiments) : on rebondit dessus sans s'y coincer. */
const DECOR_FRICTION = 0.2;
const DECOR_RESTITUTION = 0.25;

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
      .setFriction(DECOR_FRICTION)
      .setRestitution(DECOR_RESTITUTION),
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

  // Les arches gonflables des intermédiaires se percutent comme celles du départ et de l'arrivée.
  const arches: (ReturnType<typeof startArch> & { postRadius?: number })[] = [
    ...(track.closed
      ? [startArch(track)]
      : [startArch(track), finishArch(track)]),
    ...splitArches(track),
  ];
  for (const arch of arches) {
    const yaw = 2 * Math.atan2(arch.rotation.y, arch.rotation.w);
    for (const side of [-1, 1])
      addObstacle(
        world,
        arch.position.x + Math.cos(yaw) * side * arch.halfSpan,
        arch.position.y + GROUND_Y,
        arch.position.z - Math.sin(yaw) * side * arch.halfSpan,
        arch.postRadius ?? 0.3,
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
        islandCoreRadius(island),
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

  // Après les îlots : sans terre-plein, le monde reste le même au bit près. Deux parois continues qui suivent la
  // médiane, une par chaussée : des blocs bout à bout accrochaient la caisse à chaque jointure, comme un mur invisible.
  for (const { points, height, skirt } of track.medians) {
    const last = points.length - 1;
    for (const side of [-1, 1]) {
      const positions: number[] = [];
      for (let i = 0; i <= last; i++) {
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(last, i + 1)];
        const len = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
        // À droite de la médiane : (-dz, dx), comme pour les garde-corps.
        const offset = (MEDIAN_THICKNESS / 2) * side;
        const x = points[i].x - ((next.z - prev.z) / len) * offset;
        const z = points[i].z + ((next.x - prev.x) / len) * offset;
        positions.push(x, points[i].y - skirt, z);
        positions.push(x, points[i].y + height, z);
      }
      const indices: number[] = [];
      for (let k = 0; k < last; k++) {
        const [bottom, top, nextBottom, nextTop] = [2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 3];
        // Normale tournée vers la chaussée de ce côté : vers la droite à droite, vers la gauche à gauche.
        if (side > 0) indices.push(bottom, nextBottom, nextTop, bottom, nextTop, top);
        else indices.push(bottom, nextTop, nextBottom, bottom, top, nextTop);
      }
      world.createCollider(
        RAPIER.ColliderDesc.trimesh(
          Float32Array.from(positions),
          Uint32Array.from(indices),
          RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
        )
          .setFriction(BLOCK_FRICTION)
          .setRestitution(BLOCK_RESTITUTION)
          .setCollisionGroups(RAY_IGNORED_GROUPS),
      );
    }
  }

  // Tout à la fin : sans décor, le monde reste le même au bit près. Ordre trié du pipeline, jamais celui d'un Set.
  // Rayons de suspension ignorés comme les chicanes : une roue collée au mur ne grimpe pas sur le toit.
  for (const building of nearBuildings(track)) {
    let desc = RAPIER.ColliderDesc.convexHull(buildingHullPoints(building));
    if (!desc) {
      const { center, half, yaw } = buildingBox(building);
      desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setTranslation(center.x, center.y, center.z)
        .setRotation({
          x: 0,
          y: Math.sin(yaw / 2),
          z: 0,
          w: Math.cos(yaw / 2),
        });
    }
    world.createCollider(
      desc
        .setFriction(DECOR_FRICTION)
        .setRestitution(DECOR_RESTITUTION)
        .setCollisionGroups(RAY_IGNORED_GROUPS),
    );
  }
  // Garde-corps des ponts, après le décor : sans pont, le monde reste le même au bit près. Une paroi continue par côté,
  // qui suit la courbe : des blocs droits bout à bout se rejoignaient en angle, et la voiture qui longeait le mur
  // accrochait l'arête du bloc suivant. Orientée vers la route, avec `FIX_INTERNAL_EDGES` comme le ruban.
  const points = track.unique.points;
  const last = points.length - 1;
  for (const bridge of track.bridges ?? []) {
    const inner = bridge.halfWidth - PARAPET_INNER_GAP;
    for (const side of [-1, 1]) {
      const positions: number[] = [];
      for (let i = bridge.from; i <= bridge.to; i++) {
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(last, i + 1)];
        const len = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
        // À droite de la route : (-dz, dx), comme `bridgeGeometry`.
        const x = points[i].x - ((next.z - prev.z) / len) * inner * side;
        const z = points[i].z + ((next.x - prev.x) / len) * inner * side;
        positions.push(x, points[i].y - PARAPET_SKIRT, z);
        positions.push(x, points[i].y + PARAPET_HEIGHT, z);
      }
      const indices: number[] = [];
      for (let k = 0; k < bridge.to - bridge.from; k++) {
        const [bottom, top, nextBottom, nextTop] = [2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 3];
        // (bas, bas suivant, haut suivant) a sa normale vers la droite : à gauche elle regarde la route, à droite on l'inverse.
        if (side < 0) indices.push(bottom, nextBottom, nextTop, bottom, nextTop, top);
        else indices.push(bottom, nextTop, nextBottom, bottom, top, nextTop);
      }
      world.createCollider(
        RAPIER.ColliderDesc.trimesh(
          Float32Array.from(positions),
          Uint32Array.from(indices),
          RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
        )
          .setFriction(BLOCK_FRICTION)
          .setRestitution(BLOCK_RESTITUTION)
          .setCollisionGroups(RAY_IGNORED_GROUPS),
      );
    }
  }
};
