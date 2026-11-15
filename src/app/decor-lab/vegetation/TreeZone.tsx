"use client";

import { useMemo } from "react";
import type { Material } from "three";
import { hash, tintOf, topOf, triangles } from "./geometry";
import { Instances, type Placement } from "./Instances";
import { Label } from "./Label";
import type { TreeModel } from "./trees";

/** Écart entre deux colonnes de modèles, en mètres */
const COLUMN_SPACING = 13;
/** Écart entre les 5 instances d'une colonne, en mètres */
const INSTANCE_SPACING = 7;
const INSTANCES = 5;
/** Les versions lointaines sont posées devant la colonne */
const FAR_OFFSET = 9;
/** Profondeur des deux rangées de colonnes */
export const TREE_ROWS_Z = [0, -48];

interface ColumnProps {
  model: TreeModel;
  material: Material;
  x: number;
  z: number;
  salt: number;
}

const Column = ({ model, material, x, z, salt }: ColumnProps) => {
  const placements = useMemo<Placement[]>(
    () =>
      Array.from({ length: INSTANCES }, (_, i): Placement => {
        const s =
          model.minScale + hash(i, salt, 1) * (model.maxScale - model.minScale);
        return {
          x: x + (hash(i, salt, 2) - 0.5) * 3,
          z: z - i * INSTANCE_SPACING,
          yaw: hash(i, salt, 3) * Math.PI * 2,
          scale: [s, s, s],
          tint: tintOf(salt * 7 + i),
        };
      }),
    [model, x, z, salt],
  );
  const far = model.far;
  const farPlacement = useMemo<Placement[]>(
    () => [
      { x, z: z + FAR_OFFSET, yaw: 0.6, scale: [1, 1, 1], tint: [1, 1, 1] },
    ],
    [x, z],
  );
  const near = triangles(model.near);

  return (
    <group>
      <Instances
        geometry={model.near}
        material={material}
        placements={placements}
      />
      <Label
        position={[x, topOf(model.near) * model.maxScale + 1.5, z]}
        title={model.label}
        lines={[
          `${near} triangles`,
          far
            ? `lointain : ${triangles(far)} triangles`
            : near > 60
              ? "au-delà de 60 : version lointaine à prévoir"
              : "sert aussi de loin",
        ]}
      />
      {far && (
        <>
          <Instances
            geometry={far}
            material={material}
            placements={farPlacement}
          />
          <Label
            position={[x, topOf(far) + 1, z + FAR_OFFSET]}
            title="Version lointaine"
            lines={[`${triangles(far)} triangles`]}
          />
        </>
      )}
    </group>
  );
};

interface TreeZoneProps {
  rows: TreeModel[][];
  material: Material;
}

/** Catalogue des arbres : une colonne de 5 instances par modèle, la version lointaine devant. */
export const TreeZone = ({ rows, material }: TreeZoneProps) => (
  <group>
    {rows.map((row, r) =>
      row.map((model, i) => (
        <Column
          key={model.id}
          model={model}
          material={material}
          x={(i - (row.length - 1) / 2) * COLUMN_SPACING}
          z={TREE_ROWS_Z[r] ?? 0}
          salt={r * 20 + i + 1}
        />
      )),
    )}
  </group>
);
