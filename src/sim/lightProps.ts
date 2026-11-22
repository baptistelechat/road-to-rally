import type RAPIER_TYPES from "@dimforge/rapier3d-deterministic-compat";
import { RAPIER } from "./rapier";
import {
  SEPARATOR_HALF_DEPTH,
  SEPARATOR_HEIGHT,
  SEPARATOR_LENGTH,
} from "./track/islandSeparators";
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
/** Mât du panneau d'annonce de chicane, jusqu'au haut du panneau */
const CHICANE_SIGN_HALF_HEIGHT = 1.4;
/** Panneau de freinage (`brakeBoards.ts`) : 1,5 m de large, haut du panneau à 1,9 m */
const BRAKE_BOARD_MASS = 20;
const BRAKE_BOARD_HALF_WIDTH = 0.78;
const BRAKE_BOARD_HALF_HEIGHT = 0.95;
const BRAKE_BOARD_HALF_DEPTH = 0.06;
/** Séparateur plastique rempli d'eau autour d'un îlot (PR-13) : lourd, la voiture le pousse et le fait pivoter */
const SEPARATOR_MASS = 80;
/** Amortissement des objets légers d'origine : inchangé, le monde sans décor reste le même au bit près */
const PROP_LINEAR_DAMPING = 0.25;
const PROP_ANGULAR_DAMPING = 0.6;
const PROP_FRICTION = 0.7;

/**
 * Végétation renversable près de la route (story 5.3), tous ses réglages ici. La voiture fait 1 100 kg : un buisson
 * de 90 kg lui prend environ 8 % de sa vitesse au choc, un rang de vigne de 120 kg environ 10 %. Une haie fauchée
 * freine franchement en quelques modules sans arrêter net. Amortissement fort : la végétation s'écrase et se couche,
 * elle ne roule ni ne glisse loin. Largeurs et longueurs non mises à l'échelle : deux voisins ne se touchent jamais.
 */
const BUSH_MASS = 90;
/** Cylindre debout, bas : il se couche au choc au lieu de rouler comme une boule. Rayon < pas de 2,4 m / 2. */
export const BUSH_RADIUS = 1;
/** Demi-hauteur à l'échelle 1 : sous le toit de la voiture, qui ne grimpe pas dessus */
const BUSH_HALF_HEIGHT = 0.7;
const VINE_MASS = 120;
/** Boîte longue et basse le long de x local : 4,6 m pour un module de 5 m, rangs à 2 m */
export const VINE_HALF_LENGTH = 2.3;
export const VINE_HALF_WIDTH = 0.3;
/** Demi-hauteur à l'échelle 1 : jusqu'au haut du feuillage (1,55 m) */
const VINE_HALF_HEIGHT = 0.75;
const VEGETATION_LINEAR_DAMPING = 1.2;
const VEGETATION_ANGULAR_DAMPING = 1.5;
const VEGETATION_FRICTION = 0.9;

const LIGHT_MEMBERSHIP = 0x0002;
const collisionGroups = (membership: number, filter: number): number =>
  ((membership << 16) | filter) >>> 0;

/** Les rayons de suspension ignorent ces objets : on les pousse, on ne roule pas dessus. */
export const WHEEL_RAY_GROUPS = collisionGroups(
  0xffff,
  0xffff & ~LIGHT_MEMBERSHIP,
);

/** Colliders que les rayons de suspension ignorent, mais que la caisse percute. */
export const RAY_IGNORED_GROUPS = collisionGroups(LIGHT_MEMBERSHIP, 0xffff);

export const isHay = (kind: SceneryKind): boolean =>
  kind === "hay" || kind === "hayUpright";

export const isChicaneSign = (kind: SceneryKind): boolean =>
  kind === "chicaneSignLeft" || kind === "chicaneSignRight";

export const isBrakeBoard = (kind: SceneryKind): boolean =>
  kind === "brakeBoard3" || kind === "brakeBoard2" || kind === "brakeBoard1";

export const isIslandSeparator = (kind: SceneryKind): boolean =>
  kind === "islandSeparatorRed" || kind === "islandSeparatorWhite";

/** Buisson ou rang de vigne renversable : placé en fin de décor par `generateScenery`, donc créé après les autres. */
export const isLooseVegetation = (kind: SceneryKind): boolean =>
  kind === "bushProp" || kind === "vineRowProp";

/** Collider d'un objet d'habillage rallye : boîte de demi-côtés donnés à l'échelle 1, centre à mi-hauteur. */
interface RallyPropShape {
  halfX: number;
  halfY: number;
  halfZ: number;
  mass: number;
}

/**
 * Habillage rallye renversable (story 5.5) : voile, pancarte, mât, banderole, module de barrière des épingles et
 * module de rubalise. Légers, comme les panneaux : la voiture les fauche sans s'y arrêter. Ajoutés en fin de décor.
 */
export const RALLY_PROP_SHAPE: Partial<Record<SceneryKind, RallyPropShape>> = {
  rallySail: { halfX: 0.08, halfY: 1.8, halfZ: 0.08, mass: 6 },
  rallyPlacard: { halfX: 0.5, halfY: 0.88, halfZ: 0.05, mass: 5 },
  rallyMast: { halfX: 0.06, halfY: 2.5, halfZ: 0.06, mass: 8 },
  rallyCheckerMast: { halfX: 0.06, halfY: 2.5, halfZ: 0.06, mass: 8 },
  rallyBanner: { halfX: 3.1, halfY: 1.28, halfZ: 0.05, mass: 20 },
  rallyBarrier: { halfX: 1, halfY: 0.6, halfZ: 0.06, mass: 10 },
  // Module de 5 m sur piquets de 1,1 m : boîte de 4,7 m, deux voisins bout à bout ne se touchent pas.
  rallyTape: { halfX: 2.35, halfY: 0.55, halfZ: 0.05, mass: 3 },
};

