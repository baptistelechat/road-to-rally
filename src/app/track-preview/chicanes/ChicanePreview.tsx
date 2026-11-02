"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  chicaneBlocks,
  type ChicaneBlock,
  type ChicaneSide,
} from "@/geo/chicanes";
import { CHICANE_GAP } from "@/geo/config";
import { RIG_TUNING } from "@/render/camera/cameraRig";
import { Atmosphere } from "@/render/Atmosphere";
import { approachSigns, ChicaneView } from "@/render/scenery/ChicaneView";
import { CHICANE_GEOMETRY, SCENERY_MATERIAL } from "@/render/scenery/models";
import { carConfig } from "@/sim/carConfig";
import type { Vec3 } from "@/sim/types";

const AXIS_LENGTH = 200;
const CHICANE_S = 100;
/** Largeurs montrées : le minimum accepté, `road` et le maximum. La route du milieu sert aux vues caméra. */
const STRIPS: { x: number; width: number; side: ChicaneSide }[] = [
  // Premier bloc à droite : le panneau d'annonce s'y lit en miroir.
  { x: -30, width: 5, side: "right" },
  { x: 0, width: 6.5, side: "left" },
  { x: 30, width: 9, side: "left" },
];
/** Distance entre la caméra et le premier bloc dans les vues au volant, en mètres */
const APPROACH = 30;
const FIRST_BLOCK_Z = -(CHICANE_S - CHICANE_GAP / 2);
const CHASE_EYE = carConfig.ride.height + RIG_TUNING.chaseHeight;
const HOOD_EYE = carConfig.ride.height + RIG_TUNING.hoodOffset.y;

/** Distance de la vue d'annonce : le panneau rond est à 70 m du premier bloc, en mètres */
const SIGN_APPROACH = 90;

type ViewId = "overview" | "sign" | "return" | "chase" | "hood";

const VIEWS: {
  id: ViewId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}[] = [
  {
    id: "overview",
    label: "Vue d'ensemble",
    position: [0, 45, -35],
    target: [8, 0, -100],
    fov: 50,
  },
  {
    id: "sign",
    label: "Panneau d'annonce",
    position: [0, CHASE_EYE, FIRST_BLOCK_Z + SIGN_APPROACH],
    target: [0, RIG_TUNING.lookHeight, FIRST_BLOCK_Z],
    fov: RIG_TUNING.chaseFov,
  },
  {
    id: "return",
    label: "Sens retour",
    position: [0, CHASE_EYE, -CHICANE_S - CHICANE_GAP / 2 - SIGN_APPROACH],
    target: [0, RIG_TUNING.lookHeight, -CHICANE_S],
    fov: RIG_TUNING.chaseFov,
  },
  {
    id: "chase",
    label: "Caméra poursuite",
    position: [0, CHASE_EYE, FIRST_BLOCK_Z + APPROACH],
    target: [0, RIG_TUNING.lookHeight, FIRST_BLOCK_Z],
    fov: RIG_TUNING.chaseFov,
  },
  {
    id: "hood",
    label: "Vue capot",
    position: [0, HOOD_EYE, FIRST_BLOCK_Z + APPROACH],
    target: [0, HOOD_EYE, FIRST_BLOCK_Z],
    fov: RIG_TUNING.hoodFov,
  },
];

const stripAxis = (x: number): Vec3[] =>
  Array.from({ length: AXIS_LENGTH / 2 + 1 }, (_, i) => ({
    x,
    y: 0,
    z: -i * 2,
  }));

const Scene = () => {
  const { blocks, signs } = useMemo(() => {
    const strips = STRIPS.map(({ x, width, side }) => {
      const points = stripAxis(x);
      const pair: ChicaneBlock[] =
        chicaneBlocks({ s: CHICANE_S, side }, width, points) ?? [];
      return {
        pair,
        signs: approachSigns(
          pair,
          {
            points,
            widths: points.map(() => width),
            indexAt: (s) => Math.round(s / 2),
            groundAt: () => 0,
          },
          true,
        ),
      };
    });
    return {
      blocks: strips.flatMap(({ pair }) => pair),
      signs: strips.flatMap((strip) => strip.signs),
    };
  }, []);
  const { bodyHalfExtents, ride } = carConfig;

  return (
    <>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[10, -0.05, -100]}
        receiveShadow
      >
        <planeGeometry args={[200, 300]} />
        <meshStandardMaterial color="#5d7a3a" />
      </mesh>
      {STRIPS.map(({ x, width }) => (
        <mesh
          key={x}
          rotation-x={-Math.PI / 2}
          position={[x, 0, -AXIS_LENGTH / 2]}
          receiveShadow
        >
          <planeGeometry args={[width, AXIS_LENGTH]} />
          <meshStandardMaterial color="#3b3b3e" />
        </mesh>
      ))}
      <ChicaneView blocks={blocks} signs={signs} />
      {/* Gabarit de la voiture, pour juger le passage. */}
      <mesh position={[1.625, ride.height, FIRST_BLOCK_Z + 6]} castShadow>
        <boxGeometry
          args={[
            bodyHalfExtents.x * 2,
            bodyHalfExtents.y * 2,
            bodyHalfExtents.z * 2,
          ]}
        />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
      {/* Modèles seuls, sur l'herbe. */}
      <mesh
        geometry={CHICANE_GEOMETRY.chicaneBarrier}
        material={SCENERY_MATERIAL}
        position={[56, 0, -100]}
        castShadow
      />
      <mesh
        geometry={CHICANE_GEOMETRY.hayStack}
        material={SCENERY_MATERIAL}
        position={[56, 0, -94]}
        castShadow
      />
    </>
  );
};

/** Validation des modèles de chicane : route de 5, 6,5 et 9 m, et vues depuis les deux caméras de course. */
export const ChicanePreview = () => {
  const [viewId, setViewId] = useState<ViewId>("overview");
  const view = VIEWS.find(({ id }) => id === viewId) ?? VIEWS[0];

  return (
    <div className="fixed inset-0 bg-neutral-900">
      <Canvas
        key={view.id}
        shadows
        dpr={[1, 2]}
        camera={{
          position: view.position,
          fov: view.fov,
          near: 0.1,
          far: 2000,
        }}
      >
        <Atmosphere fog={false} />
        <Scene />
        <OrbitControls target={view.target} maxPolarAngle={Math.PI / 2.02} />
      </Canvas>
      <nav
        aria-label="Vues"
        className="fixed top-4 right-4 flex gap-3 rounded bg-black/60 p-3 text-xs text-neutral-100"
      >
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === viewId}
            onClick={() => setViewId(id)}
            className="font-semibold underline-offset-2 hover:underline aria-pressed:text-amber-400"
          >
            {label}
          </button>
        ))}
        <Link
          href="/track-preview"
          className="font-semibold underline-offset-2 hover:underline"
        >
          Retour aux pistes
        </Link>
      </nav>
    </div>
  );
};
