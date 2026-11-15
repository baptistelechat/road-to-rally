"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  InstancedBufferAttribute,
  type InstancedMesh,
  type Material,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import type { CarSource } from "@/render/carSource";
import {
  isRallyProp,
  lightPropCenter,
  type LightProps,
} from "@/sim/lightProps";
import { crowdSeedAt } from "@/sim/track/crowdPose";
import { finishArch, startArch } from "@/sim/track/scenery";
import type { SceneryItem, Track } from "@/sim/types";
import { createCrowdChunk, useCrowdLod } from "./crowd/crowdLod";
import {
  flagCell,
  flagMaterial,
  flagOf,
  releaseFlagMaterial,
  retainFlagMaterial,
} from "./crowd/flagAtlas";
import { pick } from "./crowd/hash";
import { CHICANE_GEOMETRY, SCENERY_MATERIAL } from "./models";
import {
  bannerCell,
  buvetteCell,
  placardCell,
  rallyTextInstancedMaterial,
  rallyTextMaterial,
  releaseRallyText,
  retainRallyText,
  type TextCell,
  textQuad,
} from "./rallyAtlas";
import {
  BANNER,
  MAST_CLOTH,
  PLACARD_FACE,
  RALLY_GEOMETRY,
  TENT_SIGN,
} from "./rallyModels";

// Habillage rallye (story 5.5) : tentes et commissaires fixes ; voiles, pancartes, mâts, banderoles, barrières et
// rubalise renversables, relus dans `LightProps` sans jamais écrire la simulation (rubalise sans ombre, trop fine).

const UP = new Vector3(0, 1, 0);

/** Graine tirée de la position de pose au centimètre, comme le public : rien à ajouter à la simulation. */
const seedOf = (item: SceneryItem): number =>
  crowdSeedAt(item.position.x, item.position.z);

/** Toile ondulée accrochée au mât, côté +X (voir `MastFlags` du labo). */
const buildCloth = (): PlaneGeometry => {
  const { width, height, top, segments } = MAST_CLOTH;
  const plane = new PlaneGeometry(width, height, segments, 1);
  plane.translate(width / 2 + 0.04, top - height / 2, 0);
  const position = plane.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    position.setZ(i, Math.sin(x * 4.2) * 0.07 * Math.min(1, x / 0.3));
  }
  plane.computeVertexNormals();
  return plane;
};

/** Couche d'un lot : même matrice par instance, géométrie et matériau propres. */
interface Layer {
  geometry: BufferGeometry;
  material: Material;
  /** Géométrie créée pour ce lot, libérée avec lui */
  owned: boolean;
}

interface Batch {
  key: string;
  indices: number[];
  layers: Layer[];
}

/** Géométrie du lot, avec un attribut d'instance par objet. */
const withInstances = (
  geometry: BufferGeometry,
  name: string,
  values: number[][],
): BufferGeometry => {
  const size = values[0]?.length ?? 1;
  const data = new Float32Array(values.length * size);
  values.forEach((value, i) => data.set(value, i * size));
  geometry.setAttribute(name, new InstancedBufferAttribute(data, size));
  return geometry;
};