export const isRallyProp = (kind: SceneryKind): boolean =>
  RALLY_PROP_SHAPE[kind] !== undefined;

export const isLightProp = (kind: SceneryKind): boolean =>
  isRallyProp(kind) ||
  isHay(kind) ||
  kind === "post" ||
  kind === "sign" ||
  isChicaneSign(kind) ||
  isBrakeBoard(kind) ||
  isIslandSeparator(kind) ||
  isLooseVegetation(kind);

const CENTER_HEIGHT: Partial<Record<SceneryKind, number>> = {
  hay: HAY_RADIUS,
  hayUpright: HAY_HALF_LENGTH,
  sign: SIGN_HALF_HEIGHT,
  chicaneSignLeft: CHICANE_SIGN_HALF_HEIGHT,
  chicaneSignRight: CHICANE_SIGN_HALF_HEIGHT,
  brakeBoard3: BRAKE_BOARD_HALF_HEIGHT,
  brakeBoard2: BRAKE_BOARD_HALF_HEIGHT,
  brakeBoard1: BRAKE_BOARD_HALF_HEIGHT,
  islandSeparatorRed: SEPARATOR_HEIGHT / 2,
  islandSeparatorWhite: SEPARATOR_HEIGHT / 2,
  bushProp: BUSH_HALF_HEIGHT,
  vineRowProp: VINE_HALF_HEIGHT,
};

/** Hauteur du centre physique au-dessus du pied, là où le modèle 3D a son origine. */
export const lightPropCenter = (item: SceneryItem): number =>
  (CENTER_HEIGHT[item.kind] ??
    RALLY_PROP_SHAPE[item.kind]?.halfY ??
    POST_HALF_HEIGHT) * item.scale;

export interface LightProps {
  items: SceneryItem[];
  /** Relit les objets réveillés. Renvoie `true` si au moins une pose a changé. */
  sync: () => boolean;
  /** Dernières poses relues, dans l'ordre de `items`. Le tableau est réutilisé d'un appel à l'autre. */
  current: () => Pose[];
  /** Indices relus par le dernier `sync`, tous après un `rest`. Tableau réutilisé. */
  changed: () => readonly number[];
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
  const rally = RALLY_PROP_SHAPE[item.kind];
  if (rally)
    return RAPIER.ColliderDesc.cuboid(
      rally.halfX * item.scale,
      rally.halfY * item.scale,
      rally.halfZ * item.scale,
    ).setMass(rally.mass);
  if (item.kind === "bushProp")
    return RAPIER.ColliderDesc.cylinder(
      BUSH_HALF_HEIGHT * item.scale,
      BUSH_RADIUS,
    ).setMass(BUSH_MASS);
  if (item.kind === "vineRowProp")
    return RAPIER.ColliderDesc.cuboid(
      VINE_HALF_LENGTH,
      VINE_HALF_HEIGHT * item.scale,
      VINE_HALF_WIDTH,
    ).setMass(VINE_MASS);
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
  if (isBrakeBoard(item.kind))
    return RAPIER.ColliderDesc.cuboid(
      BRAKE_BOARD_HALF_WIDTH * item.scale,
      BRAKE_BOARD_HALF_HEIGHT * item.scale,
      BRAKE_BOARD_HALF_DEPTH * item.scale,
    ).setMass(BRAKE_BOARD_MASS);
  if (isIslandSeparator(item.kind))
    return RAPIER.ColliderDesc.cuboid(
      (SEPARATOR_LENGTH / 2) * item.scale,
      (SEPARATOR_HEIGHT / 2) * item.scale,
      SEPARATOR_HALF_DEPTH * item.scale,
    ).setMass(SEPARATOR_MASS);
  if (isChicaneSign(item.kind))
    return RAPIER.ColliderDesc.cuboid(
      SIGN_HALF_WIDTH * item.scale,
      CHICANE_SIGN_HALF_HEIGHT * item.scale,
      SIGN_HALF_WIDTH * item.scale,
    ).setMass(SIGN_MASS);
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
    const vegetation = isLooseVegetation(item.kind);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(
          spawn[i].position.x,
          spawn[i].position.y,
          spawn[i].position.z,
        )
        .setRotation(spawn[i].rotation)
        .setLinearDamping(
          vegetation ? VEGETATION_LINEAR_DAMPING : PROP_LINEAR_DAMPING,
        )
        .setAngularDamping(
          vegetation ? VEGETATION_ANGULAR_DAMPING : PROP_ANGULAR_DAMPING,
        ),
    );
    world.createCollider(
      colliderFor(item)
        .setFriction(vegetation ? VEGETATION_FRICTION : PROP_FRICTION)
        .setCollisionGroups(RAY_IGNORED_GROUPS),
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
  const changed: number[] = [];

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
    changed.length = 0;
    if (dirty) for (let i = 0; i < bodies.length; i++) changed.push(i);
    for (let i = 0; i < bodies.length; i++) {
      if (bodies[i].isSleeping()) continue;
      read(i);
      if (!dirty) changed.push(i);
    }
    dirty = false;
    return changed.length > 0;
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
    changed: () => changed,
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
