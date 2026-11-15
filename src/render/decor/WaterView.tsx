"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  LinearSRGBColorSpace,
  ShapeUtils,
  Vector2,
  Vector3,
} from "three";
import type { CarSource } from "@/render/carSource";
import { createDustPool } from "@/render/fx/dustPool";
import { wheelContactPoint } from "@/render/fx/wheelContact";
import type { DecorWater, Track } from "@/sim/types";
import { DECOR_PALETTE } from "../palette";

/** Hauteur de la nappe au-dessus de son niveau : sous la berge relevée de 2 cm, le décalage de polygones fait le reste */
const LIFT = 0.01;
/**
 * Décalage de profondeur constant, en unités du tampon : départage la nappe et un sol au même niveau (gué).
 * Pas de facteur de pente : en vue rasante, il ferait passer la nappe à travers un sol plus haut qu'elle.
 */
const DEPTH_OFFSET_UNITS = -4;
/** Part de lumière qui traverse la nappe : on devine le lit creusé dessous */
const OPACITY = 0.82;
/** Gerbe d'entrée pleine à cette vitesse, en m/s */
const SPLASH_FULL_SPEED = 20;
/** Sous cette vitesse, une roue qui entre dans l'eau ne fait pas de gerbe, en m/s */
const SPLASH_MIN_SPEED = 1.5;
/** Gerbes par seconde et par roue qui roule dans l'eau, à pleine vitesse et pleine profondeur */
const SPLASH_RATE = 14;
/** Profondeur où une roue qui roule projette le plus, en mètres */
const SPLASH_DEPTH = 0.3;

/** Toutes les nappes en une seule géométrie : un appel de dessin, quel que soit le nombre d'étangs. */
const waterGeometry = (water: DecorWater[]): BufferGeometry | null => {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const { outline, holes = [], y } of water) {
    if (outline.length < 3) continue;
    // La forme est triangulée dans le plan (x, z), îles comprises ; chaque triangle est remis dans le sens de la normale vers le haut.
    const contour = outline.map(({ x, z }) => new Vector2(x, z));
    const islands = holes.map((hole) =>
      hole.map(({ x, z }) => new Vector2(x, z)),
    );
    const triangles = ShapeUtils.triangulateShape(contour, islands);
    // `triangulateShape` numérote le contour puis les îles, dans cet ordre.
    const points = [outline, ...holes].flat();
    const base = positions.length / 3;
    for (const { x, z } of points) positions.push(x, y + LIFT, z);
    for (const [a, b, c] of triangles) {
      const pa = points[a];
      const pb = points[b];
      const pc = points[c];
      // Composante y de (b - a) × (c - a) : positive = face avant vers le ciel.
      const up =
        (pb.z - pa.z) * (pc.x - pa.x) - (pb.x - pa.x) * (pc.z - pa.z) > 0;
      indices.push(base + a, base + (up ? b : c), base + (up ? c : b));
    }
  }
  if (indices.length === 0) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
};

/**
 * Gerbes d'eau des roues (story 5.9) : à l'entrée dans l'eau, puis en continu tant qu'on y roule.
 * Lit l'état de la voiture et `waterAt` sans jamais rien écrire dans la simulation.
 */
const Splashes = ({
  source,
  waterAt,
}: {
  source: CarSource;
  waterAt: NonNullable<Track["waterAt"]>;
}) => {
  const [pool] = useState(createDustPool);
  const wet = useRef([false, false, false, false]);
  const accumulators = useRef([0, 0, 0, 0]);
  const lastRespawn = useRef(0);
  const contact = useMemo(() => new Vector3(), []);

  useEffect(() => () => pool.dispose(), [pool]);

  useFrame((_, dt) => {
    const state = source.getState();
    const pose = source.getPose();
    if (!state || !pose) return;
    const respawn = source.getRespawnCount();
    if (respawn !== lastRespawn.current) {
      lastRespawn.current = respawn;
      wet.current.fill(false);
      accumulators.current.fill(0);
      pool.reset();
    }
    // Ce pool n'émet que des gerbes : il vieillit seulement, sans poussière des roues.
    pool.advance(dt);
    const speed = state.speed;
    state.wheels.forEach((wheel, i) => {
      wheelContactPoint(pose, wheel, i, contact);
      const level = waterAt(contact.x, contact.z);
      const depth = level === null ? 0 : level - contact.y;
      if (level === null || depth <= 0) {
        wet.current[i] = false;
        accumulators.current[i] = 0;
        return;
      }
      const at = { x: contact.x, y: level, z: contact.z };
      if (!wet.current[i] && speed > SPLASH_MIN_SPEED)
        pool.splash(
          at,
          state.linearVelocity,
          Math.min(1, speed / SPLASH_FULL_SPEED),
        );
      wet.current[i] = true;
      const motion = Math.min(1, speed / SPLASH_FULL_SPEED);
      accumulators.current[i] +=
        SPLASH_RATE * motion * Math.min(1, depth / SPLASH_DEPTH) * dt;
      // Après un trou d'image, une seule gerbe : pas de rattrapage d'un coup.
      if (accumulators.current[i] >= 1) {
        accumulators.current[i] = 0;
        pool.splash(at, state.linearVelocity, 0.35 * motion);
      }
    });
  });

  return <primitive object={pool.mesh} />;
};

/** Surfaces d'eau à plat (stories 5.4 et 5.9), sans ombre portée ni reçue, et leurs gerbes. */
export const WaterView = ({
  water,
  source,
  waterAt,
}: {
  water: DecorWater[];
  /** La voiture et le niveau de l'eau : absents, pas de gerbe */
  source?: CarSource;
  waterAt?: Track["waterAt"];
}) => {
  const geometry = useMemo(() => waterGeometry(water), [water]);
  const color = useMemo(
    () => new Color().setRGB(...DECOR_PALETTE.water, LinearSRGBColorSpace),
    [],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <group>
      <mesh geometry={geometry}>
        {/* Reflet bon marché : surface lisse et un peu métallique, le soleil et le ciel y brillent sans rendu de miroir. */}
        <meshStandardMaterial
          color={color}
          roughness={0.08}
          metalness={0.35}
          transparent
          opacity={OPACITY}
          polygonOffset
          polygonOffsetFactor={0}
          polygonOffsetUnits={DEPTH_OFFSET_UNITS}
        />
      </mesh>
      {source && waterAt && <Splashes source={source} waterAt={waterAt} />}
    </group>
  );
};
