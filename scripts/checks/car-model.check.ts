import assert from "node:assert/strict";
import type { BufferGeometry } from "three";
import {
  buildCarGeometry,
  type CarGeometry,
} from "../../src/render/car/buildCarGeometry";
import {
  type FlagFacet,
  FLAGS,
  FACET_SHADE,
  flagFacets,
  loadFlagFacets,
  NO_FLAG,
  paintFacets,
} from "../../src/render/car/flags";
import {
  defaultLivery,
  type Livery,
  parseLivery,
} from "../../src/render/car/livery";
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
    ...defaultLivery,
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

  // Livrée stockée : valide relue telle quelle, le reste retombe sur l'origine
  assert.deepEqual(parseLivery(JSON.stringify(otherLivery)), otherLivery);
  for (const raw of [null, "{cassé", "null", "42"]) {
    assert.deepEqual(parseLivery(raw), defaultLivery);
  }
  assert.deepEqual(
    parseLivery(
      JSON.stringify({ primary: "#112233", rim: "rouge", accent: 3 }),
    ),
    { ...defaultLivery, primary: "#112233" },
  );

  // Plaque et numéro : valides relus tels quels, le reste retombe sur l'origine
  const decals = {
    plateText: "AB-123-CD",
    plateStyle: "jaune",
    numberText: "7",
    numberStyle: "rond",
  } as const;
  assert.deepEqual(parseLivery(JSON.stringify(decals)), {
    ...defaultLivery,
    ...decals,
  });
  assert.deepEqual(
    parseLivery(
      JSON.stringify({
        plateText: "bien trop long pour une plaque",
        plateStyle: "inconnu",
        numberText: "A1",
        numberStyle: 3,
      }),
    ),
    defaultLivery,
  );

  // Drapeau stocké : un code connu relu tel quel, le reste retombe sur l'origine
  assert.equal(parseLivery(JSON.stringify({ flag: "BR" })).flag, "BR");
  assert.equal(
    parseLivery(JSON.stringify({ flag: "XX" })).flag,
    defaultLivery.flag,
  );

  // Liste des drapeaux : codes uniques et noms français triés
  const ids = FLAGS.map(({ id }) => id);
  assert.ok(FLAGS.length > 200, `${FLAGS.length} drapeaux`);
  assert.equal(new Set(ids).size, ids.length);
  for (const code of ["FR", "BR", "US"]) assert.ok(ids.includes(code), code);
  assert.equal(FLAGS.find(({ id }) => id === "BR")?.label, "Brésil");

  // « Sans drapeau » : première case, avant l'Afghanistan, stockable et sans facette à dessiner
  assert.equal(FLAGS[0].id, NO_FLAG);
  assert.equal(FLAGS[1].id, "AF");
  assert.equal(parseLivery(JSON.stringify({ flag: NO_FLAG })).flag, NO_FLAG);
  assert.deepEqual(await loadFlagFacets(NO_FLAG), []);

  // Low-poly : 2 triangles par cellule, des couleurs franches, et un détail fin qui disparaît
  const [width, height] = [24, 24];
  const image = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Fond rouge coupé d'une ligne blanche d'un pixel, moitié basse bleue
      const color =
        y >= 12 ? [0, 0, 248] : y === 3 ? [248, 248, 248] : [248, 0, 0];
      image.set([...color, 255], (y * width + x) * 4);
    }
  }
  const facets = flagFacets(image, width, height, 2, 2);
  assert.equal(facets.length, 8);
  const isFacet = (facet: FlagFacet, r: number, g: number, b: number) =>
    [1, FACET_SHADE].some((shade) =>
      [r, g, b].every((c, i) => facet[i] === Math.round(c * shade)),
    );
  const has = (r: number, g: number, b: number): boolean =>
    facets.some((facet) => isFacet(facet, r, g, b));
  assert.ok(has(252, 4, 4), "pas de rouge franc");
  assert.ok(has(4, 4, 252), "pas de bleu franc");
  assert.ok(!has(252, 252, 252), "le détail fin devrait disparaître");

  // Peinture : chaque pixel prend le triangle qui le couvre, opaque ; sans facette, l'image reste transparente
  const painted = new Uint8ClampedArray(width * height * 4);
  paintFacets(painted, width, height, facets, 2, 2);
  const pixel = (x: number, y: number) =>
    painted.slice((y * width + x) * 4, (y * width + x) * 4 + 4);
  assert.ok(
    painted.every((c, i) => i % 4 !== 3 || c === 255),
    "pixel non opaque",
  );
  const [red, blue] = [pixel(12, 3), pixel(12, 20)];
  assert.ok(
    isFacet([red[0], red[1], red[2]], 252, 4, 4),
    "ligne fine repeinte",
  );
  assert.ok(isFacet([blue[0], blue[1], blue[2]], 4, 4, 252), "moitié basse");
  const empty = new Uint8ClampedArray(16);
  paintFacets(empty, 2, 2, []);
  assert.ok(empty.every((c) => c === 0));

  // Plaques, numéros (portières et capot) et drapeaux : tournés vers l'extérieur de la voiture
  for (const [decal, quads] of [
    [car.plates, 2],
    [car.numbers, 3],
    [car.flags, 2],
  ] as const) {
    assert.equal(decal.getAttribute("position").count, quads * 4);
    assert.ok(positionsOf(decal).every(Number.isFinite), "position non finie");
    const normals = decal.getAttribute("normal");
    const positions = decal.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const position = [
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i),
      ];
      const normal = [normals.getX(i), normals.getY(i), normals.getZ(i)];
      assert.ok(
        position.reduce((sum, p, axis) => sum + p * normal[axis], 0) > 0,
        "décor tourné vers l'intérieur",
      );
    }
  }

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
