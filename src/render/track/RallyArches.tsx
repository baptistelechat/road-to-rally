"use client";

import { useEffect, useMemo } from "react";
import { Quaternion } from "three";
import {
  ARCH_TEXTS,
  archCell,
  type ArchText,
  rallyTextMaterial,
  releaseRallyText,
  retainRallyText,
  textQuad,
} from "@/render/scenery/rallyAtlas";
import {
  ARCH_SIGN,
  archScale,
  RALLY_GEOMETRY,
} from "@/render/scenery/rallyModels";
import { SCENERY_MATERIAL } from "@/render/scenery/models";
import { finishArch, splitArches, startArch } from "@/sim/track/scenery";
import type { Track } from "@/sim/types";

/**
 * L'arche gonflable unique du labo : départ, intermédiaires et arrivée ne changent que l'enseigne. Position, cap et
 * écartement viennent de `startArch`, `finishArch` et `splitArches`, comme les colliders des pieds : l'arche du labo
 * est mise à l'échelle pour que ses pieds tombent sur eux. Le panneau lumineux du départ est dans `StartLights`.
 */
export const RallyArches = ({ track }: { track: Track }) => {
  // Enseignes recto verso, UV de l'atlas posées : une géométrie par texte.
  const signs = useMemo(
    () =>
      Object.fromEntries(
        ARCH_TEXTS.map((text) => [
          text,
          textQuad(ARCH_SIGN.width, ARCH_SIGN.height, ARCH_SIGN.y, 0, {
            back: true,
            cell: archCell(text),
          }),
        ]),
      ) as Record<ArchText, ReturnType<typeof textQuad>>,
    [],
  );
  useEffect(() => {
    retainRallyText();
    return () => {
      for (const geometry of Object.values(signs)) geometry.dispose();
      releaseRallyText();
    };
  }, [signs]);

  const arches = useMemo(() => {
    const list: { pose: ReturnType<typeof startArch>; text: ArchText }[] = [
      { pose: startArch(track), text: "start" },
      // L'arche ouvre un secteur : la première ouvre le deuxième.
      ...splitArches(track).map((pose, i) => ({
        pose,
        text: i === 0 ? ("sector2" as const) : ("sector3" as const),
      })),
    ];
    if (!track.closed) list.push({ pose: finishArch(track), text: "finish" });
    return list.map(({ pose, text }) => ({
      key: `${text}:${pose.position.x},${pose.position.z}`,
      position: pose.position,
      quaternion: new Quaternion(
        pose.rotation.x,
        pose.rotation.y,
        pose.rotation.z,
        pose.rotation.w,
      ),
      scale: archScale(pose.halfSpan),
      text,
    }));
  }, [track]);

  return arches.map((arch) => (
    <group
      key={arch.key}
      position={[arch.position.x, arch.position.y, arch.position.z]}
      quaternion={arch.quaternion}
      scale={arch.scale}
    >
      <mesh
        geometry={RALLY_GEOMETRY.arch}
        material={SCENERY_MATERIAL}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={signs[arch.text]}
        material={rallyTextMaterial()}
        castShadow
      />
    </group>
  ));
};
