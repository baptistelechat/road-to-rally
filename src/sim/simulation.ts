import { carConfig, type CarConfig } from "./carConfig";
import { FIXED_DT } from "./fixedStep";
import { createLapTimer, type LapTimer } from "./lapTimer";
import { createLightProps, type LightProps } from "./lightProps";
import { RAPIER } from "./rapier";
import { createRecovery, type RecoveryStatus } from "./recovery";
import { SHOULDER_WIDTH } from "./track/ribbon";
import { addTrackColliders } from "./track/colliders";
import { createSandboxTrack } from "./track/sandboxTrack";
import { generateScenery } from "./track/scenery";
import { createStageTrack } from "./track/stage";
import type {
  CarInput,
  CarState,
  Pose,
  SceneryItem,
  StageData,
  Track,
} from "./types";
import { createVehicle } from "./vehicle";

export const SANDBOX_SEED = 27;
/** Spéciale : reculer plus loin que ça derrière la ligne ramène au départ, en mètres */
const START_BACK_LIMIT = 6;
/** Saut d'abscisse au-delà duquel la voiture a changé de portion de route sans la suivre, en mètres */
const ROUTE_MAX_JUMP = 25;
/** Écart vertical à la route au-delà duquel la voiture n'y est plus, en chute ou sur une autre branche, en mètres */
const ROUTE_MAX_HEIGHT = 3;
/** Sous cette vitesse, la voiture arrivée est immobilisée : le frein enclencherait sinon la marche arrière, en m/s */
const FINISH_STOP_SPEED = 0.5;

export interface Simulation {
  track: Track;
  scenery: SceneryItem[];
  props: LightProps;
  lap: LapTimer;
  /** Un pas de `FIXED_DT`. Renvoie le temps du tour en ms si un tour vient de se boucler. */
  step: (input: CarInput) => number | null;
  state: () => CarState;
  /** Abscisse suivie le long d'une spéciale, sans saut d'une branche d'épingle à l'autre. Reste `startS` sur le circuit. */
  routeS: () => number;
  /** Décompte de remise en piste en cours, à afficher */
  recovery: () => RecoveryStatus | null;
  /** Pose au pas précédent, pour interpoler le rendu */
  previousPose: () => Pose;
  /** Remise en piste au plus proche (spéciale : là où la route a été quittée), sans toucher au chrono */
  respawn: () => void;
  /** Retour à la ligne de départ et chrono à zéro */
  restart: () => void;
  applyConfig: (config: CarConfig) => void;
  respawnCount: () => number;
  free: () => void;
}

const copyPose = (pose: Pose): Pose => ({
  position: { ...pose.position },
  rotation: { ...pose.rotation },
});

/** Le module Rapier doit être initialisé avant l'appel : voir `initRapier`. */
export const createSimulation = (
  config: CarConfig = carConfig,
  stage?: StageData,
): Simulation => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;

  const track = stage ? createStageTrack(stage) : createSandboxTrack();
  const scenery = generateScenery(track, SANDBOX_SEED);
  addTrackColliders(world, track, scenery);
  const props = createLightProps(world, scenery);
  const recovery = createRecovery(
    track,
    track.terrain ? track.groundAt : undefined,
  );

  // Posée à son assiette de repos : ni chute, ni roues qui remontent dans la caisse.
  const atRideHeight = (pose: Pose): Pose => ({
    rotation: pose.rotation,
    position: {
      ...pose.position,
      y:
        track.nearest(pose.position.x, pose.position.z).point.y +
        config.ride.height,
    },
  });

  const vehicle = createVehicle(
    world,
    config,
    atRideHeight(track.startPose),
    track.surfaceAt,
  );
  const lap = createLapTimer(track, track.startPose);

  // Une fois tout créé : la masse de la voiture n'existe pour Rapier qu'après ce premier pas.
  world.step();
  props.rest();

  let current = vehicle.state();
  let previous = copyPose(current);
  let respawns = 0;
  let propsToRest = false;
  // Spéciale : immobile sur la ligne et chrono à l'arrêt jusqu'au premier coup de gaz.
  const open = !track.closed;
  let held = false;
  let timing = !open;
  // Dernière abscisse où la voiture roulait vraiment sur la route.
  let routeS = track.startS;

  const setHeld = (value: boolean): void => {
    if (value !== held) vehicle.setHeld(value);
    held = value;
  };
  if (open) setHeld(true);

  const teleport = (pose: Pose): void => {
    setHeld(false);
    vehicle.respawn(atRideHeight(pose));
    if (open) setHeld(true);
    recovery.reset();
    current = vehicle.state();
    previous = copyPose(current);
    respawns++;
  };

  const respawnPose = (x: number, z: number): Pose =>
    open
      ? track.poseAt(Math.max(track.startS, routeS))
      : track.respawnPose(x, z);

  return {
    track,
    scenery,
    props,
    lap,
    step: (input) => {
      previous = copyPose(current);
      let applied = input;
      if (open) {
        if (lap.finished()) {
          if (current.forwardSpeed < FINISH_STOP_SPEED) setHeld(true);
          applied = { ...input, throttle: 0, brake: held ? 0 : 1, handbrake: false };
        } else if (held && (input.throttle > 0 || (timing && input.brake > 0))) {
          setHeld(false);
          timing = true;
        }
      }
      vehicle.step(applied, FIXED_DT);
      world.step();
      if (propsToRest) {
        props.rest();
        propsToRest = false;
      }
      current = vehicle.state();
      const { x, y, z } = current.position;
      const lapMs = timing ? lap.update(x, z) : null;
      let offRoute = false;
      if (open) {
        const here = track.nearest(x, z);
        const onRoad =
          here.distance <= here.width / 2 + SHOULDER_WIDTH &&
          Math.abs(y - here.point.y) < ROUTE_MAX_HEIGHT;
        const contiguous = Math.abs(here.s - routeS) <= ROUTE_MAX_JUMP;
        if (onRoad && contiguous) routeS = here.s;
        offRoute = onRoad && !contiguous;
        if (timing && !lap.finished() && here.s < track.startS - START_BACK_LIMIT) {
          routeS = track.startS;
          teleport(track.startPose);
          return lapMs;
        }
      }
      const shouldRespawn = recovery.update({
        held: input.respawn ?? false,
        position: current.position,
        rotation: current.rotation,
        velocity: current.linearVelocity,
        offRoute,
      });
      if (shouldRespawn) teleport(respawnPose(x, z));
      return lapMs;
    },
    state: () => current,
    routeS: () => routeS,
    recovery: () => recovery.status(),
    previousPose: () => previous,
    respawn: () => {
      teleport(respawnPose(current.position.x, current.position.z));
    },
    restart: () => {
      routeS = track.startS;
      timing = !open;
      teleport(track.startPose);
      props.reset();
      propsToRest = true;
      lap.reset();
    },
    applyConfig: (next) => vehicle.applyConfig(next),
    respawnCount: () => respawns,
    free: () => {
      vehicle.free();
      world.free();
    },
  };
};
