"use client";

import { useLayoutEffect, useRef } from "react";
import {
  type BufferGeometry,
  Color,
  type InstancedMesh,
  type Material,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import type { Rgb, Vec3Tuple } from "./geometry";

/** Une instance : pied au sol, cap, échelle par axe et teinte multipliée aux couleurs par sommet. */
export interface Placement {
  x: number;
  y?: number;
  z: number;
  yaw: number;
  scale: Vec3Tuple;
  tint: Rgb;
}

interface InstancesProps {
  geometry: BufferGeometry;
  material: Material;
  placements: Placement[];
  /** Décalage de tout le lot */
  offset?: Vec3Tuple;
}

const UP = new Vector3(0, 1, 0);

/** Un `InstancedMesh` comme dans `SceneryView`, la teinte par instance en plus. */
export const Instances = ({
  geometry,
  material,
  placements,
  offset = [0, 0, 0],
}: InstancesProps) => {
  const meshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const tint = new Color();
    placements.forEach((item, i) => {
      position.set(item.x, item.y ?? 0, item.z);
      rotation.setFromAxisAngle(UP, item.yaw);
      scale.set(item.scale[0], item.scale[1], item.scale[2]);
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
      mesh.setColorAt(i, tint.setRGB(item.tint[0], item.tint[1], item.tint[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements, geometry]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, placements.length]}
      position={offset}
      castShadow
      receiveShadow
    />
  );
};
