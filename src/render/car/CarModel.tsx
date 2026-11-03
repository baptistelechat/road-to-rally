"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Group, type Mesh, MeshStandardMaterial } from "three";
import type { CarSource } from "@/render/carSource";
import { createShiftJolt } from "@/render/fx/shiftJolt";
import { carConfig } from "@/sim/carConfig";
import { discGlow, stepDiscHeat } from "./brakeDisc";
import { buildCarGeometry, maxWheelOffset } from "./buildCarGeometry";
import {
  createDecalTexture,
  drawNumber,
  drawPlate,
  FLAG_SIZE,
  NUMBER_SIZE,
  PLATE_SIZE,
} from "./decals";
import { drawFlagWhenSettled } from "./flags";
import { defaultLivery, type Livery } from "./livery";

const BRAKE_GLOW_OFF = 0.15;
const BRAKE_GLOW_ON = 3;
const REVERSE_GLOW_OFF = 0;
const REVERSE_GLOW_ON = 2.5;
const WHEEL_OFFSET_LIMIT = maxWheelOffset(carConfig);
/** Plongée de la caisse au passage de rapport, en radians */
const SHIFT_BODY_PITCH = 0.02;

const createDiscMaterial = (): MeshStandardMaterial =>
  new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    metalness: 0.4,
    emissive: "#ff3a0a",
    emissiveIntensity: 0,
  });

interface CarModelProps {
  /** Si fourni, le modèle suit la simulation tout seul, sans rendu React. Sinon le parent place le groupe. */
  source?: CarSource;
  livery?: Livery;
}

export const CarModel = ({ source, livery = defaultLivery }: CarModelProps) => {
  const { primary, secondary, accent, rim } = livery;
  const { plateText, plateStyle, numberText, numberStyle, flag } = livery;
  // Seules les couleurs repeignent la caisse : une plaque ou un drapeau ne la reconstruit pas.
  const car = useMemo(
    () => buildCarGeometry({ primary, secondary, accent, rim }),
    [primary, secondary, accent, rim],
  );
  const plateTexture = useMemo(
    () =>
      createDecalTexture(PLATE_SIZE, (ctx) =>
        drawPlate(ctx, plateText, plateStyle),
      ),
    [plateText, plateStyle],
  );
  const numberTexture = useMemo(
    () =>
      createDecalTexture(NUMBER_SIZE, (ctx) =>
        drawNumber(ctx, numberText, numberStyle, accent),
      ),
    [numberText, numberStyle, accent],
  );
  const flagTexture = useMemo(
    () => createDecalTexture(FLAG_SIZE, () => {}),
    [],
  );
  const root = useRef<Group>(null);
  const bodyGroup = useRef<Group>(null);
  const [shiftJolt] = useState(createShiftJolt);
  // Une matière par essieu : l'avant freine plus et chauffe plus.
  const [discMaterials] = useState(() => [
    createDiscMaterial(),
    createDiscMaterial(),
  ]);
  const discHeat = useRef([0, 0]);
  const mounts = useRef<(Group | null)[]>([]);
  const spins = useRef<(Mesh | null)[]>([]);
  const brakeMaterial = useRef<MeshStandardMaterial>(null);
  const reverseMaterial = useRef<MeshStandardMaterial>(null);

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
    },
    [car],
  );
  useEffect(
    () => () => {
      for (const material of discMaterials) material.dispose();
    },
    [discMaterials],
  );
  useEffect(() => () => plateTexture.dispose(), [plateTexture]);
  useEffect(() => () => numberTexture.dispose(), [numberTexture]);
  useEffect(() => () => flagTexture.dispose(), [flagTexture]);
  useEffect(
    () =>
      drawFlagWhenSettled(
        flag,
        () => flagTexture.image as HTMLCanvasElement,
        () => {
          flagTexture.needsUpdate = true;
        },
      ),
    [flag, flagTexture],
  );

  useFrame((_, dt) => {
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
    if (bodyGroup.current)
      bodyGroup.current.rotation.x =
        -SHIFT_BODY_PITCH * shiftJolt.update(state.gear, dt);
    [carConfig.front, carConfig.rear].forEach((axle, i) => {
      // Le frein à main ne serre que l'arrière.
      const brake = i === 1 && state.handbrake ? 1 : state.brake;
      discHeat.current[i] = stepDiscHeat(
        discHeat.current[i],
        brake,
        state.speed,
        axle.brakeShare,
        dt,
      );
      discMaterials[i].emissiveIntensity = discGlow(discHeat.current[i]);
    });
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
    if (reverseMaterial.current) {
      reverseMaterial.current.emissiveIntensity =
        state.gear < 0 ? REVERSE_GLOW_ON : REVERSE_GLOW_OFF;
    }
  });

  return (
    <group ref={root}>
      <group ref={bodyGroup}>
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
        <mesh geometry={car.reverseLights}>
          <meshStandardMaterial
            ref={reverseMaterial}
            vertexColors
            roughness={0.4}
            emissive="#fff1cf"
            emissiveIntensity={REVERSE_GLOW_OFF}
          />
        </mesh>
        <mesh geometry={car.plates}>
          <meshStandardMaterial map={plateTexture} roughness={0.5} />
        </mesh>
        <mesh geometry={car.numbers}>
          <meshStandardMaterial
            map={numberTexture}
            roughness={0.6}
            transparent
          />
        </mesh>
        <mesh geometry={car.flags}>
          {/* Transparent le temps que le drapeau arrive : le canvas est encore vide. */}
          <meshStandardMaterial map={flagTexture} roughness={0.6} transparent />
        </mesh>
      </group>
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
          <mesh geometry={wheel.disc} material={discMaterials[i < 2 ? 0 : 1]} />
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
