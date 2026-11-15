"use client";

import { useMemo } from "react";
import { type BufferGeometry, Color, type Material } from "three";
import { DECOR_PALETTE } from "@/render/palette";
import { triangles } from "./geometry";
import { Instances } from "./Instances";
import { Label } from "./Label";
import {
  cepTrianglesPerHectare,
  PARCEL_LENGTH,
  PARCEL_WIDTH,
  parcelEndPosts,
  parcelModules,
  trianglesPerHectare,
  VINE_MODULE,
  type VineModel,
} from "./vines";

/** Centre des deux parcelles de démonstration */
export const VINE_CENTER_Z = 120;
const PARCEL_X = 20;

const format = (value: number): string =>
  Math.round(value).toLocaleString("fr-FR");

interface ParcelProps {
  vine: VineModel;
  endPost: BufferGeometry;
  material: Material;
  x: number;
  salt: number;
}

const Parcel = ({ vine, endPost, material, x, salt }: ParcelProps) => {
  const modules = useMemo(() => parcelModules(salt), [salt]);
  const posts = useMemo(() => parcelEndPosts(), []);
  const soil = useMemo(
    () => new Color().setRGB(...DECOR_PALETTE.ground.vineyard),
    [],
  );
  const each = triangles(vine.geometry);
  const parcel = each * modules.length + triangles(endPost) * posts.length;
  return (
    <group position={[x, 0, VINE_CENTER_Z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
        <planeGeometry args={[PARCEL_LENGTH + 2, PARCEL_WIDTH + 2]} />
        <meshStandardMaterial color={soil} roughness={1} />
      </mesh>
      <Instances
        geometry={vine.geometry}
        material={material}
        placements={modules}
      />
      <Instances geometry={endPost} material={material} placements={posts} />
      <Label
        position={[0, 4, -PARCEL_WIDTH / 2 - 2]}
        title={vine.label}
        lines={[
          `${each} tri par module de ${VINE_MODULE} m (${vine.note})`,
          `parcelle ${PARCEL_LENGTH} × ${PARCEL_WIDTH} m : ${modules.length} modules, ${format(parcel)} tri`,
          `≈ ${format(trianglesPerHectare(vine.geometry))} tri par hectare`,
        ]}
      />
    </group>
  );
};

interface VineZoneProps {
  vines: VineModel[];
  endPost: BufferGeometry;
  material: Material;
}

/** Deux parcelles de 30 × 20 m, rangs tous les 2 m, une par proposition. */
export const VineZone = ({ vines, endPost, material }: VineZoneProps) => (
  <group>
    {vines.map((vine, i) => (
      <Parcel
        key={vine.id}
        vine={vine}
        endPost={endPost}
        material={material}
        x={(i === 0 ? -1 : 1) * PARCEL_X}
        salt={401 + i}
      />
    ))}
    <Label
      position={[0, 3, VINE_CENTER_Z + PARCEL_WIDTH / 2 + 3]}
      title="Pour comparer : une instance par cep"
      lines={[
        `gobelet de 26 tri tous les mètres ≈ ${format(cepTrianglesPerHectare())} tri par hectare`,
      ]}
    />
  </group>
);
