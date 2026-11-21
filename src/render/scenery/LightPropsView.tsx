"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { lightPropCenter, type LightProps } from "@/sim/lightProps";
import type { SceneryKind } from "@/sim/types";
import { lightPropGeometry, SCENERY_MATERIAL } from "./models";

/** Objets légers d'origine : un lot par type, jamais masqué (peu nombreux, toujours près de la route). */
const KINDS: SceneryKind[] = [
  "hay",
  "hayUpright",
  "post",
  "sign",
  "chicaneSignLeft",
  "chicaneSignRight",
  "brakeBoard3",
  "brakeBoard2",
  "brakeBoard1",
];
/** Végétation renversable : des milliers sur une spéciale, en lots par maille pour que three masque les lointains. */
const VEGETATION_KINDS: SceneryKind[] = ["bushProp", "vineRowProp"];
/** Côté d'une maille de végétation, en mètres : assez petit pour masquer hors champ et hors zone d'ombre */
const VEGETATION_CELL = 100;

interface Batch {
  key: string;
  kind: SceneryKind;
  indices: number[];
  /** Végétation : sphère englobante recalculée à chaque déplacement, three masque le lot hors champ et hors ombre */
  culled: boolean;
}

/** Bottes, plots, panneaux et végétation renversable : seules les matrices des objets qui ont bougé sont réécrites. */
export const LightPropsView = ({ props }: { props: LightProps }) => {
  const meshes = useRef<Record<string, InstancedMesh | null>>({});
  const batches = useMemo((): Batch[] => {
    const fixed = KINDS.map((kind) => ({
      key: kind,
      kind,
      indices: props.items.flatMap((item, i) =>
        item.kind === kind ? [i] : [],
      ),
      culled: false,
    }));
    const cells = new Map<string, Batch>();
    props.items.forEach((item, i) => {
      if (!VEGETATION_KINDS.includes(item.kind)) return;
      const key = `${item.kind}:${Math.floor(item.position.x / VEGETATION_CELL)},${Math.floor(item.position.z / VEGETATION_CELL)}`;
      const batch = cells.get(key);
      if (batch) batch.indices.push(i);
      else cells.set(key, { key, kind: item.kind, indices: [i], culled: true });
    });
    return [...fixed, ...cells.values()];
  }, [props]);
  // Lot et rang d'instance de chaque objet léger : seuls ceux relus par `sync` sont réécrits.
  const writer = useMemo(() => {
    // -1 : objet dessiné ailleurs (habillage rallye, `rallyView.tsx`).
    const batchOf = new Int32Array(props.items.length).fill(-1);
    const instanceOf = new Int32Array(props.items.length);
    batches.forEach((batch, b) =>
      batch.indices.forEach((index, instance) => {
        batchOf[index] = b;
        instanceOf[index] = instance;
      }),
    );
    const dirty = new Uint8Array(batches.length);
    const matrix = new Matrix4();
    const position = new Vector3();
    const offset = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const tint = new Color();

    /** Réécrit la matrice d'un objet léger depuis sa dernière pose, si son lot est monté. */
    const write = (index: number): void => {
      if (batchOf[index] < 0) return;
      const mesh = meshes.current[batches[batchOf[index]].key];
      if (!mesh) return;
      const item = props.items[index];
      const pose = props.current()[index];
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
      mesh.setMatrixAt(
        instanceOf[index],
        matrix.compose(position, rotation, scale),
      );
      dirty[batchOf[index]] = 1;
    };

    const flush = (): void => {
      batches.forEach((batch, b) => {
        if (!dirty[b]) return;
        dirty[b] = 0;
        const mesh = meshes.current[batch.key];
        if (!mesh) return;
        mesh.instanceMatrix.needsUpdate = true;
        if (batch.culled) mesh.computeBoundingSphere();
      });
    };

    /** Toutes les poses connues, et la teinte de la végétation : la même que `SceneryView`, tirée du cap. */
    const writeAll = (): void => {
      for (let index = 0; index < props.items.length; index++) write(index);
      for (const batch of batches) {
        const mesh = meshes.current[batch.key];
        if (!mesh || !batch.culled) continue;
        batch.indices.forEach((index, instance) => {
          const shade =
            0.82 + 0.18 * (((props.items[index].yaw * 7.3) % 1) + 1);
          mesh.setColorAt(instance, tint.setScalar(shade));
        });
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      flush();
    };

    const update = (): void => {
      if (!props.sync()) return;
      for (const index of props.changed()) write(index);
      flush();
    };

    return { writeAll, update };
  }, [batches, props]);

  // Au montage : rien n'attend un premier réveil pour être placé.
  useLayoutEffect(() => writer.writeAll(), [writer]);
  useFrame(() => writer.update());

  return (
    <>
      {batches.map(({ key, kind, indices, culled }) => (
        <instancedMesh
          key={key}
          ref={(mesh) => {
            meshes.current[key] = mesh;
          }}
          args={[lightPropGeometry(kind), SCENERY_MATERIAL, indices.length]}
          castShadow
          frustumCulled={culled}
        />
      ))}
    </>
  );
};
