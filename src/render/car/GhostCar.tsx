"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Group, MeshStandardMaterial } from "three";
import type { CarSource } from "@/render/carSource";
import { carConfig } from "@/sim/carConfig";
import { buildCarGeometry } from "./buildCarGeometry";
import { defaultColors } from "./livery";

const GHOST_OPACITY = 0.35;

interface GhostCarProps {
  /** Pose du fantôme, `null` pour le masquer (avant le GO, après sa fin, option coupée) */
  source: Pick<CarSource, "getPose">;
}

/** Voiture translucide qui suit une pose : ne lit que `getPose`, n'écrit jamais l'état. */
export const GhostCar = ({ source }: GhostCarProps) => {
  const car = useMemo(() => buildCarGeometry(defaultColors), []);
  // Sans écriture de profondeur : la voiture du joueur reste visible à travers, et le fantôme ne se masque pas lui-même.
  const [material] = useState(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.6,
        transparent: true,
        opacity: GHOST_OPACITY,
        depthWrite: false,
      }),
  );
  const root = useRef<Group>(null);

  useEffect(
    () => () => {
      car.body.dispose();
      car.brakeLights.dispose();
      car.reverseLights.dispose();
      car.plates.dispose();
      car.numbers.dispose();
      car.flags.dispose();
      for (const wheel of car.wheels) {
        wheel.geometry.dispose();
        wheel.disc.dispose();
      }
      material.dispose();
    },
    [car, material],
  );

  useFrame(() => {
    const group = root.current;
    if (!group) return;
    const pose = source.getPose();
    group.visible = pose !== null;
    if (!pose) return;
    const { position: p, rotation: r } = pose;
    group.position.set(p.x, p.y, p.z);
    group.quaternion.set(r.x, r.y, r.z, r.w);
  });

  // ponytail: caisse et roues fixes, sans braquage ni rotation : le fantôme ne garde que la pose.
  return (
    <group ref={root} visible={false}>
      <mesh geometry={car.body} material={material} />
      {car.wheels.map((wheel, i) => (
        <mesh
          key={i}
          geometry={wheel.geometry}
          material={material}
          position={[
            wheel.position.x,
            wheel.position.y + carConfig.ride.sag,
            wheel.position.z,
          ]}
        />
      ))}
    </group>
  );
};
