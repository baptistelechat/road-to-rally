"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Color } from "three";
import { Atmosphere } from "@/render/Atmosphere";
import { DECOR_PALETTE } from "@/render/palette";
import { SCENERY_MATERIAL } from "@/render/scenery/models";
import type { Layout } from "./placement";

// Couleurs linéaires, comme les couleurs par sommet du décor.
const GROUND = new Color(...DECOR_PALETTE.ground.meadow);
const STREET = new Color(...DECOR_PALETTE.ground.built);

interface BuildingsSceneProps {
  layout: Layout;
}

/** Maquettes posées sur l'herbe, une rue devant le premier rang, étiquettes au-dessus. */
export const BuildingsScene = ({ layout }: BuildingsSceneProps) => {
  const { lots, extent, streetZ } = layout;
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{
        position: [extent * 0.3, extent * 0.35, extent * 0.85],
        fov: 45,
        near: 0.5,
        far: 3000,
      }}
    >
      <Atmosphere />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color={GROUND} roughness={1} />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.02, streetZ + 3.5]}
        receiveShadow
      >
        <planeGeometry args={[extent + 40, 7]} />
        <meshStandardMaterial color={STREET} roughness={1} />
      </mesh>
      {lots.map((lot) => (
        <group key={lot.key} position={[lot.x, 0, lot.z]}>
          <mesh
            geometry={lot.geometry}
            material={SCENERY_MATERIAL}
            castShadow
            receiveShadow
          />
          <Html position={[0, lot.top + 2, 0]} center zIndexRange={[20, 0]}>
            <div className="pointer-events-none w-max max-w-56 rounded bg-black/70 px-2 py-1 text-center text-[11px] leading-tight text-neutral-100">
              <div className="font-semibold">{lot.title}</div>
              <div className="text-neutral-300">{lot.detail}</div>
            </div>
          </Html>
        </group>
      ))}
      <OrbitControls target={[0, 4, 0]} maxPolarAngle={Math.PI / 2.05} />
    </Canvas>
  );
};
