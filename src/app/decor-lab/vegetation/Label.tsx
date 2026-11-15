"use client";

import { Html } from "@react-three/drei";
import type { Vec3Tuple } from "./geometry";

interface LabelProps {
  position: Vec3Tuple;
  title: string;
  lines: string[];
}

/** Étiquette HTML ancrée dans la scène : nom du modèle et triangles. */
export const Label = ({ position, title, lines }: LabelProps) => (
  <Html position={position} center zIndexRange={[20, 0]}>
    <div className="pointer-events-none whitespace-nowrap rounded bg-black/70 px-2 py-1 text-[11px] leading-tight text-neutral-100">
      <p className="font-semibold">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-neutral-300">
          {line}
        </p>
      ))}
    </div>
  </Html>
);
