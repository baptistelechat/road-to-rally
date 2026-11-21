"use client";

import { useEffect, useMemo } from "react";
import { SCENERY_MATERIAL } from "@/render/scenery/models";
import { createMeshHeight } from "@/sim/track/meshHeight";
import type { Track } from "@/sim/types";
import { bridgeGeometry } from "./bridgeGeometry";

/** Sous un pont hors terrain (le bord du couloir), les piles descendent jusque-là sous la chaussée, en mètres */
const FALLBACK_DEPTH = 6;

/** Ouvrages sous la route : un maillage par pont, peu nombreux, toujours dessinés. */
export const BridgesView = ({ track }: { track: Track }) => {
  const geometries = useMemo(() => {
    const { bridges, terrain } = track;
    if (!bridges || bridges.length === 0) return [];
    // Terrain seul : `track.groundAt` donnerait la chaussée sous le tablier, et les piles n'auraient plus de hauteur.
    const terrainAt = terrain ? createMeshHeight([terrain]) : null;
    const points = track.unique.points;
    return bridges.flatMap((bridge) => {
      const span = points.slice(bridge.from, bridge.to + 1);
      const floor = Math.min(...span.map((p) => p.y)) - FALLBACK_DEPTH;
      const geometry = bridgeGeometry(
        {
          points: span,
          halfWidth: bridge.halfWidth,
          roadHalfWidth:
            Math.max(
              ...track.unique.widths.slice(bridge.from, bridge.to + 1),
            ) / 2,
          groundAt: (x, z) => terrainAt?.(x, z) ?? floor,
        },
        bridge.style,
      );
      return geometry ? [geometry] : [];
    });
  }, [track]);

  useEffect(
    () => () => {
      for (const geometry of geometries) geometry.dispose();
    },
    [geometries],
  );

  // Matériau partagé avec le décor : il n'est pas libéré ici.
  return (
    <group>
      {geometries.map((geometry) => (
        <mesh
          key={geometry.uuid}
          geometry={geometry}
          material={SCENERY_MATERIAL}
          castShadow
          receiveShadow
          userData={{ shadow: true }}
        />
      ))}
    </group>
  );
};
