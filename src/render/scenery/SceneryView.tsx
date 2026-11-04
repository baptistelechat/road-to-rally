"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import type { SceneryItem } from "@/sim/types";
import {
  SCENERY_GEOMETRY,
  SCENERY_MATERIAL,
  type StaticSceneryKind,
} from "./models";

const KINDS: StaticSceneryKind[] = [
  "tree",
  "pine",
  "rock",
  "hay",
  "hayUpright",
  "sign",
  "post",
];
const UP = new Vector3(0, 1, 0);

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
    mesh.computeBoundingSphere();
  }, [items]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[SCENERY_GEOMETRY[kind], SCENERY_MATERIAL, items.length]}
      castShadow={castShadow}
    />
  );
};

/** Un `InstancedMesh` par type et par distance : seul le décor proche (avec collider) porte une ombre. */
export const SceneryView = ({ items }: { items: SceneryItem[] }) => {
  const batches = useMemo(
    () =>
      KINDS.flatMap((kind) =>
        [true, false].map((near) => ({
          kind,
          near,
          items: items.filter(
            (item) => item.kind === kind && item.colliderRadius > 0 === near,
          ),
        })),
      ).filter((batch) => batch.items.length > 0),
    [items],
  );

  return (
    <group>
      {batches.map((batch) => (
        <Batch
          key={`${batch.kind}-${batch.near}`}
          kind={batch.kind}
          items={batch.items}
          castShadow={batch.near}
        />
      ))}
    </group>
  );
};