/** Lots des objets renversables : un par modèle, les textes et toiles en couches sur les mêmes matrices. */
const buildBatches = (props: LightProps, track: Track): Batch[] => {
  const byKey = new Map<string, number[]>();
  props.items.forEach((item, i) => {
    if (!isRallyProp(item.kind)) return;
    const key =
      item.kind === "rallySail"
        ? `rallySail:${pick([0, 1, 2, 3], seedOf(item))}`
        : item.kind;
    const list = byKey.get(key);
    if (list) list.push(i);
    else byKey.set(key, [i]);
  });
  const start = startArch(track).position;
  const finish = track.closed ? null : finishArch(track).position;
  /** Banderole de l'arrivée : la plus proche de l'arche d'arrivée */
  const atFinish = (item: SceneryItem): boolean =>
    finish !== null &&
    Math.hypot(item.position.x - finish.x, item.position.z - finish.z) <
      Math.hypot(item.position.x - start.x, item.position.z - start.z);
  const fixed = (geometry: BufferGeometry): Layer => ({
    geometry,
    material: SCENERY_MATERIAL,
    owned: false,
  });

  return [...byKey.entries()].map(([key, indices]): Batch => {
    const items = indices.map((i) => props.items[i]);
    const text = (
      quad: BufferGeometry,
      cellOf: (item: SceneryItem) => TextCell,
    ): Layer => ({
      geometry: withInstances(quad, "textCell", items.map(cellOf)),
      material: rallyTextInstancedMaterial(),
      owned: true,
    });
    if (key.startsWith("rallySail:"))
      return {
        key,
        indices,
        layers: [fixed(RALLY_GEOMETRY.sails[Number(key.slice(10))])],
      };
    switch (key) {
      case "rallyPlacard":
        return {
          key,
          indices,
          layers: [
            fixed(RALLY_GEOMETRY.placard),
            text(
              textQuad(
                PLACARD_FACE.width,
                PLACARD_FACE.height,
                PLACARD_FACE.y,
                PLACARD_FACE.z,
              ),
              (item) => placardCell(seedOf(item)),
            ),
          ],
        };
      case "rallyMast":
        return {
          key,
          indices,
          layers: [
            fixed(RALLY_GEOMETRY.mast),
            {
              geometry: withInstances(
                buildCloth(),
                "flagCell",
                items.map((item) => flagCell(flagOf(seedOf(item)))),
              ),
              material: flagMaterial(),
              owned: true,
            },
          ],
        };
      case "rallyCheckerMast":
        return { key, indices, layers: [fixed(RALLY_GEOMETRY.checkerMast)] };
      case "rallyTape":
        return { key, indices, layers: [fixed(RALLY_GEOMETRY.tape)] };
      case "rallyBanner":
        return {
          key,
          indices,
          layers: [
            fixed(RALLY_GEOMETRY.bannerPosts),
            text(
              textQuad(BANNER.width, BANNER.height, BANNER.y, 0, {
                back: true,
              }),
              (item) => bannerCell(atFinish(item)),
            ),
          ],
        };
      default:
        return { key, indices, layers: [fixed(CHICANE_GEOMETRY.looseBarrier)] };
    }
  });
};

/** Voiles, pancartes, mâts, banderoles et barrières : seules les matrices des objets qui ont bougé sont réécrites. */
const RallyProps = ({ props, track }: { props: LightProps; track: Track }) => {
  const batches = useMemo(() => buildBatches(props, track), [props, track]);
  const meshes = useRef<Record<string, (InstancedMesh | null)[]>>({});
  useEffect(() => {
    retainFlagMaterial();
    retainRallyText();
    return () => {
      for (const batch of batches)
        for (const layer of batch.layers)
          if (layer.owned) layer.geometry.dispose();
      releaseFlagMaterial();
      releaseRallyText();
    };
  }, [batches]);

  const writer = useMemo(() => {
    const total = batches.reduce((sum, batch) => sum + batch.indices.length, 0);
    /** Dernière pose écrite de chaque objet : position puis rotation */
    const written = new Float64Array(total * 7).fill(Number.NaN);
    const matrix = new Matrix4();
    const position = new Vector3();
    const offset = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();

    const write = (all: boolean): void => {
      const poses = props.current();
      let slot = 0;
      for (const batch of batches) {
        let dirty = false;
        const layers = meshes.current[batch.key] ?? [];
        batch.indices.forEach((index, instance) => {
          const pose = poses[index];
          const base = (slot + instance) * 7;
          const { x, y, z } = pose.position;
          const q = pose.rotation;
          if (
            !all &&
            written[base] === x &&
            written[base + 1] === y &&
            written[base + 2] === z &&
            written[base + 3] === q.x &&
            written[base + 4] === q.y &&
            written[base + 5] === q.z &&
            written[base + 6] === q.w
          )
            return;
          written[base] = x;
          written[base + 1] = y;
          written[base + 2] = z;
          written[base + 3] = q.x;
          written[base + 4] = q.y;
          written[base + 5] = q.z;
          written[base + 6] = q.w;
          const item = props.items[index];
          rotation.set(
            pose.rotation.x,
            pose.rotation.y,
            pose.rotation.z,
            pose.rotation.w,
          );
          // Le modèle a son origine au pied, le corps physique en son centre.
          offset.set(0, -lightPropCenter(item), 0).applyQuaternion(rotation);
          position
            .set(pose.position.x, pose.position.y, pose.position.z)
            .add(offset);
          scale.setScalar(item.scale);
          matrix.compose(position, rotation, scale);
          for (const mesh of layers) mesh?.setMatrixAt(instance, matrix);
          dirty = true;
        });
        slot += batch.indices.length;
        if (!dirty) continue;
        for (const mesh of layers)
          if (mesh) mesh.instanceMatrix.needsUpdate = true;
      }
    };
    return write;
  }, [batches, props]);

  // Au montage : rien n'attend un premier réveil pour être placé.
  useLayoutEffect(() => writer(true), [writer]);
  useFrame(() => writer(false));

  return (
    <>
      {batches.flatMap((batch) =>
        batch.layers.map((layer, l) => (
          <instancedMesh
            key={`${batch.key}:${l}`}
            ref={(mesh) => {
              const list = meshes.current[batch.key] ?? [];
              list[l] = mesh;
              meshes.current[batch.key] = list;
            }}
            args={[layer.geometry, layer.material, batch.indices.length]}
            castShadow={batch.key !== "rallyTape"}
            frustumCulled={false}
          />
        )),
      )}
    </>
  );
};

