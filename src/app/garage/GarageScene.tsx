"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";
import { CarModel } from "@/render/car/CarModel";
import type { Livery } from "@/render/car/livery";
import { GARAGE_CAMERA } from "@/render/garage/buildGarageGeometry";
import { GarageDecor } from "@/render/garage/GarageDecor";
import { carConfig } from "@/sim/carConfig";
import { GaragePadControls } from "./GaragePadControls";
import { ROTATION_ROW } from "./garageMenu";
import { LiveryPanel, MENU_FOCUS } from "./LiveryPanel";
import { useGarageMenu } from "./useGarageMenu";

const TURN_SPEED = 0.25;
const PLATE_HEIGHT = 0.04;
const NIGHT = "#0b0e14";

const PAD_HELP: readonly (readonly [string, string])[] = [
  ["Croix / Stick gauche", "Naviguer"],
  ["A / B", "Valider / Annuler"],
  ["Stick droit", "Tourner autour"],
  ["RT / LT", "Rapprocher / Éloigner"],
];

interface TurntableProps {
  paused: boolean;
  livery: Livery;
}

const Turntable = ({ paused, livery }: TurntableProps) => {
  const table = useRef<Group>(null);

  useFrame((_, delta) => {
    if (table.current && !paused)
      table.current.rotation.y += delta * TURN_SPEED;
  });

  return (
    <group ref={table}>
      <mesh position={[0, -PLATE_HEIGHT / 2, 0]} receiveShadow>
        <cylinderGeometry args={[2.9, 2.95, PLATE_HEIGHT, 48]} />
        <meshStandardMaterial color="#3b3e43" roughness={0.7} />
      </mesh>
      {/* L'origine du modèle est le centre de la caisse et ses roues sont à l'assiette de repos. */}
      <group position={[0, carConfig.ride.height, 0]}>
        <CarModel livery={livery} />
      </group>
    </group>
  );
};

export const GarageScene = () => {
  const [padConnected, setPadConnected] = useState(false);
  const [menu, dispatch] = useGarageMenu();

  return (
    <div className="fixed inset-0 bg-[#0b0e14]">
      <Canvas
        shadows="percentage"
        camera={{ position: [-4.4, 2, -5.2], fov: 44, near: 0.1, far: 60 }}
      >
        <color attach="background" args={[NIGHT]} />
        <hemisphereLight args={["#f4f7ff", "#6f7072", 0.9]} />
        <directionalLight
          position={[4, 9, 4]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
        >
          {/* Toute la tente : un plus petit cadre couperait les ombres des objets éloignés. */}
          <orthographicCamera
            attach="shadow-camera"
            args={[-15, 15, 15, -15, 0.5, 30]}
          />
        </directionalLight>
        <directionalLight
          position={[-6, 3, -4]}
          intensity={1}
          color="#cfdcff"
        />
        <group position={[0, -PLATE_HEIGHT, 0]}>
          <GarageDecor livery={menu.livery} />
        </group>
        <Turntable paused={menu.paused} livery={menu.livery} />
        <GaragePadControls
          target={GARAGE_CAMERA.target}
          onMenuAction={dispatch}
          onConnectionChange={setPadConnected}
        />
        <OrbitControls
          target={[...GARAGE_CAMERA.target]}
          enablePan={false}
          minDistance={GARAGE_CAMERA.minDistance}
          maxDistance={GARAGE_CAMERA.maxDistance}
          minPolarAngle={GARAGE_CAMERA.minPolarAngle}
          maxPolarAngle={GARAGE_CAMERA.maxPolarAngle}
        />
      </Canvas>
      <LiveryPanel menu={menu} dispatch={dispatch} />
      <div className="absolute right-4 bottom-4 flex flex-col items-end gap-2">
        {padConnected && (
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 rounded border border-white/25 bg-black/70 px-3 py-2 text-xs text-white">
            {PAD_HELP.map(([control, role]) => (
              <div key={control} className="contents">
                <dt className="font-mono font-semibold">{control}</dt>
                <dd>{role}</dd>
              </div>
            ))}
          </dl>
        )}
        <button
          type="button"
          className={`rounded border border-white/25 bg-black/70 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-amber-400 ${menu.row === ROTATION_ROW ? MENU_FOCUS : ""}`}
          onClick={() => dispatch({ type: "row", row: ROTATION_ROW })}
        >
          {menu.paused
            ? "Reprendre la rotation"
            : "Mettre la rotation en pause"}
        </button>
      </div>
    </div>
  );
};
