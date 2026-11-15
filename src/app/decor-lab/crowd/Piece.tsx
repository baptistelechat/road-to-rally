"use client";

import { useEffect, useMemo } from "react";
import type { BufferGeometry } from "three";
import { DRESSING_MATERIAL } from "./crowdMaterial";
import type { Vec3 } from "./geometry";

interface PieceProps {
  /** Fabrique stable (déclarée hors du composant) : la géométrie n'est construite qu'une fois. */
  build: () => BufferGeometry;
  position?: Vec3;
  rotation?: Vec3;
}

/** Élément d'habillage fixe, libéré au démontage. */
export const Piece = ({
  build,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: PieceProps) => {
  const geometry = useMemo(() => build(), [build]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      material={DRESSING_MATERIAL}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    />
  );
};
