import type { ChicaneBlock } from "../types";

/** (x, z) est à moins de `margin` du rectangle du bloc, dans le repère du bloc et sur le plan horizontal. */
export const isNearBlock = (
  block: ChicaneBlock,
  x: number,
  z: number,
  margin: number,
): boolean => {
  const dx = x - block.position.x;
  const dz = z - block.position.z;
  const cos = Math.cos(block.yaw);
  const sin = Math.sin(block.yaw);
  return (
    Math.abs(dx * cos - dz * sin) <= block.span / 2 + margin &&
    Math.abs(dx * sin + dz * cos) <= block.depth / 2 + margin
  );
};
