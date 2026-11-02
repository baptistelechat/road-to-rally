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
import { SHOULDER_WIDTH } from "@/sim/track/ribbon";
import type { ChicaneBlock, ChicaneSide, Track, Vec3 } from "@/sim/types";
import {
  CHICANE_BARRIER_MODULE,
  CHICANE_CHEVRON_MODULE,
  CHICANE_GEOMETRY,
  CHICANE_STACK_MODULE,
  SCENERY_MATERIAL,
} from "./models";

const UP = new Vector3(0, 1, 0);
/** Retrait des barrières depuis les faces du bloc : les poteaux restent dans le collider. */
const BARRIER_INSET = 0.1;
/** Distance entre le panneau d'annonce et le premier bloc, en mètres */
const SIGN_AHEAD = 70;
/** Devant la face de la pile : assez d'écart pour que la profondeur les sépare encore de loin, où un panneau ne fait plus que quelques pixels. */
const CHEVRON_Z = CHICANE_STACK_DEPTH / 2 + 0.08;

/** Côté à prendre pour passer ce bloc : celui où la route reste libre. */
const passageSide = ({ side }: Pick<ChicaneBlock, "side">): ChicaneSide =>
  side === "left" ? "right" : "left";

export interface ApproachSign {
  position: Vec3;
  yaw: number;
  direction: ChicaneSide;
}

/**
 * Un panneau avant chaque chicane, du côté où il faudra passer. Décor seul, sans collider : la simulation l'ignore.
 * Les blocs vont par paires dans l'ordre des abscisses (`stageCodec` le valide) : un sur deux ouvre une chicane.
 * `bothWays` : aller-retour, la chicane se passe aussi en sens inverse, deuxième bloc d'abord.
 */
export const approachSigns = (
  blocks: ChicaneBlock[],
  {
    points,
    widths,
    indexAt,
    groundAt,
  }: Pick<Track, "points" | "widths" | "indexAt" | "groundAt">,
  bothWays: boolean,
): ApproachSign[] => {
  /** `heading` : 1 dans le sens de l'axe, -1 à contresens. */
  const sign = (
    s: number,
    heading: number,
    direction: ChicaneSide,
  ): ApproachSign => {
    const i = indexAt(s);
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dx = (b.x - a.x) * heading;
    const dz = (b.z - a.z) * heading;
    const length = Math.sqrt(dx * dx + dz * dz) || 1;
    const lateral =
      (direction === "left" ? -1 : 1) * (widths[i] / 2 + SHOULDER_WIDTH + 0.5);
    const x = points[i].x + (-dz / length) * lateral;
    const z = points[i].z + (dx / length) * lateral;
    return {
      position: { x, y: groundAt(x, z) ?? points[i].y, z },
      yaw: Math.atan2(-dx, -dz),
      direction,
    };
  };
  return blocks.flatMap((block, i, all) =>
    i % 2 !== 0
      ? []
      : [
          sign(block.s - SIGN_AHEAD, 1, passageSide(block)),
          // À contresens, le côté libre change de nom : il reste du côté où le bloc n'est pas.
          ...(bothWays
            ? [sign(all[i + 1].s + SIGN_AHEAD, -1, all[i + 1].side)]
            : []),
        ],
  );
};

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
 * Des chevrons sur les deux faces montrent le côté à prendre, et `signs` l'annonce plus tôt.
 */
export const ChicaneView = ({
  blocks,
  signs,
}: {
  blocks: ChicaneBlock[];
  signs: ApproachSign[];
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
