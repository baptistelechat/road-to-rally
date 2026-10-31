"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { PerspectiveCamera } from "three";
import type { CarSource } from "@/render/carSource";
import {
  createCameraRig,
  fillRigInput,
  type CameraMode,
  type RigInput,
} from "./cameraRig";

interface GameCameraProps {
  source: CarSource;
  mode?: CameraMode;
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
});

/** Pilote la caméra par défaut de la scène, sans rendu React par image. */
export const GameCamera = ({ source, mode = "chase" }: GameCameraProps) => {
  const [rig] = useState(createCameraRig);
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
