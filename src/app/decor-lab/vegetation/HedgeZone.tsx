"use client";

import { useMemo } from "react";
import type { BufferGeometry, Material } from "three";
import { triangles } from "./geometry";
import {
  type BushModel,
  currentHedgeLine,
  HEDGE_DEMO_LENGTH,
  hedgeLine,
} from "./hedges";
import { Instances, type Placement } from "./Instances";
import { Label } from "./Label";

/** Profondeur des haies de démonstration, de l'actuelle à la troisième proposition */
export const HEDGE_ROWS_Z = [50, 60, 70, 80];

interface LineProps {
  geometry: BufferGeometry;
  material: Material;
  placements: Placement[];
  z: number;
  title: string;
  detail: string;
}

const Line = ({
  geometry,
  material,
  placements,
  z,
  title,
  detail,
}: LineProps) => {
  const each = triangles(geometry);
  return (
    <group>
      <Instances
        geometry={geometry}
        material={material}
        placements={placements}
        offset={[0, 0, z]}
      />
      <Label
        position={[-HEDGE_DEMO_LENGTH / 2 - 9, 2, z]}
        title={title}
        lines={[
          detail,
          `${each} tri × ${placements.length} = ${each * placements.length} tri pour ${HEDGE_DEMO_LENGTH} m`,
        ]}
      />
    </group>
  );
};

interface HedgeZoneProps {
  bushes: BushModel[];
  currentTree: BufferGeometry;
  material: Material;
}

/** Quatre haies droites de 40 m : l'actuelle (arbres tous les 4 m) puis les trois buissons proposés. */
export const HedgeZone = ({
  bushes,
  currentTree,
  material,
}: HedgeZoneProps) => {
  const current = useMemo(() => currentHedgeLine(301), []);
  const lines = useMemo(
    () =>
      bushes.map((bush, i) => ({ bush, placements: hedgeLine(bush, 311 + i) })),
    [bushes],
  );
  return (
    <group>
      <Line
        geometry={currentTree}
        material={material}
        placements={current}
        z={HEDGE_ROWS_Z[0] ?? 0}
        title="Actuel : arbres tous les 4 m"
        detail="tree, échelle 0,55 à 0,85, cap quelconque"
      />
      {lines.map(({ bush, placements }, i) => (
        <Line
          key={bush.id}
          geometry={bush.geometry}
          material={material}
          placements={placements}
          z={HEDGE_ROWS_Z[i + 1] ?? 0}
          title={bush.label}
          detail={`module ${bush.length.toLocaleString("fr-FR")} m tous les ${bush.spacing.toLocaleString("fr-FR")} m, haut. 1,5 à 3 m`}
        />
      ))}
    </group>
  );
};
