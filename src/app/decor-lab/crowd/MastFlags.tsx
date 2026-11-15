"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import { flagMast } from "./dressing";
import {
  flagCell,
  flagMaterial,
  releaseFlagMaterial,
  retainFlagMaterial,
} from "./flagAtlas";
import type { Vec3 } from "./geometry";
import { Piece } from "./Piece";

export interface Mast {
  position: Vec3;
  /** Code pays de `FLAGS` */
  flag: string;
}

/** Toile au sommet du mât, en 3:2 comme les cellules de l'atlas */
const CLOTH = { width: 1.26, height: 0.84, top: 4.95, segments: 6 };

/** Toile ondulée accrochée au mât, côté +X. */
const buildCloth = (): PlaneGeometry => {
  const plane = new PlaneGeometry(CLOTH.width, CLOTH.height, CLOTH.segments, 1);
  plane.translate(CLOTH.width / 2 + 0.04, CLOTH.top - CLOTH.height / 2, 0);
  const position = plane.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    position.setZ(i, Math.sin(x * 4.2) * 0.07 * Math.min(1, x / 0.3));
  }
  plane.computeVertexNormals();
  return plane;
};

/** Mâts et leurs drapeaux de pays : un mât par pièce, les toiles en un seul lot sur l'atlas. */
export const MastFlags = ({ masts }: { masts: Mast[] }) => {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const plane = buildCloth();
    const cells = new Float32Array(masts.length * 2);
    masts.forEach((mast, i) => cells.set(flagCell(mast.flag), i * 2));
    plane.setAttribute("flagCell", new InstancedBufferAttribute(cells, 2));
    return plane;
  }, [masts]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    retainFlagMaterial();
    return releaseFlagMaterial;
  }, []);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const scale = new Vector3(1, 1, 1);
    masts.forEach((mast, i) => {
      matrix.compose(new Vector3(...mast.position), rotation, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [masts, geometry]);

  return (
    <>
      {masts.map((mast) => (
        <Piece
          key={mast.position.join(",")}
          build={flagMast}
          position={mast.position}
        />
      ))}
      <instancedMesh
        ref={meshRef}
        args={[geometry, flagMaterial(), masts.length]}
        castShadow
      />
    </>
  );
};
