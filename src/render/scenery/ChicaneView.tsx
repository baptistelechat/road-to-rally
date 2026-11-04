"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  type InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { CHICANE_STACK_DEPTH } from "@/geo/config";
import { isRock } from "@/geo/roundabouts";
import { type ApproachSign, passageSide } from "@/sim/track/chicaneSigns";
import type {
  ChicaneBlock,
  ChicaneSide,
  MedianBarrier,
  RoundaboutIsland,
  Track,
} from "@/sim/types";
import {
  CHICANE_BARRIER_MODULE,
  CHICANE_CHEVRON_MODULE,
  CHICANE_GEOMETRY,
  CHICANE_STACK_MODULE,
  SCENERY_GEOMETRY,
  SCENERY_MATERIAL,
} from "./models";

const UP = new Vector3(0, 1, 0);
/** Retrait des barrières depuis les faces du bloc : les poteaux restent dans le collider. */
const BARRIER_INSET = 0.1;
/** Devant la face de la pile : assez d'écart pour que la profondeur les sépare encore de loin, où un panneau ne fait plus que quelques pixels. */
const CHEVRON_Z = CHICANE_STACK_DEPTH / 2 + 0.08;

/** Constante : un tableau neuf à chaque rendu relancerait le calcul des matrices. */
const NO_SIGNS: ApproachSign[] = [];

const moduleMatrices = (
  blocks: ChicaneBlock[],
  moduleLength: number,
  faces: (block: ChicaneBlock) => number[],
  turn = 0,
): Matrix4[] => {
  const matrices: Matrix4[] = [];
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  for (const block of blocks) {
    // Modules légèrement étirés pour tomber juste sur la longueur du bloc.
    const count = Math.max(1, Math.round(block.span / moduleLength));
    const length = block.span / count;
    rotation.setFromAxisAngle(UP, block.yaw + turn);
    scale.set(length / moduleLength, 1, 1);
    for (const z of faces(block)) {
      for (let i = 0; i < count; i++) {
        position
          .set(-block.span / 2 + length * (i + 0.5), 0, z)
          .applyQuaternion(rotation);
        position.x += block.position.x;
        position.y += block.position.y;
        position.z += block.position.z;
        matrices.push(new Matrix4().compose(position, rotation, scale));
      }
    }
  }
  return matrices;
};

const signMatrices = (signs: ApproachSign[]): Matrix4[] => {
  const rotation = new Quaternion();
  const scale = new Vector3(1, 1, 1);
  return signs.map(({ position, yaw }) =>
    new Matrix4().compose(
      new Vector3(position.x, position.y, position.z),
      rotation.setFromAxisAngle(UP, yaw),
      scale,
    ),
  );
};

const Batch = ({
  geometry,
  matrices,
}: {
  geometry: BufferGeometry;
  matrices: Matrix4[];
}) => {
  const meshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);

  if (matrices.length === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, SCENERY_MATERIAL, matrices.length]}
      castShadow
    />
  );
};

/**
 * Blocs de chicane : une pile au centre, une barrière sur chaque face, visible dans les deux sens de la route.
 * Des chevrons sur les deux faces montrent le côté à prendre. En jeu, les panneaux d'annonce sont des objets légers
 * (`chicaneSignItems`, dessinés par `LightPropsView`) : `signs` ne sert qu'aux aperçus figés.
 */
export const ChicaneView = ({
  blocks,
  signs = NO_SIGNS,
}: {
  blocks: ChicaneBlock[];
  signs?: ApproachSign[];
}) => {
  const batches = useMemo(() => {
    // Sur l'autre face, retournée d'un demi-tour, le chevron pointe vers le même côté libre.
    const chevrons = (side: ChicaneSide): Matrix4[] => [
      ...moduleMatrices(
        blocks.filter((block) => passageSide(block) === side),
        CHICANE_CHEVRON_MODULE,
        () => [CHEVRON_Z],
      ),
      ...moduleMatrices(
        blocks.filter((block) => block.side === side),
        CHICANE_CHEVRON_MODULE,
        () => [CHEVRON_Z],
        Math.PI,
      ),
    ];
    // Le dessin suit l'écart du pilote, venu de sa voie de droite : il se déporte d'abord à l'opposé du côté libre du premier bloc.
    const signsTo = (firstBend: ChicaneSide): Matrix4[] =>
      signMatrices(signs.filter(({ direction }) => direction !== firstBend));
    return {
      barriers: moduleMatrices(blocks, CHICANE_BARRIER_MODULE, (block) => {
        const z = block.depth / 2 - BARRIER_INSET;
        return [-z, z];
      }),
      stacks: moduleMatrices(blocks, CHICANE_STACK_MODULE, () => [0]),
      chevronLeft: chevrons("left"),
      chevronRight: chevrons("right"),
      signLeft: signsTo("left"),
      signRight: signsTo("right"),
    };
  }, [blocks, signs]);

  if (blocks.length === 0) return null;
  return (
    <group>
      <Batch
        geometry={CHICANE_GEOMETRY.chicaneBarrier}
        matrices={batches.barriers}
      />
      <Batch geometry={CHICANE_GEOMETRY.hayStack} matrices={batches.stacks} />
      <Batch
        geometry={CHICANE_GEOMETRY.chevronLeft}
        matrices={batches.chevronLeft}
      />
      <Batch
        geometry={CHICANE_GEOMETRY.chevronRight}
        matrices={batches.chevronRight}
      />
      <Batch geometry={CHICANE_GEOMETRY.signLeft} matrices={batches.signLeft} />
      <Batch
        geometry={CHICANE_GEOMETRY.signRight}
        matrices={batches.signRight}
      />
    </group>
  );
};

