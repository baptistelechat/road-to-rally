"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  type InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import type { ChicaneBlock } from "@/sim/types";
import {
  CHICANE_BARRIER_MODULE,
  CHICANE_GEOMETRY,
  CHICANE_STACK_MODULE,
  SCENERY_MATERIAL,
} from "./models";

const UP = new Vector3(0, 1, 0);
/** Retrait des barrières depuis les faces du bloc : les poteaux restent dans le collider. */
const BARRIER_INSET = 0.1;

const moduleMatrices = (
  blocks: ChicaneBlock[],
  moduleLength: number,
  faces: (block: ChicaneBlock) => number[],
): Matrix4[] => {
  const matrices: Matrix4[] = [];
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  for (const block of blocks) {
    // Modules légèrement étirés pour tomber juste sur la longueur du bloc.
    const count = Math.max(1, Math.round(block.span / moduleLength));
    const length = block.span / count;
    rotation.setFromAxisAngle(UP, block.yaw);
    scale.set(length / moduleLength, 1, 1);
    for (const z of faces(block)) {
      for (let i = 0; i < count; i++) {
        position
          .set(-block.span / 2 + length * (i + 0.5), 0, z)
          .applyQuaternion(rotation);
        position.x += block.position.x;
        position.y += block.position.y;
        position.z += block.position.z;
        matrices.push(new Matrix4().compose(position, rotation, scale));
      }
    }
  }
  return matrices;
};

const Batch = ({
  geometry,
  matrices,
}: {
  geometry: BufferGeometry;
  matrices: Matrix4[];
}) => {
  const meshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, SCENERY_MATERIAL, matrices.length]}
      castShadow
    />
  );
};

/** Blocs de chicane : une pile au centre, une barrière sur chaque face, visible dans les deux sens de la route. */
export const ChicaneView = ({ blocks }: { blocks: ChicaneBlock[] }) => {
  const { barriers, stacks } = useMemo(
    () => ({
      barriers: moduleMatrices(blocks, CHICANE_BARRIER_MODULE, (block) => {
        const z = block.depth / 2 - BARRIER_INSET;
        return [-z, z];
      }),
      stacks: moduleMatrices(blocks, CHICANE_STACK_MODULE, () => [0]),
    }),
    [blocks],
  );

  if (blocks.length === 0) return null;
  return (
    <group>
      <Batch geometry={CHICANE_GEOMETRY.chicaneBarrier} matrices={barriers} />
      <Batch geometry={CHICANE_GEOMETRY.hayStack} matrices={stacks} />
    </group>
  );
};
