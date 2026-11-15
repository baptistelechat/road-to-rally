"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { Atmosphere } from "@/render/Atmosphere";
import { Panel } from "../crowd/Panel";
import type { StyleId } from "../crowd/people";
import { CrowdScene } from "../crowd/Scene";

/** Propositions de public et d'habillage du bord de route (story 5.5), avant intégration. */
export const CrowdSection = () => {
  const [groupStyle, setGroupStyle] = useState<StyleId>("figurine");

  return (
    <div className="absolute inset-0 flex">
      <div className="relative min-w-0 flex-1">
        <Canvas
          shadows
          camera={{ position: [-6, 16, 30], fov: 50, near: 0.1, far: 1000 }}
        >
          <Atmosphere />
          <CrowdScene groupStyle={groupStyle} />
          <OrbitControls
            makeDefault
            target={[4, 1, -2]}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />
        </Canvas>
      </div>
      <Panel groupStyle={groupStyle} onStyle={setGroupStyle} />
    </div>
  );
};
