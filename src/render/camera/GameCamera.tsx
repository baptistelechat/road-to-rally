"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useRef, useState } from "react";
import { PerspectiveCamera } from "three";
import type { CarSource } from "@/render/carSource";
import { tunnelAt } from "@/render/tunnelAt";
import type { Track } from "@/sim/types";
import {
  createCameraRig,
  fillRigInput,
  type CameraMode,
  type RigInput,
} from "./cameraRig";

interface GameCameraProps {
  source: CarSource;
  /** Son `groundAt` garde la caméra au-dessus du sol */
  track: Track;
  mode?: CameraMode;
  /** Rotation demandée autour de la voiture, -1 à 1 */
  orbit: RefObject<number>;
}

const createInput = (): RigInput => ({
  pose: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  },
  velocity: { x: 0, y: 0, z: 0 },
  forwardSpeed: 0,
  grass: 0,
  impact: 0,
  gear: 0,
  orbit: 0,
});

/** La caméra reste à autant de la paroi d'un tunnel, en mètres : le plan proche ne la coupe pas */
const TUNNEL_CAMERA_MARGIN = 0.8;

/**
 * Sol vu par la caméra. Dans un tunnel, hors de la route, `groundAt` donne la roche autour du tube : la caméra
 * qui sort du virage y serait poussée à travers la voûte. Elle y voit la chaussée à la place.
 */
const cameraGround =
  (track: Track): Track["groundAt"] =>
  (x, z) =>
    tunnelAt(track, x, z)?.point.y ?? track.groundAt(x, z);

/** Dans un virage de tunnel, la caméra derrière la voiture passerait derrière la paroi : elle est ramenée dedans. */
const cameraConfine =
  (track: Track) =>
  (x: number, z: number): { x: number; z: number } => {
    const tunnel = tunnelAt(track, x, z);
    const limit = tunnel ? tunnel.edge - TUNNEL_CAMERA_MARGIN : Infinity;
    if (!tunnel || tunnel.distance <= limit) return { x, z };
    const scale = Math.max(0, limit) / tunnel.distance;
    return {
      x: tunnel.point.x + (x - tunnel.point.x) * scale,
      z: tunnel.point.z + (z - tunnel.point.z) * scale,
    };
  };

/** Pilote la caméra par défaut de la scène, sans rendu React par image. */
export const GameCamera = ({
  source,
  track,
  mode = "chase",
  orbit,
}: GameCameraProps) => {
  // Le circuit reste presque plat : sa caméra ne change pas.
  const [rig] = useState(() =>
    track.closed
      ? createCameraRig()
      : createCameraRig(
          cameraGround(track),
          track.tunnels ? cameraConfine(track) : undefined,
        ),
  );
  const input = useRef<RigInput>(createInput());
  const lastRespawn = useRef<number | null>(null);
  const lastMode = useRef<CameraMode | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  useFrame(({ camera }, dt) => {
    const state = source.getState();
    const pose = source.getPose();
    if (!state || !pose) return;
    fillRigInput(input.current, pose, state);
    input.current.orbit = orbit.current;
    if (reducedMotion.current) {
      input.current.grass = 0;
      input.current.impact = 0;
      input.current.gear = 0;
    }

    const respawn = source.getRespawnCount();
    if (respawn !== lastRespawn.current || mode !== lastMode.current) {
      rig.snap(input.current, mode);
      lastRespawn.current = respawn;
      lastMode.current = mode;
    } else {
      rig.update(input.current, dt, mode);
    }

    camera.position.copy(rig.output.position);
    camera.quaternion.copy(rig.output.quaternion);
    if (
      camera instanceof PerspectiveCamera &&
      Math.abs(camera.fov - rig.output.fov) > 0.01
    ) {
      camera.fov = rig.output.fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
};
