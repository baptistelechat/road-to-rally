"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { lightPropCenter, type LightProps } from "@/sim/lightProps";
import type { SceneryKind } from "@/sim/types";
import { SCENERY_GEOMETRY, SCENERY_MATERIAL } from "./models";

const KINDS: SceneryKind[] = ["hay", "post", "sign"];

/** Bottes, plots et panneaux mobiles : les matrices ne changent que si un objet a bougé. */
export const LightPropsView = ({ props }: { props: LightProps }) => {
  const meshes = useRef<Partial<Record<SceneryKind, InstancedMesh | null>>>({});
  const batches = useMemo(
    () =>
      KINDS.map((kind) => ({
        kind,
        indices: props.items.flatMap((item, i) =>
          item.kind === kind ? [i] : [],
        ),
      })),
    [props],
  );
  const temp = useMemo(
    () => ({
      matrix: new Matrix4(),
      position: new Vector3(),
      offset: new Vector3(),
      rotation: new Quaternion(),
      scale: new Vector3(),
    }),
    [],
  );

  useFrame(() => {
    if (!props.sync()) return;
    const poses = props.current();
    const { matrix, position, offset, rotation, scale } = temp;
    for (const { kind, indices } of batches) {
      const mesh = meshes.current[kind];
      if (!mesh) continue;
      indices.forEach((index, instance) => {
        const item = props.items[index];
        const pose = poses[index];
        rotation.set(
          pose.rotation.x,
          pose.rotation.y,
          pose.rotation.z,
          pose.rotation.w,
        );
        // Le modèle a son origine au pied, le corps physique en son centre.
        offset.set(0, -lightPropCenter(item), 0).applyQuaternion(rotation);
        position
          .set(pose.position.x, pose.position.y, pose.position.z)
          .add(offset);
        scale.setScalar(item.scale);
        mesh.setMatrixAt(instance, matrix.compose(position, rotation, scale));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {batches.map(({ kind, indices }) => (
        <instancedMesh
          key={kind}
          ref={(mesh) => {
            meshes.current[kind] = mesh;
          }}
          args={[SCENERY_GEOMETRY[kind], SCENERY_MATERIAL, indices.length]}
          castShadow
          frustumCulled={false}
        />
      ))}
    </>
  );
};
