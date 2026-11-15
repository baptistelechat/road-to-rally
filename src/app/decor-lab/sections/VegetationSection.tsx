"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { Color } from "three";
import { Atmosphere } from "@/render/Atmosphere";
import type { CarSource } from "@/render/carSource";
import { DECOR_PALETTE } from "@/render/palette";
import type { Vec3Tuple } from "../vegetation/geometry";
import { HedgeZone } from "../vegetation/HedgeZone";
import { Recommendations } from "../vegetation/Recommendations";
import { TreeZone } from "../vegetation/TreeZone";
import { useVegetationAssets } from "../vegetation/useVegetationAssets";
import { VineZone } from "../vegetation/VineZone";

type ViewId = "trees" | "hedges" | "vines" | "overview";

const VIEWS: {
  id: ViewId;
  label: string;
  position: Vec3Tuple;
  target: Vec3Tuple;
}[] = [
  { id: "trees", label: "Arbres", position: [0, 20, 40], target: [0, 4, -24] },
  { id: "hedges", label: "Haies", position: [-4, 14, 102], target: [0, 1, 64] },
  { id: "vines", label: "Vignes", position: [0, 22, 160], target: [0, 0, 120] },
  {
    id: "overview",
    label: "Vue d'ensemble",
    position: [90, 110, 150],
    target: [0, 0, 40],
  },
];

/** Une fausse voiture immobile : la zone d'ombre d'`Atmosphere` se centre sur la vue choisie. */
const fixedSource = ([x, y, z]: Vec3Tuple): CarSource => {
  const pose = { position: { x, y, z }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  return {
    getState: () => null,
    getPose: () => pose,
    getRespawnCount: () => 0,
  };
};

/** Propositions de végétation low-poly (story 5.3) : arbres, buissons de haie et rangs de vigne. */
export const VegetationSection = () => {
  const [viewId, setViewId] = useState<ViewId>("trees");
  const [showNotes, setShowNotes] = useState(true);
  const view = VIEWS.find(({ id }) => id === viewId) ?? VIEWS[0];
  const assets = useVegetationAssets();
  const source = useMemo(() => fixedSource(view.target), [view.target]);
  const grass = useMemo(
    () => new Color().setRGB(...DECOR_PALETTE.ground.meadow),
    [],
  );
  // Première rangée : les deux arbres du jeu puis quatre feuillus ; seconde : le reste
  const { current, trees } = assets;
  const rows = useMemo(
    () => [[...current, ...trees.slice(0, 4)], trees.slice(4)],
    [current, trees],
  );

  return (
    <div className="absolute inset-0">
      {/* Une clé par vue : caméra et cible repartent de zéro, comme l'aperçu des chicanes */}
      <Canvas
        key={view.id}
        shadows
        dpr={[1, 2]}
        camera={{ position: view.position, fov: 50, near: 0.3, far: 1500 }}
      >
        <Atmosphere follow={source} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[500, 500]} />
          <meshStandardMaterial color={grass} roughness={1} />
        </mesh>
        <TreeZone rows={rows} material={assets.material} />
        <HedgeZone
          bushes={assets.bushes}
          currentTree={assets.current[0].near}
          material={assets.material}
        />
        <VineZone
          vines={assets.vines}
          endPost={assets.endPost}
          material={assets.material}
        />
        <OrbitControls target={view.target} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <nav
        aria-label="Vues de la végétation"
        className="absolute top-3 left-3 z-30 flex gap-2 rounded bg-black/70 p-2 text-xs text-neutral-100"
      >
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === viewId}
            onClick={() => setViewId(id)}
            className="rounded px-2 py-1 hover:bg-neutral-700 aria-pressed:bg-neutral-100 aria-pressed:text-neutral-900"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={showNotes}
          onClick={() => setShowNotes((shown) => !shown)}
          className="rounded px-2 py-1 hover:bg-neutral-700"
        >
          {showNotes ? "Masquer les notes" : "Afficher les notes"}
        </button>
      </nav>
      {showNotes && (
        <Recommendations
          trees={assets.trees}
          bushes={assets.bushes}
          vines={assets.vines}
        />
      )}
    </div>
  );
};
