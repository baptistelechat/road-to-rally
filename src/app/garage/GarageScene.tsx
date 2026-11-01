"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";
import { CarModel } from "@/render/car/CarModel";
import type { Livery } from "@/render/car/livery";
import { carConfig } from "@/sim/carConfig";
import { GaragePadControls } from "./GaragePadControls";
import { ROTATION_ROW } from "./garageMenu";
import { LiveryPanel, MENU_FOCUS } from "./LiveryPanel";
import { useGarageMenu } from "./useGarageMenu";

const TURN_SPEED = 0.25;
const PLATE_HEIGHT = 0.12;
const ORBIT_TARGET = [0, 0.6, 0] as const;

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
        <cylinderGeometry args={[3.1, 3.2, PLATE_HEIGHT, 48]} />
        <meshStandardMaterial color="#55534e" roughness={0.9} />
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
        <Turntable paused={menu.paused} livery={menu.livery} />
        <GaragePadControls
          target={ORBIT_TARGET}
          onMenuAction={dispatch}
          onConnectionChange={setPadConnected}
        />
        <OrbitControls
          target={[...ORBIT_TARGET]}
          enablePan={false}
          minDistance={3}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2 - 0.02}
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