interface FixedProps {
  items: SceneryItem[];
  geometry: BufferGeometry;
  material: Material;
  castShadow: boolean;
}

/** Objets fixes d'un même modèle : un lot, placé une fois. */
const Fixed = ({ items, geometry, material, castShadow }: FixedProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    items.forEach((item, i) => {
      position.set(item.position.x, item.position.y, item.position.z);
      rotation.setFromAxisAngle(UP, item.yaw);
      scale.setScalar(item.scale);
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
};

interface RallyViewProps {
  /** Décor fixe de la simulation : seuls tentes et commissaires sont lus ici */
  scenery: SceneryItem[];
  props: LightProps;
  track: Track;
  source?: CarSource;
}

/** Habillage rallye du départ, des intermédiaires, des épingles et de l'arrivée ; les arches sont dans `RallyArches`. */
export const RallyView = ({
  scenery,
  props,
  track,
  source,
}: RallyViewProps) => {
  const tents = useMemo(
    () => scenery.filter((item) => item.kind === "rallyTent"),
    [scenery],
  );
  const tentSign = useMemo(
    () =>
      textQuad(TENT_SIGN.width, TENT_SIGN.height, TENT_SIGN.y, TENT_SIGN.z, {
        cell: buvetteCell(),
      }),
    [],
  );
  useEffect(() => {
    retainRallyText();
    return () => {
      tentSign.dispose();
      releaseRallyText();
    };
  }, [tentSign]);

  // Commissaires : pose et tenue dédiées, mêmes niveaux de détail que le public.
  const marshals = useMemo(() => {
    const items = scenery.filter((item) => item.kind === "marshal");
    if (items.length === 0) return null;
    const chunk = createCrowdChunk(items);
    for (const mesh of chunk.meshes)
      mesh.castShadow = mesh.userData.shadow === true;
    return chunk;
  }, [scenery]);
  useEffect(() => () => marshals?.dispose(), [marshals]);
  const crowds = useMemo(() => (marshals ? [marshals] : []), [marshals]);
  useCrowdLod(crowds, source);

  return (
    <group>
      {tents.length > 0 && (
        <>
          <Fixed
            items={tents}
            geometry={RALLY_GEOMETRY.tent}
            material={SCENERY_MATERIAL}
            castShadow
          />
          <Fixed
            items={tents}
            geometry={tentSign}
            material={rallyTextMaterial()}
            castShadow={false}
          />
        </>
      )}
      {marshals?.meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
      <RallyProps props={props} track={track} />
    </group>
  );
};
