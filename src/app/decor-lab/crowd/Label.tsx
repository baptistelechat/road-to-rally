"use client";

import { Html } from "@react-three/drei";
import type { Vec3 } from "./geometry";

interface LabelProps {
  position: Vec3;
  title: string;
  detail?: string;
  /** Taille constante à l'écran : pour les repères lointains */
  fixed?: boolean;
}

/** Étiquette d'une proposition, toujours face à la caméra. */
export const Label = ({ position, title, detail, fixed }: LabelProps) => (
  <Html
    position={position}
    center
    distanceFactor={fixed ? undefined : 14}
    zIndexRange={[20, 0]}
  >
    <div className="pointer-events-none whitespace-nowrap rounded bg-neutral-950/80 px-2 py-1 text-center text-[11px] leading-tight text-neutral-100 shadow">
      <div className="font-semibold">{title}</div>
      {detail && <div className="text-neutral-400">{detail}</div>}
    </div>
  </Html>
);
