"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { CarModel } from "@/render/car/CarModel";
import { carConfig, wheelAxle, wheelRestPosition } from "@/sim/carConfig";

const TURN_SPEED = 0.25;
const PLATE_HEIGHT = 0.12;

// L'origine du modèle est le centre de la caisse : on le remonte pour poser les pneus sur le plateau.
const carHeight =
  wheelAxle(carConfig, 0).wheelRadius - wheelRestPosition(carConfig, 0).y;

const Turntable = () => {
  const table = useRef<Group>(null);

  useFrame((_, delta) => {
    if (table.current) table.current.rotation.y += delta * TURN_SPEED;
  });

  return (
    <group ref={table}>
      <mesh position={[0, -PLATE_HEIGHT / 2, 0]} receiveShadow>
        <cylinderGeometry args={[3.1, 3.2, PLATE_HEIGHT, 48]} />
        <meshStandardMaterial color="#55534e" roughness={0.9} />
      </mesh>
      <group position={[0, carHeight, 0]}>
        <CarModel />
      </group>
    </group>
  );
};

export const GarageScene = () => (
  <div className="fixed inset-0 bg-[#c9c3b4]">
    <Canvas shadows camera={{ position: [-5, 2.2, -6], fov: 32 }}>
      <color attach="background" args={["#c9c3b4"]} />
      <fog attach="fog" args={["#c9c3b4", 16, 40]} />
      <hemisphereLight args={["#fff4e0", "#6b6a5e", 1.1]} />
      <directionalLight
        position={[5, 8, 3]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0004}
      />
      <directionalLight
        position={[-6, 3, -4]}
        intensity={0.6}
        color="#cfdcff"
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -PLATE_HEIGHT, 0]}
        receiveShadow
      >
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color="#b9b3a4" roughness={1} />
      </mesh>
      <Turntable />
      <OrbitControls
        target={[0, 0.6, 0]}
        enablePan={false}
        minDistance={3}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2 - 0.02}
      />
    </Canvas>
  </div>
);
