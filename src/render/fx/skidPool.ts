// Traces de pneus : tampon circulaire de quadrilatères. L'effacement vit dans le shader,
// le processeur n'écrit qu'un nouveau segment, et seule cette partie du tampon est renvoyée à la carte graphique.
import {
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import { carConfig, wheelAxle } from "@/sim/carConfig";
import { WHEEL_COUNT, type CarState, type Pose } from "@/sim/types";
import { wheelContactPoint } from "./wheelContact";

export const SKID_SEGMENTS = 1536;
const LIFETIME_S = 14;
const VERTS_PER_SEGMENT = 6;
const FLOATS_PER_VERT = 4;
const FLOATS_PER_SEGMENT = VERTS_PER_SEGMENT * FLOATS_PER_VERT;
/** Hauteur au-dessus du point de contact, pour éviter le scintillement avec la route */
const GROUND_LIFT = 0.025;
const SLIP_THRESHOLD = 0.45;
const MIN_SPEED = 2;
const SEGMENT_LENGTH = 0.4;
/** Au-delà, la roue a sauté d'un point à un autre : pas de segment entre les deux */
const MAX_SEGMENT_LENGTH = 4;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uLife;
  attribute float aBirth;
  varying float vAlpha;

  void main() {
    float t = (uTime - aBirth) / uLife;
    vAlpha = t < 1.0 ? 0.55 * (1.0 - t) : 0.0;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.002) discard;
    gl_FragColor = vec4(0.015, 0.015, 0.018, vAlpha);
    #include <colorspace_fragment>
  }
`;

interface Trail {
  active: boolean;
  left: Vector3;
  right: Vector3;
  center: Vector3;
}

export interface SkidPool {
  mesh: Mesh;
  update: (state: CarState, pose: Pose, dt: number) => void;
  /** Coupe les traces en cours, sans effacer celles déjà au sol */
  breakTrails: () => void;
  /** Nombre total de segments écrits depuis la création */
  written: () => number;
  /** Lecture du tampon, pour la vérification */
  data: Float32Array;
  dispose: () => void;
}

export const createSkidPool = (): SkidPool => {
  const data = new Float32Array(SKID_SEGMENTS * FLOATS_PER_SEGMENT);
  for (let i = 3; i < data.length; i += FLOATS_PER_VERT) data[i] = -1e6;
  const buffer = new InterleavedBuffer(data, FLOATS_PER_VERT);
  buffer.setUsage(DynamicDrawUsage);

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new InterleavedBufferAttribute(buffer, 3, 0),
  );
  geometry.setAttribute("aBirth", new InterleavedBufferAttribute(buffer, 1, 3));

  const uniforms = { uTime: { value: 0 }, uLife: { value: LIFETIME_S } };
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  const trails: Trail[] = Array.from({ length: WHEEL_COUNT }, () => ({
    active: false,
    left: new Vector3(),
    right: new Vector3(),
    center: new Vector3(),
  }));
  const contact = new Vector3();
  const left = new Vector3();
  const right = new Vector3();
  let time = 0;
  let cursor = 0;
  let total = 0;

  const writeVertex = (offset: number, point: Vector3): void => {
    data[offset] = point.x;
    data[offset + 1] = point.y;
    data[offset + 2] = point.z;
    data[offset + 3] = time;
  };

  const writeSegment = (trail: Trail): void => {
    const start = cursor * FLOATS_PER_SEGMENT;
    writeVertex(start, trail.left);
    writeVertex(start + 4, trail.right);
    writeVertex(start + 8, left);
    writeVertex(start + 12, trail.right);
    writeVertex(start + 16, right);
    writeVertex(start + 20, left);
    buffer.addUpdateRange(start, FLOATS_PER_SEGMENT);
    buffer.needsUpdate = true;
    cursor = (cursor + 1) % SKID_SEGMENTS;
    total++;
  };

  const breakTrails = (): void => {
    for (const trail of trails) trail.active = false;
  };

  return {
    mesh,
    data,
    written: () => total,
    breakTrails,
    update: (state, pose, dt) => {
      time += dt;
      uniforms.uTime.value = time;
      const velocity = state.linearVelocity;
      const horizontal = Math.hypot(velocity.x, velocity.z);
      for (let i = 0; i < trails.length; i++) {
        const trail = trails[i];
        const wheel = state.wheels[i];
        const skidding =
          wheel?.inContact &&
          wheel.surface === "asphalt" &&
          wheel.slip >= SLIP_THRESHOLD &&
          horizontal >= MIN_SPEED;
        if (!skidding) {
          trail.active = false;
          continue;
        }
        wheelContactPoint(pose, wheel, i, contact);
        contact.y += GROUND_LIFT;
        // La largeur de la trace reste perpendiculaire au mouvement réel de la roue.
        const halfWidth = wheelAxle(carConfig, i).wheelWidth / 2;
        const sideX = (-velocity.z / horizontal) * halfWidth;
        const sideZ = (velocity.x / horizontal) * halfWidth;
        left.set(contact.x - sideX, contact.y, contact.z - sideZ);
        right.set(contact.x + sideX, contact.y, contact.z + sideZ);
        const moved = trail.active ? contact.distanceTo(trail.center) : 0;
        if (trail.active && moved < SEGMENT_LENGTH) continue;
        if (trail.active && moved <= MAX_SEGMENT_LENGTH) writeSegment(trail);
        trail.active = true;
        trail.left.copy(left);
        trail.right.copy(right);
        trail.center.copy(contact);
      }
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
