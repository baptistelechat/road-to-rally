import type { CarInput, CarState, Track, Vec3 } from "./types";

// Pilote automatique de test : il prouve qu'un tour complet est roulable. Ne sert pas en jeu.
const LATERAL_ACCEL = 6;
/** Sur un tracé ouvert, sortir de 2 m suffit à tomber de la digue : le bot garde de la marge */
const OPEN_LATERAL_ACCEL = 4.5;
const BRAKING_DECEL = 5;
const MIN_SPEED = 8;
const MAX_SPEED = 45;
/** Vitesse mini visée sur un tracé ouvert : une épingle de 8 m ne se prend pas à 29 km/h */
const OPEN_MIN_SPEED = 6;

const rotate = (v: Vec3, q: CarState["rotation"]): Vec3 => {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
};

const radiusAt = (
  at: (index: number) => Vec3,
  index: number,
  stride: number,
): number => {
  const a = at(index - stride);
  const b = at(index);
  const c = at(index + stride);
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const bcx = c.x - b.x;
  const bcz = c.z - b.z;
  const cross = Math.abs(abx * bcz - abz * bcx);
  const ab = Math.sqrt(abx * abx + abz * abz);
  const bc = Math.sqrt(bcx * bcx + bcz * bcz);
  const acx = c.x - a.x;
  const acz = c.z - a.z;
  const ac = Math.sqrt(acx * acx + acz * acz);
  return cross < 1e-6 ? Infinity : (ab * bc * ac) / (2 * cross);
};

export const botInput = (state: CarState, track: Track): CarInput => {
  const { points, length, closed } = track;
  const count = points.length;
  const spacing = length / (closed ? count : count - 1);
  // Tracé fermé : on boucle. Tracé ouvert : on s'arrête aux extrémités.
  const at = (index: number): Vec3 =>
    closed
      ? points[(index + count) % count]
      : points[Math.max(0, Math.min(count - 1, index))];
  // Sur tracé ouvert, le pas réel : la pente d'un long prolongement ferait dériver le pas moyen de plusieurs mètres.
  const toIndex = (s: number): number =>
    closed ? Math.round(s / spacing) : track.indexAt(s);
  const here = track.nearest(state.position.x, state.position.z);
  // Sur un tracé ouvert, la route peut faire 3,5 m en épingle : on coupe moins la corde.
  const lookahead = Math.max(closed ? 7 : 4.5, state.speed * 0.55);
  const target = at(toIndex(here.s + lookahead));

  const dx = target.x - state.position.x;
  const dz = target.z - state.position.z;
  const norm = Math.sqrt(dx * dx + dz * dz) || 1;
  const right = rotate({ x: 1, y: 0, z: 0 }, state.rotation);
  const steer = Math.max(
    -1,
    Math.min(1, ((dx * right.x + dz * right.z) / norm) * 2.2),
  );

  // Vitesse visée : la plus prudente sur les prochains points, en tenant compte du freinage.
  const index = toIndex(here.s);
  const stride = Math.max(1, Math.round(6 / spacing));
  let desired = MAX_SPEED;
  const horizon = Math.round(90 / spacing);
  for (let i = 0; i <= horizon; i += stride) {
    const corner = Math.sqrt(
      (closed ? LATERAL_ACCEL : OPEN_LATERAL_ACCEL) *
        radiusAt(at, index + i, stride),
    );
    const brakingRoom = Math.sqrt(
      corner * corner + 2 * BRAKING_DECEL * i * spacing,
    );
    desired = Math.min(
      desired,
      Math.max(closed ? MIN_SPEED : OPEN_MIN_SPEED, brakingRoom),
    );
  }

  const gap = desired - state.forwardSpeed;
  return {
    steer,
    throttle: gap > 0 ? Math.min(1, gap / 3) : 0,
    brake: gap < -1 ? Math.min(1, -gap / 6) : 0,
    handbrake: false,
  };
};
