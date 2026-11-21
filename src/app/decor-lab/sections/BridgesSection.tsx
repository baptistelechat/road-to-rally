"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { Atmosphere } from "@/render/Atmosphere";
import { DECOR_PALETTE } from "@/render/palette";
import {
  BRIDGE_STYLES,
  bridgeGeometry,
} from "@/render/decor/bridgeGeometry";
import { bridgeStyleFor } from "@/geo/bridges";
import type { BridgeStyle } from "@/sim/types";
import { Label } from "../crowd/Label";

const STYLE_LABEL: Record<BridgeStyle, { title: string; detail: string }> = {
  stone: {
    title: "A · Pierre à arches",
    detail: "pont de village, parapet maçonné",
  },
  concrete: {
    title: "B · Béton à piles",
    detail: "départementale, lisses métalliques",
  },
  steel: {
    title: "C · Poutres en treillis",
    detail: "ouvrage ancien, métal peint",
  },
  viaduct: { title: "D · Viaduc", detail: "fûts ronds, tablier épais" },
};

const HEIGHTS = [3, 8, 16] as const;
const LENGTHS = [24, 66, 124] as const;
/** Une vallée par style, côte à côte le long de z */
const LANE_GAP = 60;
const HALF_WIDTH = 4.5;
const ROAD_HALF = 3.5;

/** Vallée en travers de la route (le long de x) : plat au-delà des culées, rivière au fond. */
const valley =
  (depth: number, length: number) =>
  (x: number): number => {
    const half = length / 2;
    const t = Math.min(
      1,
      Math.max(0, (Math.abs(x) - 5) / Math.max(1, half - 5)),
    );
    const smooth = t * t * (3 - 2 * t);
    return -depth * (1 - smooth);
  };

const terrainGeometry = (
  groundAt: (x: number) => number,
  extentZ: number,
): BufferGeometry => {
  const size = 6;
  // Large : en tournant autour, on ne voit jamais sous le bord du terrain.
  const half = 300;
  const positions: number[] = [];
  const colors: number[] = [];
  const color = (y: number): number[] => {
    const [r, g, b] = DECOR_PALETTE.ground.meadow;
    const f = 1 + Math.min(0, y) * 0.02;
    return [r * f, g * f, b * f];
  };
  for (let x = -half; x < half; x += size)
    for (let z = -extentZ; z < extentZ; z += size) {
      const quad = [
        [x, z],
        [x + size, z],
        [x + size, z + size],
        [x, z + size],
      ].map(([px, pz]) => [px, groundAt(px), pz]);
      for (const k of [0, 2, 1, 0, 3, 2]) {
        positions.push(...quad[k]);
        colors.push(...color(quad[k][1]));
      }
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(colors), 3),
  );
  geometry.computeVertexNormals();
  return geometry;
};

interface SceneProps {
  depth: number;
  length: number;
}

const BridgesScene = ({ depth, length }: SceneProps) => {
  const groundAt = useMemo(() => valley(depth, length), [depth, length]);
  const extentZ = (BRIDGE_STYLES.length * LANE_GAP) / 2 + 220;
  const terrain = useMemo(
    () => terrainGeometry(groundAt, extentZ),
    [groundAt, extentZ],
  );
  const lanes = useMemo(
    () =>
      BRIDGE_STYLES.map((style, i) => {
        const z = (i - (BRIDGE_STYLES.length - 1) / 2) * LANE_GAP;
        const points = [];
        for (let x = -length / 2; x <= length / 2 + 0.01; x += 2)
          points.push({ x, y: 0, z });
        return {
          style,
          z,
          geometry: bridgeGeometry(
            { points, halfWidth: HALF_WIDTH, roadHalfWidth: ROAD_HALF, groundAt: (px) => groundAt(px) },
            style,
          ),
        };
      }),
    [groundAt, length],
  );

  return (
    <group>
      <mesh geometry={terrain} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -depth + 0.5, 0]}>
        <planeGeometry args={[11, extentZ * 2]} />
        <meshStandardMaterial
          color="#38616f"
          roughness={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>
      {lanes.map(({ style, z, geometry }) => (
        <group key={style}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, z]}
            receiveShadow
          >
            <planeGeometry args={[600, ROAD_HALF * 2]} />
            <meshStandardMaterial color="#3b3e44" roughness={0.95} />
          </mesh>
          {geometry && (
            <mesh geometry={geometry} castShadow receiveShadow>
              <meshStandardMaterial vertexColors flatShading roughness={0.9} />
            </mesh>
          )}
          <Label
            // Hauteurs décalées : vues de biais, les étiquettes ne se recouvrent pas.
            position={[0, 6 + BRIDGE_STYLES.indexOf(style) * 4, z]}
            fixed
            title={STYLE_LABEL[style].title}
            detail={STYLE_LABEL[style].detail}
          />
        </group>
      ))}
    </group>
  );
};

