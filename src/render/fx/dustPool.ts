// Poussière et fumée instanciées. Le mouvement vit dans le shader, fonction de l'âge :
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
import type { CarState, Pose, Surface } from "@/sim/types";
import { wheelContactPoint } from "./wheelContact";

export const DUST_POOL_SIZE = 256;
const STRIDE = 10;
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

  void main() {
    float age = uTime - iTiming.x;
    float t = age / iTiming.y;
    vUv = position.xy + 0.5;
    vKind = iStyle.y;
    if (t < 0.0 || t >= 1.0) {
      vAlpha = 0.0;
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    // Freinage par l'air (intégrale exacte), puis légère montée.
    vec3 world = iOrigin + iVelocity * (1.0 - exp(-2.2 * age)) / 2.2;
    world.y += 0.35 * age;
    float size = iStyle.x * (1.0 + 2.4 * t);
    float peak = iStyle.y < 0.5 ? 0.42 : 0.26;
    vAlpha = peak * smoothstep(0.0, 0.08, t) * (1.0 - t) * (1.0 - t);
    vec4 view = viewMatrix * vec4(world, 1.0);
    view.xy += position.xy * size;
    gl_Position = projectionMatrix * view;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying float vAlpha;
  varying float vKind;

  void main() {
    float radial = 1.0 - smoothstep(0.1, 0.5, length(vUv - 0.5));
    vec3 color = vKind < 0.5 ? vec3(0.30, 0.22, 0.12) : vec3(0.62, 0.62, 0.62);
    gl_FragColor = vec4(color, vAlpha * radial);
    if (gl_FragColor.a < 0.004) discard;
    #include <colorspace_fragment>
  }
`;

export interface DustPool {
  mesh: Mesh;
  update: (state: CarState, pose: Pose, dt: number) => void;
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
  const contact = new Vector3();
  let time = 0;
  let cursor = 0;
  let total = 0;

  const spawn = (state: CarState, grass: boolean): void => {
    const offset = cursor * STRIDE;
    const velocity = state.linearVelocity;
    data[offset] = contact.x + (Math.random() - 0.5) * 0.25;
    data[offset + 1] = contact.y + 0.08;
    data[offset + 2] = contact.z + (Math.random() - 0.5) * 0.25;
    data[offset + 3] = velocity.x * 0.22 + (Math.random() - 0.5) * 1.4;
    data[offset + 4] = 0.5 + Math.random() * 1.1;
    data[offset + 5] = velocity.z * 0.22 + (Math.random() - 0.5) * 1.4;
    data[offset + 6] = time;
    data[offset + 7] = (grass ? 0.7 : 0.9) + Math.random() * 0.45;
    data[offset + 8] = (grass ? 0.55 : 0.7) + Math.random() * 0.35;
    data[offset + 9] = grass ? 0 : 1;
    cursor = (cursor + 1) % DUST_POOL_SIZE;
    total++;
    buffer.needsUpdate = true;
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
        if (count === 0) continue;
        wheelContactPoint(pose, wheel, i, contact);
        for (let n = 0; n < count; n++) spawn(state, wheel.surface === "grass");
      }
    },
    reset: () => accumulators.fill(0),
    emitted: () => total,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
