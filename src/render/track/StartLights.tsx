"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, Color, MeshStandardMaterial, Quaternion } from "three";
import { redLightsOn } from "@/audio/countdownBeep";
import { startArch } from "@/sim/track/scenery";
import type { Track } from "@/sim/types";
import { BANNER_Y } from "./TrackFurniture";

const LAMPS = 3;
const LAMP_SIZE = 0.42;
const LAMP_GAP = 0.75;
const HOUSING_HEIGHT = 0.6;
/** Le vert reste allumé ce temps après le GO, en secondes */
const GREEN_S = 2;
const GLOW = 3;

const OFF = new Color("#000000");
const RED = new Color("#ff2a1a");
const GREEN = new Color("#2aff5a");

interface StartLightsProps {
  track: Track;
  /** `sim.countdown` : secondes avant le GO, `null` une fois parti */
  getCountdown: () => number | null;
}

/** Rampe de feux sous la bannière de départ : rouges un par un au décompte, tous verts au GO. Lit la simulation sans l'écrire. */
export const StartLights = ({ track, getCountdown }: StartLightsProps) => {
  const rig = useMemo(() => {
    const { position, rotation } = startArch(track);
    const width = LAMPS * LAMP_GAP + 0.3;
    return {
      position,
      quaternion: new Quaternion(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
      ),
      housing: new BoxGeometry(width, HOUSING_HEIGHT, 0.5),
      // Cubes : visibles des deux côtés de la bannière, quelle que soit l'orientation de l'arche.
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
    };
  }, [track]);

  useEffect(
    () => () => {
      rig.housing.dispose();
      rig.lamp.dispose();
      for (const material of rig.lamps) material.dispose();
    },
    [rig],
  );

  const lit = useRef(0);
  const greenLeft = useRef(0);
  /** Dernier état peint : -1 pour vert, sinon le nombre de rouges */
  const painted = useRef(0);

  useFrame((_, delta) => {
    const seconds = getCountdown();
    if (seconds === null) {
      if (lit.current > 0) greenLeft.current = GREEN_S;
      lit.current = 0;
      greenLeft.current = Math.max(0, greenLeft.current - delta);
    } else {
      lit.current = redLightsOn(seconds);
      greenLeft.current = 0;
    }
    const state = greenLeft.current > 0 ? -1 : lit.current;
    if (state === painted.current) return;
    painted.current = state;
    rig.lamps.forEach((material, i) => {
      material.emissive.copy(state === -1 ? GREEN : i < state ? RED : OFF);
    });
  });

  return (
    <group
      position={[rig.position.x, rig.position.y, rig.position.z]}
      quaternion={rig.quaternion}
    >
      <group position={[0, BANNER_Y - HOUSING_HEIGHT / 2, 0]}>
        <mesh geometry={rig.housing} castShadow>
          <meshStandardMaterial color="#1c1c20" flatShading />
        </mesh>
        {rig.lamps.map((material, i) => (
          <mesh
            key={i}
            geometry={rig.lamp}
            material={material}
            position={[(i - (LAMPS - 1) / 2) * LAMP_GAP, 0, 0]}
          />
        ))}
      </group>
    </group>
  );
};
