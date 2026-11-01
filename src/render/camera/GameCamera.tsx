"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useRef, useState } from "react";
import { PerspectiveCamera } from "three";
import type { CarSource } from "@/render/carSource";
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
  orbit: 0,
});

/** Pilote la caméra par défaut de la scène, sans rendu React par image. */
export const GameCamera = ({
  source,
  track,
  mode = "chase",
  orbit,
}: GameCameraProps) => {
  // Le circuit reste presque plat : sa caméra ne change pas.
  const [rig] = useState(() =>
    createCameraRig(track.closed ? undefined : track.groundAt),
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
