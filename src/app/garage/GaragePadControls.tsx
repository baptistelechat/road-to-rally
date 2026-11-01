"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Spherical, Vector3 } from "three";
import { findStandardPad } from "@/input/inputController";
import {
  type MenuAction,
  type MenuRepeat,
  pollMenuRepeat,
  readGarageInput,
} from "@/input/smoothing";

const ORBIT_SPEED = 1.8;
const ZOOM_SPEED = 1.2;
/** Avant la mise à jour d'`OrbitControls` (-1), qui applique ainsi ses limites dans la même image. */
const BEFORE_ORBIT_CONTROLS = -2;

const center = new Vector3();
const offset = new Vector3();
const spherical = new Spherical();

interface GaragePadControlsProps {
  target: readonly [number, number, number];
  onMenuAction: (action: MenuAction) => void;
  onConnectionChange: (connected: boolean) => void;
}

export const GaragePadControls = ({
  target,
  onMenuAction,
  onConnectionChange,
}: GaragePadControlsProps) => {
  const connected = useRef(false);
  const repeat = useRef<MenuRepeat>({ held: undefined, wait: 0 });

  useFrame(({ camera }, delta) => {
    const pad = findStandardPad(window);
    if (connected.current !== (pad !== null)) {
      connected.current = pad !== null;
      onConnectionChange(connected.current);
    }
    if (!pad) {
      repeat.current.held = undefined;
      return;
    }

    const input = readGarageInput(pad);
    if (!document.hasFocus()) {
      repeat.current.held = input.menu;
      return;
    }
    const action = pollMenuRepeat(repeat.current, input.menu, delta);
    if (action) onMenuAction(action);

    if (!input.orbitX && !input.orbitY && !input.zoom) return;
    center.set(...target);
    spherical.setFromVector3(offset.subVectors(camera.position, center));
    spherical.theta += input.orbitX * ORBIT_SPEED * delta;
    spherical.phi += input.orbitY * ORBIT_SPEED * delta;
    spherical.radius *= Math.exp(-input.zoom * ZOOM_SPEED * delta);
    // Un angle négatif passerait de l'autre côté du sommet : bloqué ici, comme à la souris.
    spherical.makeSafe();
    camera.position.setFromSpherical(spherical).add(center);
  }, BEFORE_ORBIT_CONTROLS);

  return null;
};
