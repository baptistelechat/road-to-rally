// Choc → étincelles, sans simulation ni rendu : vérifiable sans navigateur.
// La simulation ne dit pas où le choc a lieu. La voiture repart à l'opposé de l'obstacle :
// le point de contact est estimé au bord de la caisse, du côté opposé à la variation de vitesse.
import { Quaternion, Vector3 } from "three";
import type { Pose, Vec3 } from "@/sim/types";

/** En dessous, c'est un simple coup de roue ou une réception : pas d'étincelles. */
const MIN_IMPACT = 0.15;
const RISE = 0.02;
const MIN_GAP_S = 0.08;

export interface ImpactDetector {
  /** Renvoie la force du choc qui vient de se produire, 0 sinon */
  update: (impact: number, dt: number) => number;
}

export const createImpactDetector = (): ImpactDetector => {
  let last = 0;
  let wait = 0;
  return {
    update: (impact, dt) => {
      wait = Math.max(0, wait - dt);
      const rising = impact > last + RISE;
      last = impact;
      if (!rising || impact < MIN_IMPACT || wait > 0) return 0;
      wait = MIN_GAP_S;
      return impact;
    },
  };
};

const rotation = new Quaternion();
const local = new Vector3();

/**
 * Point de la caisse vers lequel pointe `-push`, et direction de rebond dans `away`, tous deux dans le monde.
 * `push` nul : le choc est placé à l'avant.
 */
export const impactContact = (
  pose: Pose,
  push: Vec3,
  halfExtents: Vec3,
  out: Vector3,
  away: Vector3,
): void => {
  const { position, rotation: q } = pose;
  rotation.set(q.x, q.y, q.z, q.w);
  away.set(push.x, push.y, push.z);
  if (away.lengthSq() < 1e-6) away.set(0, 0, 1).applyQuaternion(rotation);
  away.normalize();
  local.copy(away).negate().applyQuaternion(rotation.clone().invert());
  // Agrandit la direction jusqu'à la première face de la boîte.
  const reach = Math.min(
    halfExtents.x / Math.max(Math.abs(local.x), 1e-6),
    halfExtents.y / Math.max(Math.abs(local.y), 1e-6),
    halfExtents.z / Math.max(Math.abs(local.z), 1e-6),
  );
  out.copy(local).multiplyScalar(reach).applyQuaternion(rotation);
  out.x += position.x;
  out.y += position.y;
  out.z += position.z;
};
