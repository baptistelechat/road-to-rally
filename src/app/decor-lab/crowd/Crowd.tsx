"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import { CROWD_DEPTH_MATERIAL, CROWD_MATERIAL } from "./crowdMaterial";
import {
  flagCell,
  flagMaterial,
  flagOf,
  releaseFlagMaterial,
  retainFlagMaterial,
} from "./flagAtlas";
import type { Vec3 } from "./geometry";
import { type Outfit, pickOutfit, type Wardrobe } from "./outfits";
import { buildPerson, type PoseId, type StyleId } from "./people";

export interface CrowdMember {
  pose: PoseId;
  position: Vec3;
  /** Cap en radians : 0 regarde vers +Z */
  yaw: number;
  /** Graine de la tenue et de la taille */
  seed: number;
  wardrobe?: Wardrobe;
  scale?: number;
}

const UP = new Vector3(0, 1, 0);

/** Pose chaque instance à la place, au cap et à la taille de son spectateur. */
const placeMembers = (mesh: InstancedMesh, members: CrowdMember[]): void => {
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  members.forEach((member, i) => {
    position.set(...member.position);
    rotation.setFromAxisAngle(UP, member.yaw);
    scale.setScalar(member.scale ?? 1);
    mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
};

/** Toile au bout du mât de la pose « drapeau », dans le repère du spectateur. */
const CLOTH = { width: 0.81, height: 0.54, at: [0.705, 2.45, 0.1] as Vec3 };

/** Toiles des drapeaux tenus : un plan instancié, chaque instance lit sa cellule de l'atlas. */
const FlagCloths = ({ members }: { members: CrowdMember[] }) => {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(CLOTH.width, CLOTH.height);
    plane.translate(...CLOTH.at);
    const cells = new Float32Array(members.length * 2);
    members.forEach((member, i) => {
      cells.set(flagCell(flagOf(member.seed)), i * 2);
    });
    plane.setAttribute("flagCell", new InstancedBufferAttribute(cells, 2));
    return plane;
  }, [members]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    retainFlagMaterial();
    return releaseFlagMaterial;
  }, []);
  useLayoutEffect(() => {
    if (meshRef.current) placeMembers(meshRef.current, members);
  }, [members, geometry]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, flagMaterial(), members.length]}
      castShadow
    />
  );
};

/** Géométrie d'une pose avec ses attributs d'instance : propre à ce maillage, libérée au démontage. */
const withOutfits = (
  geometry: BufferGeometry,
  outfits: Outfit[],
): BufferGeometry => {
  const colors = new Float32Array(outfits.length * 4);
  const masks = new Float32Array(outfits.length);
  outfits.forEach((outfit, i) => {
    colors.set(outfit.colors, i * 4);
    masks[i] = outfit.mask;
  });
  geometry.setAttribute("outfit", new InstancedBufferAttribute(colors, 4));
  geometry.setAttribute("partMask", new InstancedBufferAttribute(masks, 1));
  return geometry;
};

interface PoseBatchProps {
  style: StyleId;
  pose: PoseId;
  members: CrowdMember[];
}

/** Un `InstancedMesh` par pose : un seul appel de dessin, une tenue par personne. */
const PoseBatch = ({ style, pose, members }: PoseBatchProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(
    () =>
      withOutfits(
        buildPerson(style, pose),
        members.map((member) => pickOutfit(member.seed, member.wardrobe)),
      ),
    [style, pose, members],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    if (meshRef.current) placeMembers(meshRef.current, members);
  }, [members, geometry]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, CROWD_MATERIAL, members.length]}
      customDepthMaterial={CROWD_DEPTH_MATERIAL}
      castShadow
      receiveShadow
    />
  );
};

interface CrowdProps {
  style: StyleId;
  members: CrowdMember[];
}

/** Public mêlant plusieurs poses : regroupé par pose, dans l'ordre de première apparition. */
export const Crowd = ({ style, members }: CrowdProps) => {
  const batches = useMemo(() => {
    const byPose = new Map<PoseId, CrowdMember[]>();
    for (const member of members) {
      const list = byPose.get(member.pose);
      if (list) list.push(member);
      else byPose.set(member.pose, [member]);
    }
    return [...byPose.entries()];
  }, [members]);

  return (
    <>
      {batches.map(([pose, list]) => (
        <PoseBatch key={pose} style={style} pose={pose} members={list} />
      ))}
      {batches.map(
        ([pose, list]) =>
          pose === "flag" && <FlagCloths key="flags" members={list} />,
      )}
    </>
  );
};
