"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { type DirectionalLight, Object3D } from "three";
import type { CarSource } from "./carSource";

const SKY = "#e9c9a2";
const SUN_OFFSET = { x: 70, y: 55, z: 45 };
/** Demi-côté de la zone d'ombre autour de la voiture */
const SHADOW_RANGE = 45;
/** La zone d'ombre avance par pas de texel : les bords d'ombre ne scintillent pas en roulant */
const SHADOW_SNAP = (SHADOW_RANGE * 2) / 2048;

interface AtmosphereProps {
  /** La zone d'ombre suit cette voiture ; sans elle, elle reste centrée sur l'origine */
  follow?: CarSource;
  fog?: boolean;
}

/** Ciel uni, lumière de fin d'après-midi, brouillard léger. Le `<Canvas>` doit avoir la prop `shadows`. */
export const Atmosphere = ({ follow, fog = true }: AtmosphereProps) => {
  const lightRef = useRef<DirectionalLight>(null);
  const [target] = useState(() => new Object3D());

  useFrame(() => {
    const light = lightRef.current;
    const pose = follow?.getPose();
    if (!light || !pose) return;
    const x = Math.round(pose.position.x / SHADOW_SNAP) * SHADOW_SNAP;
    const z = Math.round(pose.position.z / SHADOW_SNAP) * SHADOW_SNAP;
    // Aussi en altitude : en côte, y bouge à chaque image et ferait scintiller les ombres.
    const y = Math.round(pose.position.y / SHADOW_SNAP) * SHADOW_SNAP;
    target.position.set(x, y, z);
    target.updateMatrixWorld();
    light.position.set(x + SUN_OFFSET.x, y + SUN_OFFSET.y, z + SUN_OFFSET.z);
  });

  return (
    <>
      <color attach="background" args={[SKY]} />
      {fog && <fog attach="fog" args={[SKY, 140, 760]} />}
      <hemisphereLight args={["#ffe2bd", "#54603a", 1.1]} />
      <primitive object={target} />
      <directionalLight
        ref={lightRef}
        target={target}
        position={[SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z]}
        color="#ffc98a"
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_RANGE}
        shadow-camera-right={SHADOW_RANGE}
        shadow-camera-top={SHADOW_RANGE}
        shadow-camera-bottom={-SHADOW_RANGE}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
};
