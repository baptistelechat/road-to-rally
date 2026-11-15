"use client";

import {
  CHICANE_BARRIER_MODULE,
  CHICANE_GEOMETRY,
  SCENERY_MATERIAL,
} from "@/render/scenery/models";
import type { Vec3 } from "./geometry";

interface BarrierProps {
  /** Nombre de modules de 2 m, posés bout à bout le long de +X */
  modules: number;
  /** Début de la rangée */
  position: Vec3;
}

/** Barrière de rubalise des chicanes, telle qu'en jeu. Géométrie partagée de `models.ts` : jamais libérée ici. */
export const Barrier = ({ modules, position }: BarrierProps) => (
  <group position={position}>
    {Array.from({ length: modules }, (_, i) => (
      <mesh
        key={i}
        geometry={CHICANE_GEOMETRY.chicaneBarrier}
        material={SCENERY_MATERIAL}
        position={[(i + 0.5) * CHICANE_BARRIER_MODULE, 0, 0]}
        castShadow
        receiveShadow
      />
    ))}
  </group>
);
