"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Spherical, Vector3 } from "three";
import { findStandardPad } from "@/input/inputController";
import { readGarageInput } from "@/input/smoothing";

const ORBIT_SPEED = 1.8;
const ZOOM_SPEED = 1.2;
/** Avant la mise à jour d'`OrbitControls` (-1), qui applique ainsi ses limites dans la même image. */
const BEFORE_ORBIT_CONTROLS = -2;

const center = new Vector3();
const offset = new Vector3();
const spherical = new Spherical();

interface GaragePadControlsProps {
  target: readonly [number, number, number];
  onTogglePause: () => void;
  onConnectionChange: (connected: boolean) => void;
}

export const GaragePadControls = ({
  target,
  onTogglePause,
  onConnectionChange,
}: GaragePadControlsProps) => {
  const connected = useRef(false);
  // Null tant qu'aucun relevé : le bouton pressé pour réveiller la manette ne déclenche rien.
  const pauseHeld = useRef<boolean | null>(null);

  useFrame(({ camera }, delta) => {
    const pad = findStandardPad(window);
    if (connected.current !== (pad !== null)) {
      connected.current = pad !== null;
      onConnectionChange(connected.current);
    }
    if (!pad) {
      pauseHeld.current = null;
      return;
    }

    const input = readGarageInput(pad);
    if (!document.hasFocus()) {
      pauseHeld.current = input.pause;
      return;
    }
    if (input.pause && pauseHeld.current === false) onTogglePause();
    pauseHeld.current = input.pause;

    if (!input.orbitX && !input.orbitY && !input.zoom) return;
    center.set(...target);
    spherical.setFromVector3(offset.subVectors(camera.position, center));
    spherical.theta += input.orbitX * ORBIT_SPEED * delta;
    spherical.phi += input.orbitY * ORBIT_SPEED * delta;
    spherical.radius *= Math.exp(-input.zoom * ZOOM_SPEED * delta);
    camera.position.setFromSpherical(spherical).add(center);
  }, BEFORE_ORBIT_CONTROLS);

  return null;
};
