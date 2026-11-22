"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Atmosphere } from "@/render/Atmosphere";
import { Label } from "../crowd/Label";
import {
  ChicaneBlock,
  Face,
  type FaceStyle,
  type IslandStyle,
  SmallIsland,
} from "../obstacles/variants";

const FACES: { style: FaceStyle; title: string; detail: string }[] = [
  {
    style: "concrete",
    title: "A · Béton profilé",
    detail: "massif, bande rouge et blanche",
  },
  {
    style: "guardrail",
    title: "B · Glissière métallique",
    detail: "double onde sur poteaux",
  },
  {
    style: "tyres",
    title: "C · Mur de pneus cerclé",
    detail: "code des circuits",
  },
  { style: "gabion", title: "D · Gabions", detail: "cages de pierres" },
];

const ISLANDS: { style: IslandStyle; title: string; detail: string }[] = [
  { style: "dome", title: "0 · Dôme actuel", detail: "pour comparer" },
  { style: "planter", title: "1 · Jardinière béton", detail: "arbuste taillé" },
  {
    style: "paved",
    title: "2 · Îlot pavé",
    detail: "panneau giratoire et bornes",
  },
  { style: "lawn", title: "3 · Pelouse et arbre", detail: "îlot de village" },
  { style: "rocks", title: "4 · Rochers", detail: "sur lit de gravier" },
];

/** Écart entre deux propositions le long de x, en mètres */
const STEP = 18;
const ROAD_WIDTH = 7;
const ISLAND_RADIUS = 2;
const ISLAND_ROW_Z = 32;

const Asphalt = ({
  at,
  size,
}: {
  at: [number, number];
  size: [number, number];
}) => (
  <mesh
    rotation={[-Math.PI / 2, 0, 0]}
    position={[at[0], 0.01, at[1]]}
    receiveShadow
  >
    <planeGeometry args={size} />
    <meshStandardMaterial color="#3b3e44" roughness={0.95} />
  </mesh>
);

const ObstaclesScene = () => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color="#6f8a45" roughness={1} />
    </mesh>
    {/* Rangée 1 : un bloc de chicane sur une voie, et 10 m de terre-plein entre deux chaussées. */}
    {FACES.map(({ style, title, detail }, i) => {
      const x = (i - (FACES.length - 1) / 2) * STEP;
      return (
        <group key={style} position={[x, 0, 0]}>
          <Asphalt at={[0, 0]} size={[ROAD_WIDTH, 40]} />
          <group
            position={[-ROAD_WIDTH / 4, 0, -8]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <ChicaneBlock style={style} span={ROAD_WIDTH / 2 + 0.4} />
          </group>
          <group position={[0, 0, 8]} rotation={[0, Math.PI / 2, 0]}>
            <Face style={style} length={10} />
          </group>
          <Label position={[0, 4.2, -8]} title={title} detail={detail} />
          <Label position={[0, 2, 8]} title="terre-plein" />
        </group>
      );
    })}
    {/* Rangée 2 : petits îlots de rond-point, sur un anneau de chaussée. */}
    {ISLANDS.map(({ style, title, detail }, i) => {
      const x = (i - (ISLANDS.length - 1) / 2) * STEP;
      return (
        <group key={style} position={[x, 0, ISLAND_ROW_Z]}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, 0]}
            receiveShadow
          >
            <circleGeometry args={[ISLAND_RADIUS + 6, 32]} />
            <meshStandardMaterial color="#3b3e44" roughness={0.95} />
          </mesh>
          <SmallIsland style={style} radius={ISLAND_RADIUS} />
          <Label position={[0, 5, 0]} title={title} detail={detail} />
        </group>
      );
    })}
  </group>
);

/** Propositions d'obstacles fixes (blocs de chicane, terre-pleins) et de petits îlots, avant intégration. */
export const ObstaclesSection = () => (
  <div className="absolute inset-0 flex">
    <div className="relative min-w-0 flex-1">
      <Canvas
        shadows
        camera={{ position: [0, 30, 70], fov: 50, near: 0.1, far: 1000 }}
      >
        <Atmosphere />
        <ObstaclesScene />
        <OrbitControls
          makeDefault
          target={[0, 0, 14]}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />
      </Canvas>
    </div>
    <aside className="w-64 space-y-3 border-l border-neutral-700 p-4 text-sm">
      <p>
        <b>Rangée du fond</b> : habillages <b>fixes</b> pour les blocs de
        chicane et les terre-pleins, pour qu&apos;on ne les confonde plus avec
        les barrières renversables.
      </p>
      <p>
        <b>Rangée de devant</b> : petits îlots de rond-point solides (rayon 2
        m), à la place du dôme.
      </p>
      <p className="text-xs text-neutral-400">
        Clic gauche pour tourner, molette pour zoomer.
      </p>
    </aside>
  </div>
);
