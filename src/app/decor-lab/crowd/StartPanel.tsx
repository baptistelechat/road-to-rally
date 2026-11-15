"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, Color, MeshStandardMaterial } from "three";
import type { Vec3 } from "./geometry";

// Panneau lumineux du départ, repris de `StartLights.tsx` : ici un décompte en boucle, sans simulation.

const LAMPS = 3;
const LAMP_SIZE = 0.42;
const LAMP_GAP = 0.75;
const HOUSING_HEIGHT = 0.6;
const GLOW = 3;
/** Une seconde par rouge, puis le vert, puis éteint : cycle en secondes */
const CYCLE = LAMPS + 3;

const OFF = new Color("#000000");
const RED = new Color("#ff2a1a");
const GREEN = new Color("#2aff5a");

/** Rampe de feux accrochée sous l'enseigne ; `position` = centre du boîtier. */
export const StartPanel = ({ position }: { position: Vec3 }) => {
  const rig = useMemo(
    () => ({
      housing: new BoxGeometry(LAMPS * LAMP_GAP + 0.3, HOUSING_HEIGHT, 0.5),
      housingMaterial: new MeshStandardMaterial({
        color: "#1c1c20",
        flatShading: true,
      }),
      // Cubes : visibles des deux côtés de l'arche.
      lamp: new BoxGeometry(LAMP_SIZE, LAMP_SIZE, 0.6),
      lamps: Array.from(
        { length: LAMPS },
        () =>
          new MeshStandardMaterial({
            color: "#141414",
            emissive: OFF,
            emissiveIntensity: GLOW,
            flatShading: true,
          }),
      ),
    }),
    [],
  );

  useEffect(
    () => () => {
      rig.housing.dispose();
      rig.housingMaterial.dispose();
      rig.lamp.dispose();
      for (const material of rig.lamps) material.dispose();
    },
    [rig],
  );

  /** Dernier état peint : -1 vert, sinon le nombre de rouges */
  const painted = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime % CYCLE;
    const state =
      t < LAMPS + 1 ? Math.min(LAMPS, Math.floor(t)) : t < CYCLE - 1 ? -1 : 0;
    if (state === painted.current) return;
    painted.current = state;
    rig.lamps.forEach((material, i) => {
      material.emissive.copy(state === -1 ? GREEN : i < state ? RED : OFF);
    });
  });

  return (
    <group position={position}>
      <mesh geometry={rig.housing} material={rig.housingMaterial} castShadow />
      {rig.lamps.map((material, i) => (
        <mesh
          key={i}
          geometry={rig.lamp}
          material={material}
          position={[(i - (LAMPS - 1) / 2) * LAMP_GAP, 0, 0]}
        />
      ))}
    </group>
  );
};
