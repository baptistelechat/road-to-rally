import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
  type BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import type { CarSource } from "@/render/carSource";
import {
  CROWD_POSE_POOL,
  crowdPoseOf,
  crowdSeedAt,
} from "@/sim/track/crowdPose";
import type { SceneryItem } from "@/sim/types";
import {
  CROWD_DEPTH_MATERIAL,
  CROWD_MATERIAL,
  packOutfit,
} from "./crowdMaterial";
import {
  flagCell,
  flagMaterial,
  flagOf,
  releaseFlagMaterial,
  retainFlagMaterial,
} from "./flagAtlas";
import { pickOutfit } from "./outfits";
import { buildPerson, type PoseId, type StyleId } from "./people";

/** En deçà, figurine (B) ; jusqu'à `CROWD_FAR`, facetté (A) ; au-delà, pictogramme (C). Distances à la voiture, en mètres. */
export const CROWD_NEAR = 120;
export const CROWD_FAR = 300;
/** Répartition refaite seulement après ce déplacement de la voiture */
const RESAMPLE_DISTANCE = 4;

/** Niveaux du plus proche au plus lointain */
const LEVELS: readonly StyleId[] = ["figurine", "facet", "picto"];
const NEAR = 0;
const MID = 1;
const FAR = 2;

/**
 * Poses dans l'ordre des lots ; la pose de chacun vient de `crowdPoseOf` (module pur partagé avec le placement).
 * Le commissaire n'est jamais tiré : il vient des items `marshal` de l'habillage rallye.
 */
const POSE_SET: readonly PoseId[] = [
  ...new Set<PoseId>([...CROWD_POSE_POOL, "marshal"]),
];
/** Toile au bout du mât de la pose « drapeau », dans le repère du spectateur (voir `FlagCloths` du labo) */
const CLOTH = { width: 0.81, height: 0.54, x: 0.705, y: 2.45, z: 0.1 };
/** De très loin la pose ne se lit plus : un seul modèle, un seul appel de dessin. */
const FAR_POSE: PoseId = "cheer";

// ponytail: géométries partagées toute la vie de l'application, comme `SCENERY_GEOMETRY` ; construites à la demande.
const geometries = new Map<string, BufferGeometry>();
const personGeometry = (style: StyleId, pose: PoseId): BufferGeometry => {
  const key = `${style}-${pose}`;
  const known = geometries.get(key);
  if (known) return known;
  const geometry = buildPerson(style, pose);
  geometries.set(key, geometry);
  return geometry;
};

/** Toiles des drapeaux tenus, recopiées avec le lot de la pose « drapeau » : chaque instance lit sa cellule de l'atlas. */
interface Cloth {
  mesh: InstancedMesh;
  matrices: Float32Array;
  cells: Float32Array;
}

interface Lot {
  mesh: InstancedMesh;
  matrices: Float32Array;
  outfits: Float32Array;
  count: number;
  cloth: Cloth | null;
}

export interface CrowdChunk {
  /** À poser directement dans le groupe de la tranche : `useChunkCulling` y règle l'ombre des lots proches. */
  meshes: InstancedMesh[];
  /** Répartit le public selon la distance à (x, z) ; ne réécrit rien si personne ne change de niveau. */
  update: (x: number, z: number) => void;
  dispose: () => void;
}

const UP = new Vector3(0, 1, 0);

/**
 * Public d'une tranche : un `InstancedMesh` par pose en B et en A, un seul en C. Matrices et tenues calculées
 * une fois ; une mise à jour ne fait que les recopier dans les lots, sans allouer. Au départ, tout en A.
 */
