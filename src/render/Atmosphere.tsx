"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { type DirectionalLight, Object3D } from "three";
import type { CarSource } from "./carSource";
import { DEFAULT_LOOK, LOOK_PRESETS, type LookId } from "./look";

/** Demi-côté de la zone d'ombre autour de la voiture */
const SHADOW_RANGE = 45;
/** La zone d'ombre avance par pas de texel : les bords d'ombre ne scintillent pas en roulant */
const SHADOW_SNAP = (SHADOW_RANGE * 2) / 2048;

interface AtmosphereProps {
  /** La zone d'ombre suit cette voiture ; sans elle, elle reste centrée sur l'origine */
  follow?: CarSource;
  fog?: boolean;
  /** Ambiance lumineuse (story 5.1) ; fin d'après-midi par défaut */
  look?: LookId;
}

/** Ciel uni, lumière et brouillard de l'ambiance choisie. Le `<Canvas>` doit avoir la prop `shadows`. */
export const Atmosphere = ({
  follow,
  fog = true,
  look = DEFAULT_LOOK,
}: AtmosphereProps) => {
  const lightRef = useRef<DirectionalLight>(null);
  const [target] = useState(() => new Object3D());
  const preset = LOOK_PRESETS[look];
  const sun = preset.sun.offset;

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
    light.position.set(x + sun.x, y + sun.y, z + sun.z);
  });

  return (
    <>
      <color attach="background" args={[preset.sky]} />
      {fog && (
        <fog
          attach="fog"
          args={[preset.sky, preset.fog.near, preset.fog.far]}
        />
      )}
      <hemisphereLight
        args={[
          preset.hemisphere.sky,
          preset.hemisphere.ground,
          preset.hemisphere.intensity,
        ]}
      />
      <primitive object={target} />
      <directionalLight
        ref={lightRef}
        target={target}
        position={[sun.x, sun.y, sun.z]}
        color={preset.sun.color}
        intensity={preset.sun.intensity}
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
