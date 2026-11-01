import assert from "node:assert/strict";
import type { BufferGeometry } from "three";
import {
  buildCarGeometry,
  type CarGeometry,
} from "../../src/render/car/buildCarGeometry";
import { defaultLivery, type Livery } from "../../src/render/car/livery";
import {
  carConfig,
  wheelAxle,
  wheelRestPosition,
} from "../../src/sim/carConfig";

const positionsOf = (geometry: BufferGeometry): Float32Array =>
  geometry.getAttribute("position").array as Float32Array;
const colorsOf = (geometry: BufferGeometry): Float32Array =>
  geometry.getAttribute("color").array as Float32Array;

const allGeometries = (car: CarGeometry): BufferGeometry[] => [
  car.body,
  car.brakeLights,
  ...car.wheels.map((wheel) => wheel.geometry),
];

const check = async (): Promise<void> => {
  const car = buildCarGeometry(defaultLivery);
  const geometries = allGeometries(car);

  // Budget
  const triangles = geometries.reduce(
    (sum, g) => sum + positionsOf(g).length / 9,
    0,
  );
  assert.ok(triangles < 3000, `${triangles} triangles`);

  // Géométrie saine : ni NaN, ni normale nulle
  for (const geometry of geometries) {
    assert.ok(positionsOf(geometry).length > 0);
    assert.ok(
      positionsOf(geometry).every(Number.isFinite),
      "position non finie",
    );
    assert.ok(colorsOf(geometry).every(Number.isFinite), "couleur non finie");
    const normals = geometry.getAttribute("normal").array as Float32Array;
    assert.ok(normals.every(Number.isFinite), "normale non finie");
    for (let i = 0; i < normals.length; i += 3) {
      assert.ok(
        Math.hypot(normals[i], normals[i + 1], normals[i + 2]) > 0.5,
        "normale nulle",
      );
    }
  }

  // Une autre livrée change les couleurs sans déplacer un seul sommet
  const otherLivery: Livery = {
    primary: "#112233",
    secondary: "#445566",
    accent: "#778899",
    rim: "#aabbcc",
  };
  const repainted = allGeometries(buildCarGeometry(otherLivery));
  geometries.forEach((geometry, i) => {
    assert.deepEqual(positionsOf(repainted[i]), positionsOf(geometry));
  });
  assert.notDeepEqual(colorsOf(repainted[0]), colorsOf(car.body));
  assert.notDeepEqual(colorsOf(repainted[2]), colorsOf(car.wheels[0].geometry));

  // Roues : positions et dimensions de `carConfig`
  assert.equal(car.wheels.length, 4);
  car.wheels.forEach((wheel, i) => {
    assert.deepEqual(wheel.position, wheelRestPosition(carConfig, i));
    const axle = wheelAxle(carConfig, i);
    const box = wheel.geometry.boundingBox;
    assert.ok(box);
    const near = (a: number, b: number): void =>
      assert.ok(Math.abs(a - b) < 1e-3, `${a} != ${b}`);
    near(box.max.y, axle.wheelRadius);
    near(box.min.y, -axle.wheelRadius);
    near(box.max.z, axle.wheelRadius);
    near(box.max.x - box.min.x, axle.wheelWidth);
    near(box.max.x + box.min.x, 0);
  });

  // Caisse et bavettes au-dessus de la route à l'assiette de repos
  const ground = Math.min(
    ...car.wheels.map(
      (wheel, i) => wheel.position.y - wheelAxle(carConfig, i).wheelRadius,
    ),
  );
  const box = car.body.boundingBox;
  assert.ok(box);
  assert.ok(box.min.y > ground + carConfig.ride.sag + 0.02, "bavettes au sol");
  const positions = positionsOf(car.body);
  let floor = Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    if (Math.abs(positions[i]) < 0.6) floor = Math.min(floor, positions[i + 1]);
  }
  assert.ok(floor > ground + 0.2, `garde au sol ${floor - ground}`);
  assert.ok(box.max.y - ground < 1.7, `hauteur ${box.max.y - ground}`);

  // Pas de contact caisse-roue au repos. La boîte d'une roue déborde d'un passage de roue arrondi par ses coins,
  // alors on teste son vrai volume, le cylindre, sur des points répartis dans chaque triangle.
  // ponytail: échantillonnage 8x8, un test triangle-cylindre exact si un contact fin échappe un jour à ce filet.
  for (let t = 0; t < positions.length; t += 9) {
    const vertex = (k: number): number[] => [
      positions[t + k * 3],
      positions[t + k * 3 + 1],
      positions[t + k * 3 + 2],
    ];
    const [a, b, c] = [vertex(0), vertex(1), vertex(2)];
    for (let u = 0; u <= 8; u++) {
      for (let v = 0; v <= 8 - u; v++) {
        const [p, q] = [u / 8, v / 8];
        const point = a.map(
          (value, axis) => value * (1 - p - q) + b[axis] * p + c[axis] * q,
        );
        car.wheels.forEach((wheel, i) => {
          const axle = wheelAxle(carConfig, i);
          const inside =
            Math.abs(point[0] - wheel.position.x) < axle.wheelWidth / 2 &&
            Math.hypot(
              point[1] - wheel.position.y,
              point[2] - wheel.position.z,
            ) < axle.wheelRadius;
          assert.ok(!inside, `caisse dans la roue ${i} en ${point.join(", ")}`);
        });
      }
    }
  }
};

export default check;
