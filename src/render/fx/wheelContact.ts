import { Quaternion, Vector3 } from "three";
import { carConfig, wheelAxle, wheelRestPosition } from "@/sim/carConfig";
import type { Pose, WheelState } from "@/sim/types";

const rotation = new Quaternion();

/** Point de contact de la roue dans le monde : son centre réel, moins le rayon le long de la verticale. */
export const wheelContactPoint = (
  pose: Pose,
  wheel: WheelState,
  index: number,
  out: Vector3,
): Vector3 => {
  const rest = wheelRestPosition(carConfig, index);
  const { position, rotation: q } = pose;
  rotation.set(q.x, q.y, q.z, q.w);
  out.set(rest.x, rest.y + wheel.offsetY, rest.z).applyQuaternion(rotation);
  out.x += position.x;
  out.y += position.y - wheelAxle(carConfig, index).wheelRadius;
  out.z += position.z;
  return out;
};
