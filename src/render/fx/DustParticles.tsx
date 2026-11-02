"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { CarSource } from "@/render/carSource";
import type { DustPool } from "./dustPool";

/** Poussière et mottes sur l'herbe, fumée sur l'asphalte. */
export const DustParticles = ({
  source,
  pool,
}: {
  source: CarSource;
  pool: DustPool;
}) => {
  const lastRespawn = useRef(0);

  useEffect(() => () => pool.dispose(), [pool]);

  useFrame((_, dt) => {
    const state = source.getState();
    const pose = source.getPose();
    if (!state || !pose) return;
    const respawn = source.getRespawnCount();
    if (respawn !== lastRespawn.current) {
      lastRespawn.current = respawn;
      pool.reset();
    }
    pool.update(state, pose, dt);
  });

  return <primitive object={pool.mesh} />;
};
