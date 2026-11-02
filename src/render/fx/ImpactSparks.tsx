"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { Vector3 } from "three";
import type { CarSource } from "@/render/carSource";
import { carConfig } from "@/sim/carConfig";
import type { DustPool } from "./dustPool";
import { createImpactDetector, impactContact } from "./impactSpark";
import { wheelContactPoint } from "./wheelContact";

/** Gerbe d'étincelles au point estimé du choc. Ne dessine rien : les particules vivent dans `dust`. */
export const ImpactSparks = ({
  source,
  dust,
}: {
  source: CarSource;
  dust: DustPool;
}) => {
  const [detector] = useState(createImpactDetector);
  const [at] = useState(() => new Vector3());
  const [away] = useState(() => new Vector3());
  const [ground] = useState(() => new Vector3());
  const lastVelocity = useRef({ x: 0, y: 0, z: 0 });

  useFrame((_, dt) => {
    const state = source.getState();
    const pose = source.getPose();
    if (!state || !pose) return;
    const velocity = state.linearVelocity;
    const previous = lastVelocity.current;
    const strength = detector.update(state.impact, dt);
    if (strength > 0) {
      impactContact(
        pose,
        {
          x: velocity.x - previous.x,
          y: velocity.y - previous.y,
          z: velocity.z - previous.z,
        },
        carConfig.bodyHalfExtents,
        at,
        away,
      );
      // ponytail: sol estimé sous la première roue, suffisant pour une gerbe d'une demi-seconde.
      const wheel = state.wheels[0];
      const floor = wheel ? wheelContactPoint(pose, wheel, 0, ground).y : at.y;
      dust.impactSparks(at, velocity, away, strength, at.y - floor);
    }
    previous.x = velocity.x;
    previous.y = velocity.y;
    previous.z = velocity.z;
  });

  return null;
};
