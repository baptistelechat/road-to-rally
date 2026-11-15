"use client";

import { useEffect, useMemo } from "react";
import type { CarSource } from "@/render/carSource";
import { splitIntoChunks, useChunkCulling } from "@/render/scenery/chunks";
import { SCENERY_MATERIAL } from "@/render/scenery/models";
import type { DecorBuilding, Track } from "@/sim/types";
import { buildingsGeometry } from "./buildingGeometry";

/** À moins de cette distance du bord de la route, en mètres : version détaillée avec ombre ; au-delà, volumes seuls sans ombre */
const NEAR_DISTANCE = 40;

interface BuildingsViewProps {
  buildings: DecorBuilding[];
  /**
   * Distance au bord de la route la plus proche (comme `DecorContext.roadClearance`), pour limiter les ombres.
   * Absente : tous les bâtiments portent une ombre. Doit garder la même référence d'un rendu à l'autre.
   */
  roadClearance?: (x: number, z: number) => number;
  /** Avec la voiture : bâtiments découpés en tranches le long de l'axe, les lointaines masquées */
  track?: Track;
  source?: CarSource;
}

/** Bâtiments typés en low-poly : par tranche, deux maillages fusionnés au plus, proches détaillés avec ombre, lointains simplifiés sans. */
export const BuildingsView = ({
  buildings,
  roadClearance,
  track,
  source,
}: BuildingsViewProps) => {
  const chunks = useMemo(() => {
    const isNear = (building: DecorBuilding): boolean =>
      !roadClearance ||
      building.footprint.some((p) => roadClearance(p.x, p.z) < NEAR_DISTANCE);
    // Moins de trois sommets : `buildingsGeometry` l'ignore déjà, on l'écarte avant de lire son premier sommet.
    const drawable = buildings.filter((b) => b.footprint.length >= 3);
    // Sol rendu de la spéciale : portes et rez-de-chaussée s'y posent. Lu une fois, à la construction des tranches.
    const groundAt = track?.groundAt ?? null;
    return splitIntoChunks(drawable, (b) => b.footprint[0], track).map(
      (chunk) => ({
        info: chunk.info,
        near: buildingsGeometry(chunk.items.filter(isNear), "near", groundAt),
        far: roadClearance
          ? buildingsGeometry(
              chunk.items.filter((b) => !isNear(b)),
              "far",
              groundAt,
            )
          : null,
      }),
    );
  }, [buildings, roadClearance, track]);
  const root = useChunkCulling(track, source);

  useEffect(
    () => () => {
      for (const chunk of chunks) {
        chunk.near?.dispose();
        chunk.far?.dispose();
      }
    },
    [chunks],
  );

  // Matériau partagé avec le décor de la story 1.7 : il n'est pas libéré ici.
  return (
    <group ref={root}>
      {chunks.map((chunk) => (
        <group key={chunk.info.index} userData={{ chunk: chunk.info }}>
          {chunk.near && (
            <mesh
              geometry={chunk.near}
              material={SCENERY_MATERIAL}
              castShadow
              receiveShadow
              userData={{ shadow: true }}
            />
          )}
          {chunk.far && (
            <mesh
              geometry={chunk.far}
              material={SCENERY_MATERIAL}
              receiveShadow
            />
          )}
        </group>
      ))}
    </group>
  );
};
