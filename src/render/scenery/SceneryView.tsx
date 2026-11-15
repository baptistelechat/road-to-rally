"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import type { CarSource } from "@/render/carSource";
import type { SceneryItem, Track } from "@/sim/types";
import { splitIntoChunks, useChunkCulling } from "./chunks";
import { createCrowdChunk, useCrowdLod } from "./crowd/crowdLod";
import {
  SCENERY_GEOMETRY,
  SCENERY_MATERIAL,
  type StaticSceneryKind,
} from "./models";

/** Objets en lot générique : un nouveau modèle dans `SCENERY_GEOMETRY` y entre sans rien toucher ici. Le public a sa vue. */
const KINDS = (Object.keys(SCENERY_GEOMETRY) as StaticSceneryKind[]).filter(
  (kind) => kind !== "spectator",
);
const UP = new Vector3(0, 1, 0);
/**
 * Haies et vignes de près : une ombre même sans collider (au-delà de la portée des objets légers, ou écartées par
 * le plafond). Les autres types gardent la règle « ombre = collider ». La bande lointaine (`vineRowFar`, à plus de
 * 100 m de la route) n'entre jamais dans la zone d'ombre de la voiture : pas d'ombre.
 */
const SHADOW_WITHOUT_COLLIDER: ReadonlySet<StaticSceneryKind> = new Set([
  "bush",
  "vineRow",
]);

interface BatchProps {
  kind: StaticSceneryKind;
  items: SceneryItem[];
  castShadow: boolean;
}

const Batch = ({ kind, items, castShadow }: BatchProps) => {
  const meshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const tint = new Color();
    items.forEach((item, i) => {
      position.set(item.position.x, item.position.y, item.position.z);
      rotation.setFromAxisAngle(UP, item.yaw);
      scale.setScalar(item.scale);
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
      // Teinte dérivée du cap : variété sans état aléatoire ajouté.
      const shade = 0.82 + 0.18 * (((item.yaw * 7.3) % 1) + 1);
      mesh.setColorAt(i, tint.setScalar(shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Sphère de la tranche seule : le frustum culling écarte les tranches hors champ.
    mesh.computeBoundingSphere();
  }, [items]);

  // `userData.shadow` : `useChunkCulling` ne rallume l'ombre que de ces lots, et seulement près de la voiture.
  return (
    <instancedMesh
      ref={meshRef}
      args={[SCENERY_GEOMETRY[kind], SCENERY_MATERIAL, items.length]}
      castShadow={castShadow}
      userData={{ shadow: castShadow }}
    />
  );
};

interface SceneryViewProps {
  items: SceneryItem[];
  /** Avec la voiture : décor découpé en tranches le long de l'axe, les lointaines masquées. Sans : tout est dessiné. */
  track?: Track;
  source?: CarSource;
}

/**
 * Un `InstancedMesh` par tranche, type et distance : le décor proche (avec collider) porte une ombre, les haies et
 * vignes de près aussi (`SHADOW_WITHOUT_COLLIDER`). Public : `crowd/`.
 */
export const SceneryView = ({ items, track, source }: SceneryViewProps) => {
  const chunks = useMemo(
    () =>
      splitIntoChunks(items, (item) => item.position, track).map((chunk) => ({
        info: chunk.info,
        batches: KINDS.flatMap((kind) =>
          [true, false].map((near) => ({
            kind,
            near,
            items: chunk.items.filter(
              (item) => item.kind === kind && item.colliderRadius > 0 === near,
            ),
          })),
        ).filter((batch) => batch.items.length > 0),
        crowd: chunk.items.some((item) => item.kind === "spectator")
          ? createCrowdChunk(
              chunk.items.filter((item) => item.kind === "spectator"),
            )
          : null,
      })),
    [items, track],
  );
  const crowds = useMemo(
    () => chunks.flatMap((chunk) => (chunk.crowd ? [chunk.crowd] : [])),
    [chunks],
  );
  useEffect(
    () => () => {
      for (const crowd of crowds) crowd.dispose();
    },
    [crowds],
  );
  const root = useChunkCulling(track, source);
  useCrowdLod(crowds, source);

  return (
    <group ref={root}>
      {chunks.map((chunk) => (
        <group key={chunk.info.index} userData={{ chunk: chunk.info }}>
          {chunk.batches.map((batch) => (
            <Batch
              key={`${batch.kind}-${batch.near}`}
              kind={batch.kind}
              items={batch.items}
              castShadow={batch.near || SHADOW_WITHOUT_COLLIDER.has(batch.kind)}
            />
          ))}
          {chunk.crowd?.meshes.map((mesh) => (
            <primitive key={mesh.uuid} object={mesh} />
          ))}
        </group>
      ))}
    </group>
  );
};
