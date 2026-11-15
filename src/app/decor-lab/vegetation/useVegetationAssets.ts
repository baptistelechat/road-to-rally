"use client";

import { useEffect, useMemo } from "react";
import { type BufferGeometry, MeshStandardMaterial } from "three";
import { SCENERY_GEOMETRY } from "@/render/scenery/models";
import { type BushModel, buildBushModels } from "./hedges";
import { buildTreeModels, type TreeModel } from "./trees";
import { buildEndPost, buildVineModels, type VineModel } from "./vines";

export interface VegetationAssets {
  material: MeshStandardMaterial;
  trees: TreeModel[];
  /** Les deux arbres du jeu, pour comparer */
  current: [TreeModel, TreeModel];
  bushes: BushModel[];
  vines: VineModel[];
  endPost: BufferGeometry;
}

/** Construit les propositions une fois et les libère au démontage. */
export const useVegetationAssets = (): VegetationAssets => {
  const assets = useMemo<VegetationAssets>(
    () => ({
      // Même réglage que `SCENERY_MATERIAL`, mais à nous : on peut le libérer
      material: new MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.95,
      }),
      trees: buildTreeModels(),
      current: [
        {
          id: "current-tree",
          label: "Actuel : tree",
          near: SCENERY_GEOMETRY.tree,
          far: null,
          minScale: 0.85,
          maxScale: 1.75,
          owned: false,
        },
        {
          id: "current-pine",
          label: "Actuel : pine",
          near: SCENERY_GEOMETRY.pine,
          far: null,
          minScale: 0.85,
          maxScale: 1.75,
          owned: false,
        },
      ],
      bushes: buildBushModels(),
      vines: buildVineModels(),
      endPost: buildEndPost(),
    }),
    [],
  );

  useEffect(
    () => () => {
      assets.material.dispose();
      for (const tree of assets.trees) {
        if (!tree.owned) continue;
        tree.near.dispose();
        tree.far?.dispose();
      }
      assets.bushes.forEach((bush) => bush.geometry.dispose());
      assets.vines.forEach((vine) => vine.geometry.dispose());
      assets.endPost.dispose();
    },
    [assets],
  );

  return assets;
};