export const createCrowdChunk = (items: SceneryItem[]): CrowdChunk => {
  const n = items.length;
  const xs = new Float32Array(n);
  const zs = new Float32Array(n);
  const matrices = new Float32Array(n * 16);
  const outfits = new Float32Array(n * 3);
  const cells = new Float32Array(n * 2);
  const poses = new Uint8Array(n);
  const perPose = new Array<number>(POSE_SET.length).fill(0);
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  items.forEach((item, i) => {
    const { x, y, z } = item.position;
    xs[i] = x;
    zs[i] = z;
    position.set(x, y, z);
    rotation.setFromAxisAngle(UP, item.yaw);
    scale.setScalar(item.scale);
    matrix.compose(position, rotation, scale).toArray(matrices, i * 16);
    const seed = crowdSeedAt(x, z);
    const marshal = item.kind === "marshal";
    poses[i] = POSE_SET.indexOf(crowdPoseOf(item));
    perPose[poses[i]]++;
    packOutfit(
      pickOutfit(seed, marshal ? "marshal" : undefined),
      outfits,
      i * 3,
    );
    cells.set(flagCell(flagOf(seed)), i * 2);
  });

  const clothGeometries: PlaneGeometry[] = [];
  const createCloth = (level: number, capacity: number): Cloth => {
    const plane = new PlaneGeometry(CLOTH.width, CLOTH.height);
    plane.translate(CLOTH.x, CLOTH.y, CLOTH.z);
    const lotCells = new Float32Array(capacity * 2);
    plane.setAttribute("flagCell", new InstancedBufferAttribute(lotCells, 2));
    clothGeometries.push(plane);
    const mesh = new InstancedMesh(plane, flagMaterial(), capacity);
    mesh.userData.shadow = level === NEAR;
    return {
      mesh,
      matrices: mesh.instanceMatrix.array as Float32Array,
      cells: lotCells,
    };
  };
  const createLot = (level: number, pose: PoseId, capacity: number): Lot => {
    const mesh = new InstancedMesh(
      personGeometry(LEVELS[level], pose),
      CROWD_MATERIAL,
      capacity,
    );
    const lotOutfits = new Float32Array(capacity * 3);
    mesh.instanceColor = new InstancedBufferAttribute(lotOutfits, 3);
    mesh.customDepthMaterial = CROWD_DEPTH_MATERIAL;
    // Seules les figurines portent une ombre, et seulement près de la voiture.
    mesh.userData.shadow = level === NEAR;
    return {
      mesh,
      matrices: mesh.instanceMatrix.array as Float32Array,
      outfits: lotOutfits,
      count: 0,
      cloth:
        level !== FAR && pose === "flag" ? createCloth(level, capacity) : null,
    };
  };
  // Indice d'un lot : pose × niveau pour B et A, le dernier pour C ; `null` si la pose est absente.
  const lots: (Lot | null)[] = [NEAR, MID].flatMap((level) =>
    POSE_SET.map((pose, p) =>
      perPose[p] > 0 ? createLot(level, pose, perPose[p]) : null,
    ),
  );
  lots.push(createLot(FAR, FAR_POSE, n));
  const lotOf = (level: number, pose: number): Lot | null =>
    level === FAR
      ? lots[lots.length - 1]
      : lots[level * POSE_SET.length + pose];

  const levels = new Uint8Array(n);
  const rebuild = (): void => {
    for (const lot of lots) if (lot) lot.count = 0;
    for (let i = 0; i < n; i++) {
      const lot = lotOf(levels[i], poses[i]);
      if (!lot) continue;
      const k = lot.count++;
      for (let j = 0; j < 16; j++)
        lot.matrices[k * 16 + j] = matrices[i * 16 + j];
      for (let j = 0; j < 3; j++) lot.outfits[k * 3 + j] = outfits[i * 3 + j];
      if (lot.cloth) {
        for (let j = 0; j < 16; j++)
          lot.cloth.matrices[k * 16 + j] = matrices[i * 16 + j];
        lot.cloth.cells[k * 2] = cells[i * 2];
        lot.cloth.cells[k * 2 + 1] = cells[i * 2 + 1];
      }
    }
    for (const lot of lots) {
      if (!lot) continue;
      lot.mesh.count = lot.count;
      lot.mesh.visible = lot.count > 0;
      lot.mesh.instanceMatrix.needsUpdate = true;
      if (lot.mesh.instanceColor) lot.mesh.instanceColor.needsUpdate = true;
      if (lot.cloth) {
        const { mesh } = lot.cloth;
        mesh.count = lot.count;
        mesh.visible = lot.count > 0;
        mesh.instanceMatrix.needsUpdate = true;
        const attribute = mesh.geometry.getAttribute("flagCell");
        attribute.needsUpdate = true;
      }
    }
  };

  // Sphères englobantes calculées une fois, chaque lot plein : un lot partiel reste dedans, jamais écarté à tort.
  for (const level of [NEAR, MID, FAR]) {
    levels.fill(level);
    rebuild();
    for (const lot of lots) {
      if (lot?.mesh.visible) lot.mesh.computeBoundingSphere();
      if (lot?.cloth?.mesh.visible) lot.cloth.mesh.computeBoundingSphere();
    }
  }
  levels.fill(MID);
  rebuild();

  const near2 = CROWD_NEAR ** 2;
  const far2 = CROWD_FAR ** 2;
  const meshes = lots.flatMap((lot) =>
    lot ? (lot.cloth ? [lot.mesh, lot.cloth.mesh] : [lot.mesh]) : [],
  );
  const flags = clothGeometries.length > 0;
  if (flags) retainFlagMaterial();
  return {
    meshes,
    update: (x, z) => {
      let changed = false;
      for (let i = 0; i < n; i++) {
        const d2 = (xs[i] - x) ** 2 + (zs[i] - z) ** 2;
        const level = d2 < near2 ? NEAR : d2 < far2 ? MID : FAR;
        if (level !== levels[i]) {
          levels[i] = level;
          changed = true;
        }
      }
      if (changed) rebuild();
    },
    dispose: () => {
      for (const mesh of meshes) mesh.dispose();
      for (const geometry of clothGeometries) geometry.dispose();
      if (flags) releaseFlagMaterial();
    },
  };
};

/** Suit la voiture et répartit le public de chaque tranche. Sans voiture (aperçu du tracé), tout reste en A. */
export const useCrowdLod = (crowds: CrowdChunk[], source?: CarSource): void => {
  const followRef = useRef({ known: false, x: 0, z: 0 });

  // Nouvelles tranches : répartition immédiate, sans attendre que la voiture bouge.
  useEffect(() => {
    followRef.current.known = false;
  }, [crowds]);

  useFrame(() => {
    const pose = source?.getPose();
    if (!pose) return;
    const { x, z } = pose.position;
    const follow = followRef.current;
    if (
      follow.known &&
      (x - follow.x) ** 2 + (z - follow.z) ** 2 < RESAMPLE_DISTANCE ** 2
    )
      return;
    follow.known = true;
    follow.x = x;
    follow.z = z;
    for (const crowd of crowds) crowd.update(x, z);
  });
};
