"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  ConeGeometry,
  type Group,
  type Mesh,
  Vector3,
} from "three";
import type { CarAudio } from "@/audio/engineAudio";
import { exhaustOutlet } from "@/render/car/buildCarGeometry";
import type { CarSource } from "@/render/carSource";
import type { DustPool } from "./dustPool";
import { createExhaustFlash } from "./exhaustFlash";

const OUTLET = exhaustOutlet();

/** Cône low-poly, base à l'origine, pointe vers l'arrière de la voiture (+Z). */
const createFlameGeometry = (): ConeGeometry => {
  const geometry = new ConeGeometry(1, 1, 6);
  geometry.translate(0, 0.5, 0);
  geometry.rotateX(Math.PI / 2);
  return geometry;
};

interface ExhaustFlameProps {
  source: CarSource;
  audio: CarAudio;
  dust: DustPool;
}

/** Flamme calée sur les détonations du son. Attachée au pot, sinon elle resterait en arrière à pleine vitesse. */
export const ExhaustFlame = ({ source, audio, dust }: ExhaustFlameProps) => {
  const [flash] = useState(createExhaustFlash);
  const [geometry] = useState(createFlameGeometry);
  const [world] = useState(() => new Vector3());
  const root = useRef<Group>(null);
  const outer = useRef<Mesh>(null);
  const inner = useRef<Mesh>(null);

  useEffect(() => {
    audio.setPopListener(flash.trigger);
    return () => audio.setPopListener(null);
  }, [audio, flash]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, dt) => {
    const pose = source.getPose();
    const state = source.getState();
    const group = root.current;
    if (!pose || !state || !group || !outer.current || !inner.current) return;
    const { position, rotation } = pose;
    group.position.set(position.x, position.y, position.z);
    group.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

    const intensity = flash.update(dt, (strength) => {
      world.set(OUTLET.x, OUTLET.y, OUTLET.z).applyQuaternion(group.quaternion);
      world.add(group.position);
      dust.burst(world, state.linearVelocity, strength);
    });
    const visible = intensity > 0.03;
    group.visible = visible;
    if (!visible) return;
    // Longueur tirée à chaque image : c'est ce qui la fait vaciller.
    const length = (0.3 + 0.7 * intensity) * (0.8 + Math.random() * 0.4);
    const radius = 0.07 + 0.07 * intensity;
    outer.current.scale.set(radius, radius, length);
    inner.current.scale.set(radius * 0.55, radius * 0.55, length * 0.6);
  });

  return (
    <group ref={root} visible={false}>
      <group position={[OUTLET.x, OUTLET.y, OUTLET.z]}>
        <mesh ref={outer} geometry={geometry} renderOrder={3}>
          <meshBasicMaterial
            color="#ff6a14"
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            transparent
          />
        </mesh>
        <mesh ref={inner} geometry={geometry} renderOrder={3}>
          <meshBasicMaterial
            color="#ffe2a0"
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
};
