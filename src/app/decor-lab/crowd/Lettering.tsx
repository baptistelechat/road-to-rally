"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, DoubleSide, SRGBColorSpace } from "three";
import type { Vec3 } from "./geometry";

interface LetteringProps {
  text: string;
  /** Largeur et hauteur du support, en mètres */
  width: number;
  height: number;
  position: Vec3;
  rotation?: Vec3;
  background: string;
  color: string;
  /** Liseré en damier sur les bords hauts et bas, façon drapeau d'arrivée */
  checker?: boolean;
}

const PIXELS_PER_METER = 128;

/** Toile imprimée : texte dessiné sur un canevas, sans police téléchargée. */
const drawTexture = (
  text: string,
  width: number,
  height: number,
  background: string,
  color: string,
  checker: boolean,
): CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * PIXELS_PER_METER);
  canvas.height = Math.round(height * PIXELS_PER_METER);
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const band = checker ? Math.round(canvas.height * 0.14) : 0;
    if (checker) {
      const cells = Math.ceil(canvas.width / (band / 2));
      for (let i = 0; i < cells; i++) {
        for (let row = 0; row < 2; row++) {
          context.fillStyle = (i + row) % 2 === 0 ? "#10161f" : "#f4f2ec";
          const x = (i * band) / 2;
          context.fillRect(x, (row * band) / 2, band / 2, band / 2);
          context.fillRect(
            x,
            canvas.height - band + (row * band) / 2,
            band / 2,
            band / 2,
          );
        }
      }
    }
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    let fontSize = (canvas.height - band * 2) * 0.62;
    const font = (px: number): string =>
      `900 ${px}px system-ui, "Segoe UI", sans-serif`;
    context.font = font(fontSize);
    // Le texte rétrécit jusqu'à tenir dans la largeur.
    while (
      context.measureText(text).width > canvas.width * 0.9 &&
      fontSize > 8
    ) {
      fontSize *= 0.92;
      context.font = font(fontSize);
    }
    context.fillText(
      text,
      canvas.width / 2,
      canvas.height / 2 + fontSize * 0.04,
    );
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

/** Plan imprimé recto verso (le verso se lit à l'envers, comme une vraie banderole). */
export const Lettering = ({
  text,
  width,
  height,
  position,
  rotation = [0, 0, 0],
  background,
  color,
  checker = false,
}: LetteringProps) => {
  const texture = useMemo(
    () => drawTexture(text, width, height, background, color, checker),
    [text, width, height, background, color, checker],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} side={DoubleSide} roughness={0.85} />
    </mesh>
  );
};
