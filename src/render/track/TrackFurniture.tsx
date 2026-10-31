"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, type BufferGeometry, Quaternion } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { startArch } from "@/sim/track/scenery";
import type { Track } from "@/sim/types";

const BANNER_COLUMNS = 10;
const BANNER_ROWS = 2;
const BANNER_Y = 4.6;

/** Deux poteaux et une bannière à damier. Les poteaux ont leur collider dans `addTrackColliders`. */
export const StartArch = ({ track }: { track: Track }) => {
  const arch = useMemo(() => {
    const { position, rotation, halfSpan } = startArch(track);
    const square = (2 * halfSpan) / BANNER_COLUMNS;
    const cells: BufferGeometry[] = [];
    for (let row = 0; row < BANNER_ROWS; row++)
      for (let col = 0; col < BANNER_COLUMNS; col++)
        if ((col + row) % 2 === 0)
          cells.push(
            new BoxGeometry(square, square, 0.12).translate(
              -halfSpan + square * (col + 0.5),
              BANNER_Y + square * (row + 0.5),
              0,
            ),
          );
    const height = BANNER_Y + square * BANNER_ROWS;
    return {
      position,
      quaternion: new Quaternion(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
      ),
      halfSpan,
      height,
      post: new BoxGeometry(0.3, height, 0.3),
      banner: new BoxGeometry(
        2 * halfSpan,
        square * BANNER_ROWS,
        0.08,
      ).translate(0, BANNER_Y + square, 0),
      squares: mergeGeometries(cells),
    };
  }, [track]);

  useEffect(
    () => () => {
      arch.post.dispose();
      arch.banner.dispose();
      arch.squares.dispose();
    },
    [arch],
  );

  return (
    <group
      position={[arch.position.x, arch.position.y, arch.position.z]}
      quaternion={arch.quaternion}
    >
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={arch.post}
          position={[side * arch.halfSpan, arch.height / 2, 0]}
          castShadow
        >
          <meshStandardMaterial color="#2a2a2e" flatShading />
        </mesh>
      ))}
      <mesh geometry={arch.banner} castShadow>
        <meshStandardMaterial color="#1c1c20" flatShading />
      </mesh>
      <mesh geometry={arch.squares}>
        <meshStandardMaterial color="#f2efe6" flatShading />
      </mesh>
    </group>
  );
};
