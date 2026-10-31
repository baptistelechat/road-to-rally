"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { CarSource } from "@/render/carSource";
import { createSkidPool } from "./skidPool";

/** Traces de pneus sur l'asphalte en glisse, à durée de vie limitée. */
export const SkidMarks = ({ source }: { source: CarSource }) => {
  const [pool] = useState(createSkidPool);
  const lastRespawn = useRef(0);

  useEffect(() => () => pool.dispose(), [pool]);

  useFrame((_, dt) => {
    const state = source.getState();
    const pose = source.getPose();
    if (!state || !pose) return;
    const respawn = source.getRespawnCount();
    if (respawn !== lastRespawn.current) {
      lastRespawn.current = respawn;
      pool.breakTrails();
    }
    pool.update(state, pose, dt);
  });

  return <primitive object={pool.mesh} />;
};
