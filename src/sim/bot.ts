import type { CarInput, CarState, Track, Vec3 } from "./types";

// Pilote automatique de test : il prouve qu'un tour complet est roulable. Ne sert pas en jeu.
const LATERAL_ACCEL = 6;
const BRAKING_DECEL = 5;
const MIN_SPEED = 8;
const MAX_SPEED = 45;

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

const radiusAt = (points: Vec3[], index: number, stride: number): number => {
  const count = points.length;
  const a = points[(index - stride + count) % count];
  const b = points[index % count];
  const c = points[(index + stride) % count];
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
  const { points, length } = track;
  const spacing = length / points.length;
  const here = track.nearest(state.position.x, state.position.z);
  const lookahead = Math.max(7, state.speed * 0.55);
  const target =
    points[Math.round((here.s + lookahead) / spacing) % points.length];

  const dx = target.x - state.position.x;
  const dz = target.z - state.position.z;
  const norm = Math.sqrt(dx * dx + dz * dz) || 1;
  const right = rotate({ x: 1, y: 0, z: 0 }, state.rotation);
  const steer = Math.max(
    -1,
    Math.min(1, ((dx * right.x + dz * right.z) / norm) * 2.2),
  );

  // Vitesse visée : la plus prudente sur les prochains points, en tenant compte du freinage.
  const index = Math.round(here.s / spacing);
  const stride = Math.max(1, Math.round(6 / spacing));
  let desired = MAX_SPEED;
  const horizon = Math.round(90 / spacing);
  for (let i = 0; i <= horizon; i += stride) {
    const corner = Math.sqrt(
      LATERAL_ACCEL * radiusAt(points, index + i, stride),
    );
    const brakingRoom = Math.sqrt(
      corner * corner + 2 * BRAKING_DECEL * i * spacing,
    );
    desired = Math.min(desired, Math.max(MIN_SPEED, brakingRoom));
  }

  const gap = desired - state.forwardSpeed;
  return {
    steer,
    throttle: gap > 0 ? Math.min(1, gap / 3) : 0,
    brake: gap < -1 ? Math.min(1, -gap / 6) : 0,
    handbrake: false,
  };
};
