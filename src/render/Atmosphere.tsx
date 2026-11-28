"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { type DirectionalLight, Object3D } from "three";
import type { CarSource } from "./carSource";
import { DEFAULT_LOOK, LOOK_PRESETS, type LookId } from "./look";

/**
 * Demi-côté de la zone d'ombre : assez loin pour que les ombres n'apparaissent pas sous les yeux (PR-14, puis 120 m le
 * 28/11 à la demande de Baptiste).
 */
export const SHADOW_RANGE = 120;
/**
 * Carte d'ombre de départ ; `RenderQuality` passe à 4096 sur ses paliers les plus beaux. 4096 coûtait 3 ms par image
 * sur un GPU intégré (mesuré le 28/11).
 */
const SHADOW_MAP_SIZE = 2048;
/** La zone d'ombre avance par pas de texel de la carte la plus grossière, multiple de celui de la plus fine : pas de scintillement */
const SHADOW_SNAP = (SHADOW_RANGE * 2) / SHADOW_MAP_SIZE;
/**
 * Zone d'ombre avancée devant la voiture, en mètres : la caméra regarde devant, et centrée sur la voiture la zone
 * gâchait sa moitié à l'arrière, les ombres des arbres surgissant à 60-80 m (28/11). La voiture garde ce qu'il reste
 * de la demi-zone autour d'elle.
 */
export const SHADOW_AHEAD = 60;

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
    // Avant de la voiture (-Z local) à plat, tiré du quaternion.
    const { x: qx, y: qy, z: qz, w: qw } = pose.rotation;
    const fx = -2 * (qx * qz + qw * qy);
    const fz = -(1 - 2 * (qx * qx + qy * qy));
    const flat = Math.hypot(fx, fz) || 1;
    const ahead = SHADOW_AHEAD / flat;
    const x =
      Math.round((pose.position.x + fx * ahead) / SHADOW_SNAP) * SHADOW_SNAP;
    const z =
      Math.round((pose.position.z + fz * ahead) / SHADOW_SNAP) * SHADOW_SNAP;
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
        shadow-mapSize={[SHADOW_MAP_SIZE, SHADOW_MAP_SIZE]}
        shadow-camera-left={-SHADOW_RANGE}
        shadow-camera-right={SHADOW_RANGE}
        shadow-camera-top={SHADOW_RANGE}
        shadow-camera-bottom={-SHADOW_RANGE}
        shadow-camera-near={1}
        shadow-camera-far={320}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
};
