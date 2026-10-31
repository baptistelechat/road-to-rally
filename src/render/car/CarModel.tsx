"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { CarSource } from "@/render/carSource";
import { carConfig } from "@/sim/carConfig";
import { buildCarGeometry, maxWheelOffset } from "./buildCarGeometry";
import { defaultLivery, type Livery } from "./livery";

const BRAKE_GLOW_OFF = 0.15;
const BRAKE_GLOW_ON = 3;
const WHEEL_OFFSET_LIMIT = maxWheelOffset(carConfig);

interface CarModelProps {
  /** Si fourni, le modèle suit la simulation tout seul, sans rendu React. Sinon le parent place le groupe. */
  source?: CarSource;
  livery?: Livery;
}

export const CarModel = ({ source, livery = defaultLivery }: CarModelProps) => {
  const car = useMemo(() => buildCarGeometry(livery), [livery]);
  const root = useRef<Group>(null);
  const mounts = useRef<(Group | null)[]>([]);
  const spins = useRef<(Mesh | null)[]>([]);
  const brakeMaterial = useRef<MeshStandardMaterial>(null);

  useEffect(
    () => () => {
      car.body.dispose();
      car.brakeLights.dispose();
      for (const wheel of car.wheels) wheel.geometry.dispose();
    },
    [car],
  );

  useFrame(() => {
    if (!source) return;
    const pose = source.getPose();
    if (pose && root.current) {
      const { position, rotation } = pose;
      root.current.position.set(position.x, position.y, position.z);
      root.current.quaternion.set(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
      );
    }
    const state = source.getState();
    if (!state) return;
    car.wheels.forEach((wheel, i) => {
      const mount = mounts.current[i];
      const spin = spins.current[i];
      const wheelState = state.wheels[i];
      if (!mount || !spin || !wheelState) return;
      // ponytail: limite visuelle seule, la physique garde tout son débattement ; sur un gros choc, le pneu mord le sol un instant.
      mount.position.y =
        wheel.position.y + Math.min(wheelState.offsetY, WHEEL_OFFSET_LIMIT);
      // Avant = -Z : braquer à droite et rouler en avant sont des rotations négatives autour de Y et X.
      mount.rotation.y = -wheelState.steerAngle;
      spin.rotation.x = -wheelState.spinAngle;
    });
    if (brakeMaterial.current) {
      brakeMaterial.current.emissiveIntensity =
        state.brake > 0.02 ? BRAKE_GLOW_ON : BRAKE_GLOW_OFF;
    }
  });

  return (
    <group ref={root}>
      <mesh geometry={car.body} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh geometry={car.brakeLights}>
        <meshStandardMaterial
          ref={brakeMaterial}
          vertexColors
          roughness={0.4}
          emissive="#ff2413"
          emissiveIntensity={BRAKE_GLOW_OFF}
        />
      </mesh>
      {car.wheels.map((wheel, i) => (
        <group
          key={i}
          position={[
            wheel.position.x,
            wheel.position.y + carConfig.ride.sag,
            wheel.position.z,
          ]}
          ref={(mount) => {
            mounts.current[i] = mount;
          }}
        >
          <mesh
            geometry={wheel.geometry}
            castShadow
            ref={(spin) => {
              spins.current[i] = spin;
            }}
          >
            <meshStandardMaterial vertexColors roughness={0.75} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
