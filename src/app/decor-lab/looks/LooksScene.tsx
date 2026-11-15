"use client";

import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import {
  Color,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { Atmosphere } from "@/render/Atmosphere";
import { RIG_TUNING } from "@/render/camera/cameraRig";
import { CarModel } from "@/render/car/CarModel";
import type { LookId } from "@/render/look";
import { DECOR_PALETTE, type Rgb } from "@/render/palette";
import {
  SCENERY_GEOMETRY,
  SCENERY_MATERIAL,
  type StaticSceneryKind,
} from "@/render/scenery/models";
import { carConfig } from "@/sim/carConfig";
import {
  type BuildingKind,
  buildingGeometry,
  roadGeometry,
  roadLinesGeometry,
} from "./labGeometry";

const RIDE = carConfig.ride.height;
/** Caméra de poursuite au repos : derrière la voiture (cap -Z), à la distance et la hauteur du jeu */
const CAMERA_POSITION = new Vector3(
  0,
  RIDE + RIG_TUNING.chaseHeight,
  RIG_TUNING.chaseDistance,
);
/** Point visé : devant la voiture, à `lookHeight`, ce qui donne la plongée de la caméra du jeu */
export const LOOK_TARGET = new Vector3(
  0,
  RIDE + RIG_TUNING.lookHeight,
  -RIG_TUNING.lookAhead,
);
export const CHASE_FOV = RIG_TUNING.chaseFov;

const ASPHALT: Rgb = [0.11, 0.11, 0.12];
const ROAD_LINE: Rgb = [0.82, 0.82, 0.78];

const linear = ([r, g, b]: Rgb): Color => new Color().setRGB(r, g, b);

interface Placed<K> {
  kind: K;
  x: number;
  z: number;
  /** Cap en radians */
  turn?: number;
  scale?: number;
}

/** Bois à gauche de la route, bosquet au creux de l'épingle, quelques bottes au bord. */
const SCENERY: readonly Placed<StaticSceneryKind>[] = [
  { kind: "pine", x: -9, z: 6, scale: 1.1 },
  { kind: "pine", x: -12, z: -4 },
  { kind: "pine", x: -16, z: 10, scale: 1.3 },
  { kind: "tree", x: -10, z: -16, scale: 1.2 },
  { kind: "pine", x: -18, z: -12 },
  { kind: "tree", x: -6, z: 22 },
  { kind: "pine", x: -22, z: 0, scale: 1.2 },
  { kind: "tree", x: 14, z: -24 },
  { kind: "tree", x: 18, z: -18, scale: 0.9 },
  { kind: "pine", x: 12, z: -14 },
  { kind: "tree", x: 40, z: -30, scale: 1.3 },
  { kind: "pine", x: 6, z: -48, scale: 1.2 },
  { kind: "rock", x: -4.5, z: -8, scale: 0.7 },
  { kind: "hay", x: 5, z: 18, turn: 0.4 },
  { kind: "hayUpright", x: 7, z: 21 },
  { kind: "sign", x: 4.2, z: -10, turn: -0.3 },
];

/** Hameau entre les deux branches du lacet */
const BUILDINGS: readonly (Placed<BuildingKind> & {
  /** Largeur, profondeur et hauteur des murs */
  size: [number, number, number];
})[] = [
  { kind: "house", x: 11, z: 4, turn: 0.15, size: [8, 7, 5.5] },
  { kind: "farm", x: 19, z: 22, turn: -0.2, size: [14, 9, 6] },
  { kind: "house", x: 8, z: 12, turn: 1.6, size: [7, 6, 5] },
  { kind: "church", x: 19, z: -4, turn: 0.05, size: [6, 12, 9] },
];

/** Collines lointaines : la fin du brouillard se lit sur elles. */
const HILLS: readonly { x: number; z: number; radius: number }[] = [
  { x: -120, z: -180, radius: 70 },
  { x: 60, z: -320, radius: 110 },
  { x: -260, z: -420, radius: 140 },
  { x: 240, z: -560, radius: 160 },
  { x: -40, z: -820, radius: 200 },
  { x: 380, z: -150, radius: 90 },
];

/** Place la caméra comme la poursuite du jeu à l'arrêt ; `OrbitControls` permet ensuite d'en sortir. */
const ChaseCamera = () => {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.copy(CAMERA_POSITION);
    camera.lookAt(LOOK_TARGET);
  }, [camera]);
  return null;
};

interface LooksSceneProps {
  look: LookId;
}

/** Petite scène type : route en lacet, voiture à l'arrêt, maisons, arbres et collines dans le brouillard. */
export const LooksScene = ({ look }: LooksSceneProps) => {
  const road = useMemo(() => roadGeometry(), []);
  const lines = useMemo(() => roadLinesGeometry(), []);
  const buildings = useMemo(
    () =>
      BUILDINGS.map(({ kind, size: [w, d, h] }) =>
        buildingGeometry(kind, w, d, h),
      ),
    [],
  );
  const hill = useMemo(() => new IcosahedronGeometry(1, 1), []);
  const materials = useMemo(
    () => ({
      grass: new MeshStandardMaterial({
        color: linear(DECOR_PALETTE.ground.meadow),
        roughness: 1,
      }),
      road: new MeshStandardMaterial({
        color: linear(ASPHALT),
        roughness: 0.9,
      }),
      line: new MeshStandardMaterial({
        color: linear(ROAD_LINE),
        roughness: 0.8,
      }),
      hill: new MeshStandardMaterial({
        color: linear(DECOR_PALETTE.ground.forestFloor),
        roughness: 1,
        flatShading: true,
      }),
    }),
    [],
  );

  return (
    <>
      <ChaseCamera />
      <OrbitControls target={LOOK_TARGET} maxPolarAngle={Math.PI * 0.49} />
      <Atmosphere look={look} />
      <mesh rotation-x={-Math.PI / 2} material={materials.grass} receiveShadow>
        <circleGeometry args={[1400, 48]} />
      </mesh>
      <mesh geometry={road} material={materials.road} receiveShadow />
      <mesh geometry={lines} material={materials.line} receiveShadow />
      <group position={[0, RIDE, 0]}>
        <CarModel />
      </group>
      {SCENERY.map(({ kind, x, z, turn = 0, scale = 1 }, i) => (
        <mesh
          key={i}
          geometry={SCENERY_GEOMETRY[kind]}
          material={SCENERY_MATERIAL}
          position={[x, 0, z]}
          rotation-y={turn}
          scale={scale}
          castShadow
          receiveShadow
        />
      ))}
      {BUILDINGS.map(({ x, z, turn = 0 }, i) => (
        <mesh
          key={i}
          geometry={buildings[i]}
          material={SCENERY_MATERIAL}
          position={[x, 0, z]}
          rotation-y={turn}
          castShadow
          receiveShadow
        />
      ))}
      {HILLS.map(({ x, z, radius }, i) => (
        <mesh
          key={i}
          geometry={hill}
          material={materials.hill}
          position={[x, -radius * 0.55, z]}
          scale={[radius, radius, radius]}
        />
      ))}
    </>
  );
};
