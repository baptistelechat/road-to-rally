import { carConfig, type CarConfig } from "./carConfig";
import { FIXED_DT } from "./fixedStep";
import { createLapTimer, type LapTimer } from "./lapTimer";
import { createLightProps, type LightProps } from "./lightProps";
import { RAPIER } from "./rapier";
import { createRecovery, type RecoveryStatus } from "./recovery";
import { createRouteTracker } from "./routeTracker";
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
  /** Abscisse suivie sur un tracé ouvert : sur un aller-retour, une position seule ne dit pas quel passage */
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
  const route = createRouteTracker(track, track.startS);

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
    route.reset(route.s());
    current = vehicle.state();
    previous = copyPose(current);
    respawns++;
  };

  const respawnPose = (x: number, z: number): Pose =>
    open
      ? track.poseAt(Math.max(track.startS, route.s()))
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
          applied = {
            ...input,
            throttle: 0,
            brake: held ? 0 : 1,
            handbrake: false,
          };
        } else if (
          held &&
          (input.throttle > 0 || (timing && input.brake > 0))
        ) {
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
      const here = open ? route.update(x, y, z) : null;
      const offRoute = here?.offRoute ?? false;
      const lapMs = timing
        ? lap.update(x, z, open ? route.s() : undefined)
        : null;
      if (
        here &&
        timing &&
        !lap.finished() &&
        here.s < track.startS - START_BACK_LIMIT
      ) {
        route.reset(track.startS);
        teleport(track.startPose);
        return lapMs;
      }
      const shouldRespawn = recovery.update({
        held: input.respawn ?? false,
        position: current.position,
        rotation: current.rotation,
        velocity: current.linearVelocity,
        offRoute,
        routeS: open ? route.s() : undefined,
      });
      if (shouldRespawn) teleport(respawnPose(x, z));
      return lapMs;
    },
    state: () => current,
    routeS: () => route.s(),
    recovery: () => recovery.status(),
    previousPose: () => previous,
    respawn: () => {
      teleport(respawnPose(current.position.x, current.position.z));
    },
    restart: () => {
      route.reset(track.startS);
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
