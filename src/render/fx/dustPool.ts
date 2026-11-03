// Poussière, fumée, mottes et étincelles instanciées. Le mouvement vit dans le shader, fonction de l'âge :
// le processeur n'écrit qu'à l'apparition d'une particule, dans un pool fixe, sans allocation par image.
import {
  BufferAttribute,
  DynamicDrawUsage,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import type { CarState, Pose, Surface, Vec3 } from "@/sim/types";
import { wheelContactPoint } from "./wheelContact";

export const DUST_POOL_SIZE = 384;
const STRIDE = 10;
// Partie entière de `iStyle.y`. La partie décimale dose le vert d'une motte, et la chute possible d'une étincelle.
const KIND_DUST = 0;
const KIND_SMOKE = 1;
const KIND_CLOD = 2;
const KIND_SPARK = 3;
/** Chute maximale d'une étincelle sous son point de départ, en mètres */
const SPARK_MAX_DROP = 2;
const MAX_SPAWN_PER_WHEEL = 3;

const vertexShader = /* glsl */ `
  uniform float uTime;
  attribute vec3 iOrigin;
  attribute vec3 iVelocity;
  attribute vec2 iTiming;
  attribute vec2 iStyle;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vKind;
  varying float vGreen;

  void main() {
    float age = uTime - iTiming.x;
    float t = age / iTiming.y;
    vUv = position.xy + 0.5;
    vKind = floor(iStyle.y);
    vGreen = fract(iStyle.y);
    if (t < 0.0 || t >= 1.0) {
      vAlpha = 0.0;
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    bool heavy = vKind > 1.5;
    // Freinage par l'air (intégrale exacte).
    float drag = heavy ? 0.7 : 2.2;
    vec3 world = iOrigin + iVelocity * (1.0 - exp(-drag * age)) / drag;
    vec2 corner = position.xy;
    float size;
    if (heavy) {
      // Mottes et étincelles retombent, puis s'arrêtent à leur hauteur de départ, moins la chute prévue.
      float drop = vKind > 2.5 ? vGreen * ${SPARK_MAX_DROP.toFixed(1)} : 0.0;
      world.y = max(world.y - 4.9 * age * age, iOrigin.y - drop);
      size = iStyle.x;
      vAlpha = 1.0 - smoothstep(0.7, 1.0, t);
      float spin = age * 9.0 + iOrigin.x * 37.0;
      corner = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * corner;
    } else {
      world.y += 0.35 * age;
      size = iStyle.x * (1.0 + 2.4 * t);
      float peak = vKind < 0.5 ? 0.42 : 0.26;
      vAlpha = peak * smoothstep(0.0, 0.08, t) * (1.0 - t) * (1.0 - t);
    }
    vec4 view = viewMatrix * vec4(world, 1.0);
    view.xy += corner * size;
    gl_Position = projectionMatrix * view;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying float vAlpha;
  varying float vKind;
  varying float vGreen;

  void main() {
    // Mottes et étincelles restent des carrés nets, comme le reste du jeu.
    float radial = vKind > 1.5 ? 1.0 : 1.0 - smoothstep(0.1, 0.5, length(vUv - 0.5));
    vec3 color = vKind < 0.5
      ? vec3(0.30, 0.22, 0.12)
      : vKind < 1.5
        ? vec3(0.62, 0.62, 0.62)
        : vKind < 2.5
          ? mix(vec3(0.13, 0.08, 0.04), vec3(0.11, 0.25, 0.05), vGreen)
          : vec3(1.0, 0.55, 0.14);
    gl_FragColor = vec4(color, vAlpha * radial);
    if (gl_FragColor.a < 0.004) discard;
    #include <colorspace_fragment>
  }
`;

export interface DustPool {
  mesh: Mesh;
  update: (state: CarState, pose: Pose, dt: number) => void;
  /** Étincelles et bouffée de fumée en un point du monde, pour une détonation d'échappement */
  burst: (at: Vec3, velocity: Vec3, strength: number) => void;
  /** Gerbe d'étincelles sur un choc : `away` part de l'obstacle, `drop` est la hauteur au-dessus du sol */
  impactSparks: (
    at: Vec3,
    velocity: Vec3,
    away: Vec3,
    strength: number,
    drop: number,
  ) => void;
  /** Oublie les émissions en cours, par exemple après une remise en piste */
  reset: () => void;
  /** Nombre total de particules émises depuis la création */
  emitted: () => number;
  dispose: () => void;
}

/** Particules par seconde pour une roue, selon la surface et le glissement. */
export const dustRate = (
  surface: Surface,
  slip: number,
  speed: number,
): number => {
  if (surface === "grass") {
    const motion = Math.min(1, Math.max(0, (speed - 4) / 21));
    return motion > 0 ? 12 * motion + 30 * slip : 0;
  }
  return slip > 0.35 ? (40 * (slip - 0.35)) / 0.65 : 0;
};

/** Mottes par seconde pour une roue : l'herbe seule, et il faut rouler. */
export const clodRate = (
  surface: Surface,
  slip: number,
  speed: number,
): number => {
  if (surface !== "grass") return 0;
  const motion = Math.min(1, Math.max(0, (speed - 4) / 21));
  return motion > 0 ? motion * (6 + 16 * slip) : 0;
};

export const createDustPool = (): DustPool => {
  const data = new Float32Array(DUST_POOL_SIZE * STRIDE);
  // Particules « déjà mortes » tant qu'elles n'ont pas été émises.
  for (let i = 0; i < DUST_POOL_SIZE; i++) {
    data[i * STRIDE + 6] = -1000;
    data[i * STRIDE + 7] = 1;
  }
  const buffer = new InstancedInterleavedBuffer(data, STRIDE);
  buffer.setUsage(DynamicDrawUsage);

  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array([
        -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
      ]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute(
    "iOrigin",
    new InterleavedBufferAttribute(buffer, 3, 0),
  );
  geometry.setAttribute(
    "iVelocity",
    new InterleavedBufferAttribute(buffer, 3, 3),
  );
  geometry.setAttribute(
    "iTiming",
    new InterleavedBufferAttribute(buffer, 2, 6),
  );
  geometry.setAttribute("iStyle", new InterleavedBufferAttribute(buffer, 2, 8));
  geometry.instanceCount = DUST_POOL_SIZE;

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  const accumulators = [0, 0, 0, 0];
  const clodAccumulators = [0, 0, 0, 0];
  const contact = new Vector3();
  let time = 0;
  let cursor = 0;
  let total = 0;

  const write = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    kind: number,
  ): void => {
    const offset = cursor * STRIDE;
    data[offset] = x;
    data[offset + 1] = y;
    data[offset + 2] = z;
    data[offset + 3] = vx;
    data[offset + 4] = vy;
    data[offset + 5] = vz;
    data[offset + 6] = time;
    data[offset + 7] = life;
    data[offset + 8] = size;
    data[offset + 9] = kind;
    cursor = (cursor + 1) % DUST_POOL_SIZE;
    total++;
    buffer.needsUpdate = true;
  };

  const spawn = (state: CarState, grass: boolean): void => {
    const velocity = state.linearVelocity;
    write(
      contact.x + (Math.random() - 0.5) * 0.25,
      contact.y + 0.08,
      contact.z + (Math.random() - 0.5) * 0.25,
      velocity.x * 0.22 + (Math.random() - 0.5) * 1.4,
      0.5 + Math.random() * 1.1,
      velocity.z * 0.22 + (Math.random() - 0.5) * 1.4,
      (grass ? 0.7 : 0.9) + Math.random() * 0.45,
      (grass ? 0.55 : 0.7) + Math.random() * 0.35,
      grass ? KIND_DUST : KIND_SMOKE,
    );
  };

  const spawnClod = (state: CarState): void => {
    const velocity = state.linearVelocity;
    write(
      contact.x + (Math.random() - 0.5) * 0.2,
      contact.y + 0.05,
      contact.z + (Math.random() - 0.5) * 0.2,
      velocity.x * 0.3 + (Math.random() - 0.5) * 4,
      2.5 + Math.random() * 2.5,
      velocity.z * 0.3 + (Math.random() - 0.5) * 4,
      0.6 + Math.random() * 0.4,
      0.05 + Math.random() * 0.08,
      KIND_CLOD + Math.random() * 0.99,
    );
  };

  return {
    mesh,
    update: (state, pose, dt) => {
      time += dt;
      material.uniforms.uTime.value = time;
      for (let i = 0; i < state.wheels.length; i++) {
        const wheel = state.wheels[i];
        if (!wheel?.inContact) continue;
        const rate = dustRate(wheel.surface, wheel.slip, state.speed);
        accumulators[i] += rate * dt;
        const count = Math.min(
          MAX_SPAWN_PER_WHEEL,
          Math.floor(accumulators[i]),
        );
        // Après un trou d'image, on perd le surplus au lieu de le rattraper d'un coup.
        accumulators[i] =
          count === MAX_SPAWN_PER_WHEEL ? 0 : accumulators[i] - count;
        clodAccumulators[i] +=
          clodRate(wheel.surface, wheel.slip, state.speed) * dt;
        const clods = Math.min(
          MAX_SPAWN_PER_WHEEL,
          Math.floor(clodAccumulators[i]),
        );
        clodAccumulators[i] =
          clods === MAX_SPAWN_PER_WHEEL ? 0 : clodAccumulators[i] - clods;
        if (count === 0 && clods === 0) continue;
        wheelContactPoint(pose, wheel, i, contact);
        for (let n = 0; n < count; n++) spawn(state, wheel.surface === "grass");
        for (let n = 0; n < clods; n++) spawnClod(state);
      }
    },
    burst: (at, velocity, strength) => {
      const sparks = 2 + Math.round(3 * strength);
      for (let n = 0; n < sparks; n++)
        write(
          at.x,
          at.y,
          at.z,
          velocity.x * 0.7 + (Math.random() - 0.5) * 3,
          0.8 + Math.random() * 1.6,
          velocity.z * 0.7 + (Math.random() - 0.5) * 3,
          0.25 + Math.random() * 0.2,
          0.035 + Math.random() * 0.03,
          KIND_SPARK,
        );
      write(
        at.x,
        at.y,
        at.z,
        velocity.x * 0.4,
        0.4,
        velocity.z * 0.4,
        0.5 + Math.random() * 0.3,
        0.3 + 0.15 * strength,
        KIND_SMOKE,
      );
    },
    impactSparks: (at, velocity, away, strength, drop) => {
      const count = 6 + Math.round(18 * strength);
      const fall = Math.min(0.99, Math.max(0, drop) / SPARK_MAX_DROP);
      for (let n = 0; n < count; n++) {
        const push = 2 + Math.random() * 5;
        write(
          at.x,
          at.y,
          at.z,
          velocity.x * 0.6 + away.x * push + (Math.random() - 0.5) * 5,
          velocity.y * 0.6 + away.y * push + 1 + Math.random() * 3,
          velocity.z * 0.6 + away.z * push + (Math.random() - 0.5) * 5,
          0.35 + Math.random() * 0.35,
          0.04 + Math.random() * 0.04,
          KIND_SPARK + fall,
        );
      }
    },
    reset: () => {
      accumulators.fill(0);
      clodAccumulators.fill(0);
    },
    emitted: () => total,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
