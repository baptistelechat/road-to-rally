import type RAPIER_TYPES from "@dimforge/rapier3d-deterministic-compat";
import { RAPIER } from "./rapier";
import type { Pose, SceneryItem, SceneryKind } from "./types";

// Bottes de paille, plots et panneaux : des objets légers qu'on percute, jamais des murs.
const HAY_MASS = 60;
const HAY_RADIUS = 0.75;
const HAY_HALF_LENGTH = 0.6;
const POST_MASS = 6;
const POST_HALF_HEIGHT = 0.5;
const POST_HALF_WIDTH = 0.09;
const SIGN_MASS = 15;
const SIGN_HALF_HEIGHT = 1.2;
const SIGN_HALF_WIDTH = 0.08;

const LIGHT_MEMBERSHIP = 0x0002;
const collisionGroups = (membership: number, filter: number): number =>
  ((membership << 16) | filter) >>> 0;

/** Les rayons de suspension ignorent ces objets : on les pousse, on ne roule pas dessus. */
export const WHEEL_RAY_GROUPS = collisionGroups(
  0xffff,
  0xffff & ~LIGHT_MEMBERSHIP,
);

export const isHay = (kind: SceneryKind): boolean =>
  kind === "hay" || kind === "hayUpright";

export const isLightProp = (kind: SceneryKind): boolean =>
  isHay(kind) || kind === "post" || kind === "sign";

const CENTER_HEIGHT: Partial<Record<SceneryKind, number>> = {
  hay: HAY_RADIUS,
  hayUpright: HAY_HALF_LENGTH,
  sign: SIGN_HALF_HEIGHT,
};

/** Hauteur du centre physique au-dessus du pied, là où le modèle 3D a son origine. */
export const lightPropCenter = (item: SceneryItem): number =>
  (CENTER_HEIGHT[item.kind] ?? POST_HALF_HEIGHT) * item.scale;

export interface LightProps {
  items: SceneryItem[];
  /** Relit les objets réveillés. Renvoie `true` si au moins une pose a changé. */
  sync: () => boolean;
  /** Dernières poses relues, dans l'ordre de `items`. Le tableau est réutilisé d'un appel à l'autre. */
  current: () => Pose[];
  /** Relit tous les objets, endormis compris. Plus coûteux : réservé aux vérifications. */
  poses: () => Pose[];
  /** À appeler après un `world.step()` : Rapier réveille les corps qu'on vient de créer ou de replacer. */
  rest: () => void;
  reset: () => void;
}

/** Pose de départ : le pied sur le sol, l'axe vertical de l'objet le long de la normale du sol. */
export const lightPropSpawn = (item: SceneryItem): Pose => {
  const center = lightPropCenter(item);
  const up = item.up ?? { x: 0, y: 1, z: 0 };
  const half = item.yaw / 2;
  const yawY = Math.sin(half);
  const yawW = Math.cos(half);
  // Le plus court quart de tour du vertical vers la normale, composé avec le cap.
  const norm = Math.sqrt(2 * (1 + up.y));
  const tiltX = up.z / norm;
  const tiltZ = -up.x / norm;
  const tiltW = (1 + up.y) / norm;
  return {
    position: {
      x: item.position.x + up.x * center,
      y: item.position.y + up.y * center,
      z: item.position.z + up.z * center,
    },
    rotation: {
      x: tiltX * yawW - tiltZ * yawY,
      y: tiltW * yawY,
      z: tiltZ * yawW + tiltX * yawY,
      w: tiltW * yawW,
    },
  };
};

const colliderFor = (item: SceneryItem): RAPIER_TYPES.ColliderDesc => {
  if (item.kind === "hayUpright") {
    return RAPIER.ColliderDesc.cylinder(
      HAY_HALF_LENGTH * item.scale,
      HAY_RADIUS * item.scale,
    ).setMass(HAY_MASS);
  }
  if (item.kind === "hay") {
    // Axe du cylindre sur X local : la botte est couchée, comme son modèle, et roule au choc.
    const quarterTurn = Math.SQRT1_2;
    return RAPIER.ColliderDesc.cylinder(
      HAY_HALF_LENGTH * item.scale,
      HAY_RADIUS * item.scale,
    )
      .setRotation({ x: 0, y: 0, z: quarterTurn, w: quarterTurn })
      .setMass(HAY_MASS);
  }
  if (item.kind === "sign") {
    // Le mât seul : la voiture passe sous le panneau, elle ne touche que le pied.
    return RAPIER.ColliderDesc.cuboid(
      SIGN_HALF_WIDTH * item.scale,
      SIGN_HALF_HEIGHT * item.scale,
      SIGN_HALF_WIDTH * item.scale,
    ).setMass(SIGN_MASS);
  }
  return RAPIER.ColliderDesc.cuboid(
    POST_HALF_WIDTH * item.scale,
    POST_HALF_HEIGHT * item.scale,
    POST_HALF_WIDTH * item.scale,
  ).setMass(POST_MASS);
};

export const createLightProps = (
  world: RAPIER_TYPES.World,
  scenery: SceneryItem[],
): LightProps => {
  const items = scenery.filter((item) => isLightProp(item.kind));
  const spawn = items.map(lightPropSpawn);

  const bodies = items.map((item, i) => {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(
          spawn[i].position.x,
          spawn[i].position.y,
          spawn[i].position.z,
        )
        .setRotation(spawn[i].rotation)
        .setLinearDamping(0.25)
        .setAngularDamping(0.6),
    );
    world.createCollider(
      colliderFor(item)
        .setFriction(0.7)
        .setCollisionGroups(collisionGroups(LIGHT_MEMBERSHIP, 0xffff)),
      body,
    );
    return body;
  });

  // Un cylindre couché roule sans le moindre choc : tout dort jusqu'au premier contact.
  const poses: Pose[] = spawn.map((pose) => ({
    position: { ...pose.position },
    rotation: { ...pose.rotation },
  }));
  let dirty = true;

  const read = (index: number): void => {
    const translation = bodies[index].translation();
    const rotation = bodies[index].rotation();
    const pose = poses[index];
    pose.position.x = translation.x;
    pose.position.y = translation.y;
    pose.position.z = translation.z;
    pose.rotation.x = rotation.x;
    pose.rotation.y = rotation.y;
    pose.rotation.z = rotation.z;
    pose.rotation.w = rotation.w;
  };

  const sync = (): boolean => {
    let moved = dirty;
    dirty = false;
    for (let i = 0; i < bodies.length; i++) {
      if (bodies[i].isSleeping()) continue;
      read(i);
      moved = true;
    }
    return moved;
  };

  const rest = (): void => {
    bodies.forEach((body, i) => {
      read(i);
      body.sleep();
    });
    dirty = true;
  };

  return {
    items,
    rest,
    sync,
    current: () => poses,
    poses: () => {
      bodies.forEach((_, i) => read(i));
      return poses;
    },
    reset: () => {
      bodies.forEach((body, i) => {
        body.setTranslation(spawn[i].position, true);
        body.setRotation(spawn[i].rotation, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      });
    },
  };
};