/** Barrière en cercle autour de chaque îlot de rond-point, en modules de chicane tangents à l'anneau. */
export const IslandBarriers = ({
  islands,
  groundAt,
}: {
  islands: RoundaboutIsland[];
  groundAt: Track["groundAt"];
}) => {
  const matrices = useMemo(() => {
    const result: Matrix4[] = [];
    const rotation = new Quaternion();
    for (const { position, radius } of islands) {
      if (isRock(radius)) continue;
      const ring = radius - BARRIER_INSET;
      const count = Math.max(
        6,
        Math.round((2 * Math.PI * ring) / CHICANE_BARRIER_MODULE),
      );
      // Corde entre deux modules : ils se touchent sans laisser de trou.
      const scale = new Vector3(
        (2 * ring * Math.sin(Math.PI / count)) / CHICANE_BARRIER_MODULE,
        1,
        1,
      );
      for (let i = 0; i < count; i++) {
        const angle = ((i + 0.5) * 2 * Math.PI) / count;
        const x =
          position.x + Math.cos(angle) * ring * Math.cos(Math.PI / count);
        const z =
          position.z + Math.sin(angle) * ring * Math.cos(Math.PI / count);
        // L'axe X du module suit la tangente (-sin, cos) de l'anneau.
        rotation.setFromAxisAngle(UP, -angle - Math.PI / 2);
        result.push(
          new Matrix4().compose(
            // Chaque module sur le sol : un rond-point en pente ne laisse ni barrière en l'air ni barrière enterrée.
            new Vector3(x, groundAt(x, z) ?? position.y, z),
            rotation,
            scale,
          ),
        );
      }
    }
    return result;
  }, [islands, groundAt]);
  // Un giratoire trop petit pour une barrière : un rocher à la taille de son collider.
  const rocks = useMemo(
    () =>
      islands
        .filter(({ radius }) => isRock(radius))
        .map(({ position, radius }) =>
          new Matrix4().compose(
            new Vector3(
              position.x,
              groundAt(position.x, position.z) ?? position.y,
              position.z,
            ),
            new Quaternion(),
            new Vector3(radius, radius, radius),
          ),
        ),
    [islands, groundAt],
  );
  return (
    <>
      <Batch geometry={CHICANE_GEOMETRY.chicaneBarrier} matrices={matrices} />
      <Batch geometry={SCENERY_GEOMETRY.rock} matrices={rocks} />
    </>
  );
};

/** Glissière des terre-pleins : des modules de chicane bout à bout le long de la médiane, chacun posé sur le sol. */
export const MedianBarriers = ({
  medians,
  groundAt,
}: {
  medians: MedianBarrier[];
  groundAt: Track["groundAt"];
}) => {
  const matrices = useMemo(() => {
    const result: Matrix4[] = [];
    const rotation = new Quaternion();
    for (const { points } of medians)
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = Math.hypot(dx, dz);
        const count = Math.max(1, Math.round(length / CHICANE_BARRIER_MODULE));
        // L'axe X du module suit le segment, légèrement étiré pour tomber juste.
        rotation.setFromAxisAngle(UP, Math.atan2(-dz, dx));
        const scale = new Vector3(
          length / count / CHICANE_BARRIER_MODULE,
          1,
          1,
        );
        for (let k = 0; k < count; k++) {
          const t = (k + 0.5) / count;
          const x = a.x + dx * t;
          const z = a.z + dz * t;
          result.push(
            new Matrix4().compose(
              new Vector3(x, groundAt(x, z) ?? a.y + (b.y - a.y) * t, z),
              rotation,
              scale,
            ),
          );
        }
      }
    return result;
  }, [medians, groundAt]);
  return (
    <Batch geometry={CHICANE_GEOMETRY.chicaneBarrier} matrices={matrices} />
  );
};
