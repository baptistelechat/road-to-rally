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
      halfSpan: pose.halfSpan,
      // Hauteur du sol sous chaque pied, relative à la route : gauche (x local négatif) puis droite.
      feet: pose.feet.map((ground) => ground - pose.position.y),
      banner: pose.banner,
      text,
    }));
  }, [track]);

  return arches.map((arch) => (
    <group
      key={arch.key}
      position={[arch.position.x, arch.position.y, arch.position.z]}
      quaternion={arch.quaternion}
    >
      {arch.banner ? (
        // Route trop étroite pour l'arche : banderole tendue entre deux mâts au ras du bas-côté.
        <>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={RALLY_GEOMETRY.mast}
              material={SCENERY_MATERIAL}
              position={[side * arch.halfSpan, 0, 0]}
              castShadow
            />
          ))}
          <mesh
            geometry={RALLY_GEOMETRY.bannerRope}
            material={SCENERY_MATERIAL}
            position={[0, ARCH_SIGN.y + ARCH_SIGN.height / 2 + 0.05, 0]}
            scale={[2 * arch.halfSpan, 1, 1]}
          />
          <mesh
            geometry={signs[arch.text]}
            material={rallyTextMaterial()}
            castShadow
          />
        </>
      ) : (
        <>
          <group scale={arch.scale}>
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
          {/* Chaque pied descend jusqu'au sol, ou s'y enfonce : son lest est posé sur le sol réel. */}
          {arch.feet.map((ground, k) =>
            Math.abs(ground) < 0.05 ? null : (
              <group
                key={k}
                position={[(k * 2 - 1) * arch.halfSpan, ground, 0]}
              >
                {ground < 0 && (
                  <mesh
                    geometry={RALLY_GEOMETRY.archLeg}
                    material={SCENERY_MATERIAL}
                    scale={[arch.scale, -ground, arch.scale]}
                    castShadow
                  />
                )}
                <mesh
                  geometry={RALLY_GEOMETRY.archBallast}
                  material={SCENERY_MATERIAL}
                  scale={[arch.scale, 1, arch.scale]}
                  castShadow
                  receiveShadow
                />
              </group>
            ),
          )}
        </>
      )}
    </group>
  ));
};