const Choice = <T extends number>({
  label,
  values,
  value,
  onChange,
  unit,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  unit: string;
}) => (
  <div className="space-y-1">
    <div className="text-xs text-neutral-400">{label}</div>
    <div className="flex gap-1">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`rounded px-2 py-1 text-xs ${v === value ? "bg-neutral-100 text-neutral-900" : "bg-neutral-800 hover:bg-neutral-700"}`}
        >
          {v} {unit}
        </button>
      ))}
    </div>
  </div>
);

/** Propositions de ponts (suite de la story 5.9), avant intégration : quatre styles sur la même vallée. */
export const BridgesSection = () => {
  const [depth, setDepth] = useState<(typeof HEIGHTS)[number]>(8);
  const [length, setLength] = useState<(typeof LENGTHS)[number]>(66);
  const [minorRoad, setMinorRoad] = useState(true);
  const mixed = bridgeStyleFor({
    length,
    height: depth,
    overWater: true,
    minorRoad,
    urban: false,
  });

  return (
    <div className="absolute inset-0 flex">
      <div className="relative min-w-0 flex-1">
        <Canvas
          shadows
          camera={{ position: [-60, 26, 170], fov: 50, near: 0.1, far: 2000 }}
        >
          <Atmosphere />
          <BridgesScene depth={depth} length={length} />
          <OrbitControls
            makeDefault
            target={[0, -2, 0]}
            maxPolarAngle={Math.PI / 2 - 0.02}
          />
        </Canvas>
      </div>
      <aside className="w-64 space-y-4 border-l border-neutral-700 p-4 text-sm">
        <Choice
          label="Hauteur de la route au-dessus de l'eau"
          values={HEIGHTS}
          value={depth}
          onChange={setDepth}
          unit="m"
        />
        <Choice
          label="Longueur de l'ouvrage"
          values={LENGTHS}
          value={length}
          onChange={setLength}
          unit="m"
        />
        <div className="space-y-1">
          <div className="text-xs text-neutral-400">Route</div>
          <div className="flex gap-1">
            {[
              { value: true, label: "Petite" },
              { value: false, label: "Grande" },
            ].map(({ value, label }) => (
              <button
                key={label}
                type="button"
                aria-pressed={minorRoad === value}
                onClick={() => setMinorRoad(value)}
                className={`rounded px-2 py-1 text-xs ${minorRoad === value ? "bg-neutral-100 text-neutral-900" : "bg-neutral-800 hover:bg-neutral-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-neutral-400">
          Clisson : 66 m à 3 m sur la Sèvre, puis 124 m à 14 m (viaduc).
        </p>
        <div className="rounded bg-neutral-800 p-2 text-xs">
          <div className="text-neutral-400">E · Mixte selon la taille</div>
          <div className="font-semibold">{STYLE_LABEL[mixed].title}</div>
          <div className="mt-1 text-neutral-400">
            Dans l&apos;ordre : pierre en agglomération (hors grande route) ; viaduc dès 12 m de haut ; pierre jusqu&apos;à 40 m ;
            treillis sur l&apos;eau d&apos;une petite route jusqu&apos;à 100 m ; béton
            sinon.
          </div>
        </div>
      </aside>
    </div>
  );
};
