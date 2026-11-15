"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { DEFAULT_LOOK, LOOKS, type LookId, readLookParam } from "@/render/look";
import { LookPicker } from "../looks/LookPicker";
import { CHASE_FOV, LooksScene } from "../looks/LooksScene";

/** Garde l'ambiance dans l'URL : un lien rouvre le labo sur elle. */
const writeLookParam = (look: LookId): void => {
  const url = new URL(window.location.href);
  url.searchParams.set("look", look);
  window.history.replaceState(window.history.state, "", url);
};

/** Ambiances de la story 5.1 sur une scène type, vue comme en course. `?look=` choisit celle du départ. */
export const LooksSection = () => {
  const [look, setLook] = useState<LookId>(
    () => readLookParam() ?? DEFAULT_LOOK,
  );
  // Change à chaque recadrage : la scène se remonte et la caméra revient en poursuite.
  const [frame, setFrame] = useState(0);

  const choose = (id: LookId): void => {
    setLook(id);
    writeLookParam(id);
  };

  // Touches 1 à 8 : passer d'une ambiance à l'autre sans quitter la scène des yeux.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const id = LOOKS[Number(event.key) - 1];
      if (!id) return;
      setLook(id);
      writeLookParam(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
        camera={{ fov: CHASE_FOV, near: 0.1, far: 1000 }}
      >
        <LooksScene key={frame} look={look} />
      </Canvas>
      <LookPicker
        look={look}
        onChoose={choose}
        onReframe={() => setFrame((n) => n + 1)}
      />
    </div>
  );
};
