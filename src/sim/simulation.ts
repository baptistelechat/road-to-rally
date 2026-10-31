import { carConfig, type CarConfig } from "./carConfig";
import { FIXED_DT } from "./fixedStep";
import { createLapTimer, type LapTimer } from "./lapTimer";
import { createLightProps, type LightProps } from "./lightProps";
import { RAPIER } from "./rapier";
import { createRecovery, type RecoveryStatus } from "./recovery";
import { addTrackColliders } from "./track/colliders";
import { createSandboxTrack } from "./track/sandboxTrack";
import { generateScenery } from "./track/scenery";
import type { CarInput, CarState, Pose, SceneryItem, Track } from "./types";
import { createVehicle } from "./vehicle";

export const SANDBOX_SEED = 27;

export interface Simulation {
  track: Track;
  scenery: SceneryItem[];
  props: LightProps;
  lap: LapTimer;
  /** Un pas de `FIXED_DT`. Renvoie le temps du tour en ms si un tour vient de se boucler. */
  step: (input: CarInput) => number | null;
  state: () => CarState;
  /** Décompte de remise en piste en cours, à afficher */
  recovery: () => RecoveryStatus | null;
  /** Pose au pas précédent, pour interpoler le rendu */
  previousPose: () => Pose;
  /** Remise en piste au plus proche, sans toucher au chrono */
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
export const createSimulation = (config: CarConfig = carConfig): Simulation => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;

  const track = createSandboxTrack();
  const scenery = generateScenery(track, SANDBOX_SEED);
  addTrackColliders(world, track, scenery);
  const props = createLightProps(world, scenery);
  const recovery = createRecovery(track);

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

  const teleport = (pose: Pose): void => {
    vehicle.respawn(atRideHeight(pose));
    recovery.reset();
    current = vehicle.state();
    previous = copyPose(current);
    respawns++;
  };

  return {
    track,
    scenery,
    props,
    lap,
    step: (input) => {
      previous = copyPose(current);
      vehicle.step(input, FIXED_DT);
      world.step();
      if (propsToRest) {
        props.rest();
        propsToRest = false;
      }
      current = vehicle.state();
      const { x, z } = current.position;
      const lapMs = lap.update(x, z);
      const shouldRespawn = recovery.update({
        held: input.respawn ?? false,
        position: current.position,
        rotation: current.rotation,
        velocity: current.linearVelocity,
      });
      if (shouldRespawn) teleport(track.respawnPose(x, z));
      return lapMs;
    },
    state: () => current,
    recovery: () => recovery.status(),
    previousPose: () => previous,
    respawn: () => {
      teleport(track.respawnPose(current.position.x, current.position.z));
    },
    restart: () => {
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
