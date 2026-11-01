import { BufferAttribute, BufferGeometry } from "three";
import {
  createMeshBuilder,
  type Rgb,
  rgb,
  type V3,
} from "@/render/car/meshBuilder";

// Tente d'assistance autour de la voiture. Origine au sol, au centre du plateau tournant.
// Aucun élément haut ne doit entrer dans la zone que la caméra peut parcourir : voir `garage.check.ts`.

type Builder = ReturnType<typeof createMeshBuilder>;
export type Quad = readonly [V3, V3, V3, V3];

export interface GarageColors {
  accent: string;
  rim: string;
}

export const GARAGE_CAMERA = {
  target: [0, 0.6, 0],
  minDistance: 3,
  maxDistance: 7,
  minPolarAngle: 1,
  maxPolarAngle: Math.PI / 2 - 0.02,
} as const;

/** Sous cette hauteur, un objet reste sous la caméra, même au ras du sol. */
export const LOW_PROP_HEIGHT = 0.6;

const HALF_X = 8.6;
const HALF_Z = 10.8;
const EAVE = 4.6;
const RIDGE = 5.6;
const BAYS = 6;
const DOOR_HALF = 4.4;
const DOOR_TOP = 3.4;
const OUTSIDE = 7;
const WORK_HALF_X = 4.4;
const WORK_HALF_Z = 5.6;

const CONCRETE = rgb("#7e7f7b");
const WALL = rgb("#f4f5f0");
const SKIRT = rgb("#9a9ea2");
const ROOF = rgb("#d6d8d6");
const STEEL = rgb("#8d9196");
const DARK_STEEL = rgb("#3d4146");
const BLACK = rgb("#1c1e21");
const TYRE = rgb("#17181a");
const TARP = rgb("#6d757e");
const CARTON = rgb("#a9825a");
const LED = rgb("#35e07a");
const JACK = rgb("#b5261e");
const AIR_HOSE = rgb("#e0ad14");
const OIL_HOSE = rgb("#26578f");
const TUBE = rgb("#ffffff");
const BULB = rgb("#ffc56b");
const ARCADE_SCREEN = rgb("#3f9be8");

const shade = ([r, g, b]: Rgb, k: number): Rgb => [r * k, g * k, b * k];
/** Variation fixe d'une dalle à l'autre : le décor reste le même à chaque visite. */
const tileShade = (i: number, j: number): number =>
  0.94 + (((i * 7 + j * 13) % 5) + 5) * 0.008;

/** Rectangle mural, `right` étant la droite de celui qui le regarde depuis l'intérieur. */
const wallQuad = (
  [x, y, z]: V3,
  width: number,
  height: number,
  [rightX, rightZ]: readonly [number, number],
): Quad => {
  const dx = (rightX * width) / 2;
  const dz = (rightZ * width) / 2;
  const top = y + height / 2;
  const bottom = y - height / 2;
  return [
    [x - dx, bottom, z - dz],
    [x + dx, bottom, z + dz],
    [x + dx, top, z + dz],
    [x - dx, top, z - dz],
  ];
};

export const GARAGE_BANNER = wallQuad(
  [0, 3.1, HALF_Z - 0.04],
  10,
  1.4,
  [-1, 0],
);
export const GARAGE_PLAQUES = wallQuad(
  [-HALF_X + 0.04, 2.95, 1.8],
  3.3,
  1.2,
  [0, -1],
);

const LOGO_Z = -1.8;
const LOGO_Y = 2.75;
const LOGO_SIZE = 2.4;
/** Emplacement du logo du jeu : mur gauche, en face de l'écran. */
export const GARAGE_LOGO = wallQuad(
  [-HALF_X + 0.09, LOGO_Y, LOGO_Z],
  LOGO_SIZE,
  LOGO_SIZE,
  [0, -1],
);

const SCREEN_CENTER: V3 = [HALF_X - 0.41, 3, 0];
const SCREEN_WIDTH = 2.4;
const SCREEN_HEIGHT = 1.35;
export const GARAGE_SCREEN = wallQuad(
  SCREEN_CENTER,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  [0, 1],
);

const CLOTH_X = HALF_X - 0.22;
const CLOTH_TOP = 4.05;
const CLOTH_WIDTH = 3;
const CLOTH_HEIGHT = 2;
export const GARAGE_FLAG_Z = -5.4;
export const GARAGE_NUMBER_Z = 5.4;

/**
 * Toile suspendue contre la paroi droite : plis qui s'ouvrent vers le bas, ourlet ondulé.
 * Les plis ne reçoivent pas la lumière de ce côté, leur ombrage est donc inscrit dans les couleurs.
 */
export const buildClothGeometry = (center: number): BufferGeometry => {
  const columns = 60;
  const rows = 6;
  const point = (u: number, v: number): V3 => {
    const hang = 1 - v;
    const fold = Math.sin(u * Math.PI * 10 + 0.6);
    return [
      CLOTH_X - fold * (0.03 + 0.08 * hang),
      CLOTH_TOP - CLOTH_HEIGHT * hang - 0.05 * hang * Math.sin(u * Math.PI * 6),
      center + (u - 0.5) * CLOTH_WIDTH,
    ];
  };
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const [u0, u1] = [i / columns, (i + 1) / columns];
      const [v0, v1] = [j / rows, (j + 1) / rows];
      const a = point(u0, v0);
      const b = point(u1, v0);
      const c = point(u1, v1);
      const d = point(u0, v1);
      // Pente du pli sur la largeur : un versant clair, un versant sombre.
      const slope = (b[0] - a[0] + c[0] - d[0]) / 2 / (b[2] - a[2]);
      const light = Math.min(1.08, Math.max(0.58, 0.86 + slope * 0.9));
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      for (let k = 0; k < 6; k++) colors.push(light, light, light);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(colors), 3),
  );
  return geometry;
};

const buildShell = (b: Builder): void => {
  const tile = 2;
  const columns = Math.ceil(HALF_X / tile);
  const rows = Math.ceil(HALF_Z / tile);
  for (let i = -columns; i < columns; i++) {
    for (let j = -rows; j < rows; j++) {
      const x0 = Math.max(i * tile, -HALF_X);
      const x1 = Math.min((i + 1) * tile, HALF_X);
      const z0 = Math.max(j * tile, -HALF_Z);
      const z1 = Math.min((j + 1) * tile, HALF_Z);
      b.face(
        [
          [x0, 0, z0],
          [x1, 0, z0],
          [x1, 0, z1],
          [x0, 0, z1],
        ],
        shade(CONCRETE, tileShade(i, j)),
        [0, 1, 0],
      );
    }
  }
  // Sol de nuit devant l'ouverture
  b.face(
    [
      [-HALF_X - OUTSIDE, 0, -HALF_Z],
      [HALF_X + OUTSIDE, 0, -HALF_Z],
      [HALF_X + OUTSIDE, 0, -HALF_Z - OUTSIDE],
      [-HALF_X - OUTSIDE, 0, -HALF_Z - OUTSIDE],
    ],
    rgb("#15171b"),
    [0, 1, 0],
  );

  const roofY = (x: number): number =>
    RIDGE - (Math.abs(x) / HALF_X) * (RIDGE - EAVE);

  for (let k = 0; k < BAYS; k++) {
    const z0 = -HALF_Z + (k * 2 * HALF_Z) / BAYS;
    const z1 = -HALF_Z + ((k + 1) * 2 * HALF_Z) / BAYS;
    const tint = k % 2 === 0 ? 1 : 0.95;
    for (const side of [-1, 1]) {
      const x = side * HALF_X;
      const out: V3 = [-side, 0, 0];
      b.face(
        [
          [x, 0, z0],
          [x, 0.5, z0],
          [x, 0.5, z1],
          [x, 0, z1],
        ],
        SKIRT,
        out,
      );
      b.face(
        [
          [x, 0.5, z0],
          [x, EAVE, z0],
          [x, EAVE, z1],
          [x, 0.5, z1],
        ],
        shade(WALL, tint),
        out,
      );
      b.face(
        [
          [x, EAVE, z0],
          [0, RIDGE, z0],
          [0, RIDGE, z1],
          [x, EAVE, z1],
        ],
        shade(ROOF, tint),
        [0, -1, 0],
      );
    }
  }

  // Pignons : plein au fond, percé de l'ouverture devant le capot
  for (const side of [-1, 1]) {
    for (const z of [HALF_Z, -HALF_Z]) {
      b.face(
        [
          [side * HALF_X, EAVE, z],
          [0, EAVE, z],
          [0, RIDGE, z],
        ],
        WALL,
        [0, 0, -Math.sign(z)],
      );
    }
    b.box([side * HALF_X - 0.001, 0, HALF_Z], [0, 0.5, HALF_Z + 0.01], SKIRT);
    b.face(
      [
        [side * HALF_X, 0.5, HALF_Z],
        [side * HALF_X, EAVE, HALF_Z],
        [0, EAVE, HALF_Z],
        [0, 0.5, HALF_Z],
      ],
      WALL,
      [0, 0, -1],
    );
    const door = side * DOOR_HALF;
    b.face(
      [
        [side * HALF_X, 0, -HALF_Z],
        [side * HALF_X, EAVE, -HALF_Z],
        [door, EAVE, -HALF_Z],
        [door, 0, -HALF_Z],
      ],
      WALL,
      [0, 0, 1],
    );
    b.face(
      [
        [door, DOOR_TOP, -HALF_Z],
        [door, EAVE, -HALF_Z],
        [0, EAVE, -HALF_Z],
        [0, DOOR_TOP, -HALF_Z],
      ],
      WALL,
      [0, 0, 1],
    );
    // Montants de l'ouverture
    b.box(
      [door - 0.12, 0, -HALF_Z],
      [door + 0.12, DOOR_TOP, -HALF_Z + 0.16],
      DARK_STEEL,
    );
  }
  b.box(
    [-DOOR_HALF, DOOR_TOP - 0.12, -HALF_Z],
    [DOOR_HALF, DOOR_TOP + 0.12, -HALF_Z + 0.16],
    DARK_STEEL,
  );

  // Ossature
  for (let k = 0; k <= BAYS; k++) {
    const z = -HALF_Z + (k * 2 * HALF_Z) / BAYS;
    for (const side of [-1, 1]) {
      const x0 = side * HALF_X;
      b.box([x0 - 0.14 * side, 0, z - 0.09], [x0, EAVE, z + 0.09], STEEL);
    }
    b.box(
      [-HALF_X, EAVE, z - 0.07],
      [HALF_X, EAVE + 0.16, z + 0.07],
      DARK_STEEL,
    );
  }
  for (const x of [-HALF_X / 2, 0, HALF_X / 2]) {
    const y = roofY(x);
    b.box([x - 0.06, y - 0.16, -HALF_Z], [x + 0.06, y - 0.02, HALF_Z], STEEL);
  }
};

/** Rangées de néons dans le sens de la tente, et boîtiers sombres au-dessus. */
const buildLights = (b: Builder, glow: Builder): void => {
  const y = 4.44;
  for (const x of [-5.2, -1.8, 1.8, 5.2]) {
    for (let z = -9; z < 9; z += 2.3) {
      glow.box([x - 0.06, y, z], [x + 0.06, y + 0.05, z + 1.9], TUBE);
      b.box(
        [x - 0.12, y + 0.05, z - 0.04],
        [x + 0.12, EAVE, z + 1.94],
        DARK_STEEL,
      );
    }
  }
  // Guirlandes dehors, seules lumières de la nuit
  for (const [z, top, half] of [
    [-HALF_Z - 1.4, 3, 4],
    [-HALF_Z - 4.8, 4, 7],
  ] as const) {
    for (let x = -half; x <= half; x += 0.55) {
      const sag = top - 0.5 * (1 - (x / half) ** 2);
      glow.box(
        [x - 0.04, sag - 0.04, z - 0.04],
        [x + 0.04, sag + 0.04, z + 0.04],
        BULB,
      );
    }
  }
};

const buildFloorMarks = (b: Builder, accent: Rgb): void => {
  const plane = (x0: number, z0: number, x1: number, z1: number, y: number) =>
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ] as const;

  // Bâche froissée sous la voiture
  const panel = 1.1;
  const columns = Math.round((2 * WORK_HALF_X) / panel);
  const rows = Math.round((2 * WORK_HALF_Z) / panel);
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const x0 = -WORK_HALF_X + i * panel;
      const z0 = -WORK_HALF_Z + j * panel;
      b.face(
        plane(x0, z0, x0 + panel, z0 + panel, 0.012),
        shade(TARP, tileShade(i * 3, j * 2)),
        [0, 1, 0],
      );
    }
  }

  // Marquage de la zone de travail
  const line = 0.1;
  const X = WORK_HALF_X + line;
  const Z = WORK_HALF_Z + line;
  const y = 0.02;
  b.face(plane(-X, -Z, X, -WORK_HALF_Z, y), accent, [0, 1, 0]);
  b.face(plane(-X, WORK_HALF_Z, X, Z, y), accent, [0, 1, 0]);
  b.face(
    plane(-X, -WORK_HALF_Z, -WORK_HALF_X, WORK_HALF_Z, y),
    accent,
    [0, 1, 0],
  );
  b.face(
    plane(WORK_HALF_X, -WORK_HALF_Z, X, WORK_HALF_Z, y),
    accent,
    [0, 1, 0],
  );
};

/** Tiroirs ouverts : [armoire, tiroir en partant du bas, sortie en mètres]. */
const OPEN_DRAWERS: readonly (readonly [number, number, number])[] = [
  [-5, 1, 0.34],
  [-4, 3, 0.26],
  [-2, 0, 0.38],
  [-1, 2, 0.3],
  [1, 3, 0.36],
  [2, 1, 0.22],
  [4, 1, 0.34],
];

/** Tiroir sorti : un bac creux, avec quelques outils dedans. */
const openDrawer = (
  b: Builder,
  front: number,
  y: number,
  height: number,
  z0: number,
  z1: number,
  travel: number,
  accent: Rgb,
): void => {
  const out = front - travel;
  const left = z0 + 0.03;
  const right = z1 - 0.03;
  const top = y + height - 0.03;
  const wall = 0.012;
  // Logement sombre dans l'armoire
  b.box([front - 0.002, y, left], [front, top, right], BLACK);
  b.box([out, y + 0.02, left + 0.02], [front, y + 0.03, right - 0.02], BLACK);
  for (const side of [left + 0.02, right - 0.02 - wall]) {
    b.box([out, y + 0.02, side], [front, top - 0.03, side + wall], STEEL);
  }
  b.box([out - 0.015, y, left], [out, top, right], shade(DARK_STEEL, 1.5));
  b.box(
    [out - 0.04, top - 0.07, z0 + 0.2],
    [out - 0.015, top - 0.04, z1 - 0.2],
    accent,
  );
  const tools = Math.floor((right - left - 0.1) / 0.17);
  for (let k = 0; k < tools; k++) {
    const z = left + 0.08 + k * 0.17;
    const length = Math.min(travel - 0.04, 0.12 + ((k * 5) % 4) * 0.05);
    b.box(
      [out + 0.02, y + 0.03, z],
      [out + 0.02 + length, y + 0.05, z + 0.06],
      k % 3 === 1 ? accent : STEEL,
    );
  }
};

/** Armoires basses le long de la paroi droite. */
const buildCabinets = (b: Builder, accent: Rgb): void => {
  const front = 7.72;
  const back = HALF_X - 0.14;
  const width = 1.12;
  for (let k = -6; k < 5; k++) {
    const z0 = k * width + 0.02;
    const z1 = (k + 1) * width - 0.02;
    b.box([front + 0.04, 0, z0], [back, 0.08, z1], BLACK);
    b.box([front, 0.08, z0], [back, 1, z1], DARK_STEEL);
    b.box([front - 0.03, 1, z0 - 0.02], [back, 1.04, z1 + 0.02], STEEL);
    const drawers = k % 2 === 0 ? 3 : 4;
    const height = 0.86 / drawers;
    for (let d = 0; d < drawers; d++) {
      const y = 0.12 + d * height;
      const open = OPEN_DRAWERS.find(([c, drawer]) => c === k && drawer === d);
      if (open) {
        openDrawer(b, front, y, height, z0, z1, open[2], accent);
        continue;
      }
      b.box(
        [front - 0.015, y, z0 + 0.03],
        [front, y + height - 0.03, z1 - 0.03],
        shade(DARK_STEEL, 1.5),
      );
      b.box(
        [front - 0.04, y + height - 0.1, z0 + 0.2],
        [front - 0.015, y + height - 0.07, z1 - 0.2],
        accent,
      );
    }
  }
  // Bidons posés dessus
  for (const [z, color] of [
    [-3.6, "#c9c7bd"],
    [-3.3, "#c9c7bd"],
    [2.5, "#b5261e"],
  ] as const) {
    b.box([8.05, 1.04, z], [8.3, 1.36, z + 0.2], rgb(color));
    b.box([8.14, 1.36, z + 0.06], [8.21, 1.41, z + 0.14], BLACK);
  }
};

/** Roue de rechange couchée, jante aux couleurs de la voiture. */
const wheelStack = (
  b: Builder,
  x: number,
  z: number,
  count: number,
  rim: Rgb,
): void => {
  const halfWidth = 0.125;
  const inner = 0.2;
  const outer = 0.34;
  for (let k = 0; k < count; k++) {
    b.lathe(
      "y",
      [x, halfWidth + k * 2 * halfWidth, z],
      1,
      [
        [-halfWidth, 0],
        [-halfWidth, inner],
        [-halfWidth, outer - 0.03],
        [-halfWidth + 0.03, outer],
        [halfWidth - 0.03, outer],
        [halfWidth, outer - 0.03],
        [halfWidth, inner],
        [halfWidth, 0],
      ],
      [rim, TYRE, TYRE, TYRE, TYRE, TYRE, rim],
      10,
    );
  }
};

const flightCase = (
  b: Builder,
  [x, y, z]: V3,
  width: number,
  height: number,
  depth: number,
): void => {
  b.box([x, y, z], [x + width, y + height, z + depth], BLACK);
  const corner = 0.05;
  for (const cx of [x - 0.005, x + width - corner + 0.005]) {
    for (const cz of [z - 0.005, z + depth - corner + 0.005]) {
      b.box([cx, y, cz], [cx + corner, y + height, cz + corner], STEEL);
    }
  }
  b.box(
    [x - 0.006, y + height * 0.7, z - 0.006],
    [x + width + 0.006, y + height * 0.7 + 0.03, z + depth + 0.006],
    STEEL,
  );
};

/** Valise à outils ouverte contre le fond, couvercle debout. */
const buildToolCase = (b: Builder, x: number, accent: Rgb): void => {
  const z = HALF_Z - 0.75;
  b.box([x - 0.85, 0, z], [x + 0.85, 0.42, z + 0.55], BLACK);
  b.box([x - 0.85, 0.42, z + 0.42], [x + 0.85, 1.6, z + 0.55], BLACK);
  b.box([x - 0.78, 0.48, z + 0.4], [x + 0.78, 1.54, z + 0.42], accent);
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 11; k++) {
      const length = 0.1 + ((k * 3 + row) % 4) * 0.04;
      const left = x - 0.72 + k * 0.13;
      const top = 1.47 - row * 0.25;
      b.box(
        [left, top - length, z + 0.385],
        [left + 0.05, top, z + 0.4],
        k % 3 === 0 ? DARK_STEEL : STEEL,
      );
    }
  }
};

/** Chandelle pyramidale, sous la limite des petits objets. */
const jackStand = (b: Builder, x: number, z: number): void => {
  const base = 0.15;
  const neck = 0.045;
  const y0 = 0.03;
  const y1 = 0.38;
  b.box([x - base, 0, z - base], [x + base, y0, z + base], DARK_STEEL);
  for (const [sx, sz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const edge = (half: number, y: number): [V3, V3] => {
      const c: V3 = [x + sx * half, y, z + sz * half];
      const dx = sz * half;
      const dz = sx * half;
      return [
        [c[0] - dx, y, c[2] - dz],
        [c[0] + dx, y, c[2] + dz],
      ];
    };
    const [a, d] = edge(base * 0.8, y0);
    const [b1, c1] = edge(neck, y1);
    b.face([a, d, c1, b1], STEEL, [sx, 0.3, sz]);
  }
  b.box([x - 0.025, y1, z - 0.025], [x + 0.025, 0.5, z + 0.025], DARK_STEEL);
  b.box([x - 0.05, 0.5, z - 0.05], [x + 0.05, 0.53, z + 0.05], JACK);
};

/** Cric rouleur : châssis bas et long manche incliné. */
const trolleyJack = (b: Builder, x: number, z: number): void => {
  b.box([x - 0.14, 0.05, z], [x + 0.14, 0.17, z + 0.62], JACK);
  b.box([x - 0.06, 0.17, z + 0.02], [x + 0.06, 0.27, z + 0.12], BLACK);
  for (const side of [-1, 1]) {
    b.box(
      [x + side * 0.14, 0, z + 0.48],
      [x + side * 0.19, 0.1, z + 0.58],
      BLACK,
    );
  }
  const handle: V3[] = [
    [x - 0.02, 0.17, z + 0.62],
    [x + 0.02, 0.17, z + 0.62],
    [x + 0.02, 0.52, z + 1.55],
    [x - 0.02, 0.52, z + 1.55],
  ];
  b.face(handle, BLACK, [0, 1, -0.3]);
};

/** Écran fixé au poteau central : cadre en relief, dalle en retrait, voyant allumé. */
const buildScreenMount = (b: Builder, glow: Builder): void => {
  const [x, y, z] = SCREEN_CENTER;
  const halfZ = SCREEN_WIDTH / 2;
  const halfY = SCREEN_HEIGHT / 2;
  const frame = 0.06;
  const chin = 0.1;
  const back = x + 0.14;
  const lip = x - 0.035;
  const bottom = y - halfY - chin;
  const top = y + halfY + frame;
  const zMin = z - halfZ - frame;
  const zMax = z + halfZ + frame;
  b.box([x + 0.005, bottom, zMin], [back, top, zMax], BLACK);
  b.box([lip, y + halfY, zMin], [x + 0.005, top, zMax], BLACK);
  b.box([lip, bottom, zMin], [x + 0.005, y - halfY, zMax], BLACK);
  for (const edge of [zMin, z + halfZ]) {
    b.box([lip, y - halfY, edge], [x + 0.005, y + halfY, edge + frame], BLACK);
  }
  // Bras de fixation sur le poteau
  b.box(
    [back, y - 0.2, z - 0.09],
    [HALF_X - 0.14, y + 0.2, z + 0.09],
    DARK_STEEL,
  );
  glow.box(
    [lip - 0.005, bottom + 0.04, z + halfZ - 0.1],
    [lip, bottom + 0.06, z + halfZ - 0.06],
    LED,
  );
};

/** Tringle de toile, tenue au mur par deux équerres. */
const buildClothRod = (b: Builder, z: number): void => {
  const half = CLOTH_WIDTH / 2 + 0.06;
  b.box(
    [CLOTH_X - 0.03, CLOTH_TOP - 0.02, z - half],
    [CLOTH_X + 0.03, CLOTH_TOP + 0.04, z + half],
    DARK_STEEL,
  );
  for (const side of [-1, 1]) {
    const bracket = z + side * (half - 0.2);
    b.box(
      [CLOTH_X, CLOTH_TOP - 0.01, bracket - 0.03],
      [HALF_X, CLOTH_TOP + 0.03, bracket + 0.03],
      DARK_STEEL,
    );
  }
};

interface ShelfSpec {
  /** Côté de la paroi : -1 à gauche, 1 à droite */
  side: number;
  z0: number;
  z1: number;
  height: number;
  /** Décale le contenu, pour que deux étagères ne se ressemblent pas */
  seed: number;
}

/** Étagère métallique contre une paroi latérale, garnie sans hasard pour rester la même à chaque visite. */
const buildShelf = (
  b: Builder,
  { side, z0, z1, height, seed }: ShelfSpec,
  accent: Rgb,
): void => {
  const depth = 0.6;
  const near = side * (HALF_X - 0.02 - depth);
  const far = side * (HALF_X - 0.02);
  const [x0, x1] = [Math.min(near, far), Math.max(near, far)];
  const mid = (x0 + x1) / 2;
  const levels = Math.round(height / 0.55);
  const step = height / levels;
  const post = 0.05;
  for (const x of [x0, x1 - post]) {
    for (const z of [z0, z1 - post]) {
      b.box([x, 0, z], [x + post, height, z + post], DARK_STEEL);
    }
  }
  for (let level = 0; level < levels; level++) {
    const y = 0.1 + level * step;
    b.box([x0, y - 0.03, z0], [x1, y, z1], STEEL);

    let z = z0 + 0.1;
    let slot = seed + level * 3;
    while (z < z1 - 0.6) {
      const kind = (slot * 5 + level) % 6;
      let used = 0.22; // Place libre : une étagère trop pleine ferait dépôt
      if (kind <= 1) {
        // Carton, avec sa bande d'adhésif
        const h = 0.26 + (slot % 3) * 0.05;
        used = 0.42;
        b.box(
          [mid - 0.2, y, z],
          [mid + 0.2, y + h, z + used],
          shade(CARTON, 0.9 + (slot % 3) * 0.08),
        );
        b.box(
          [mid - 0.205, y + h - 0.012, z + 0.17],
          [mid + 0.205, y + h + 0.002, z + 0.25],
          shade(CARTON, 1.35),
        );
      } else if (kind === 2) {
        // Bidons d'huile
        used = 0.54;
        const color = rgb(slot % 2 === 0 ? "#b5261e" : "#2f5fa8");
        for (let k = 0; k < 3; k++) {
          const left = z + k * 0.18;
          b.box(
            [mid - 0.07, y, left],
            [mid + 0.07, y + 0.26, left + 0.14],
            color,
          );
          b.box(
            [mid - 0.025, y + 0.26, left + 0.05],
            [mid + 0.025, y + 0.3, left + 0.09],
            BLACK,
          );
        }
      } else if (kind === 3) {
        // Mallette aux couleurs de l'équipe
        used = 0.5;
        b.box([mid - 0.16, y, z], [mid + 0.16, y + 0.2, z + used], BLACK);
        b.box(
          [mid - 0.165, y + 0.09, z],
          [mid + 0.165, y + 0.12, z + used],
          accent,
        );
      } else if (kind === 4) {
        // Disques de frein empilés
        used = 0.4;
        for (let k = 0; k < 3; k++) {
          b.lathe(
            "y",
            [mid, y + 0.03 + k * 0.05, z + 0.2],
            1,
            [
              [-0.02, 0],
              [-0.02, 0.17],
              [0.02, 0.17],
              [0.02, 0],
            ],
            [DARK_STEEL, STEEL, STEEL],
            10,
          );
        }
      }
      z += used + 0.07;
      slot++;
    }
  }
};

/** Coupe sur socle, posée à l'altitude `y`. `size` = 1 mesure 34 cm de haut. */
const trophy = (b: Builder, [x, y, z]: V3, size: number, metal: Rgb): void => {
  const at = (d: number): number => d * size;
  const socle = rgb("#2a1d14");
  b.lathe(
    "y",
    [x, y, z],
    1,
    [
      [0, 0],
      [0, at(0.075)],
      [at(0.04), at(0.075)],
      [at(0.04), at(0.022)],
      [at(0.13), at(0.022)],
      [at(0.15), at(0.035)],
      [at(0.25), at(0.08)],
      [at(0.34), at(0.09)],
      [at(0.34), 0],
    ],
    [socle, socle, socle, metal, metal, metal, metal, shade(metal, 0.5)],
    8,
  );
  // Anses, dans l'axe du mur pour rester visibles depuis la voiture
  const near = at(0.07);
  const far = at(0.125);
  const thick = at(0.012);
  for (const side of [-1, 1]) {
    b.box(
      [x - thick, y + at(0.2), z + side * far],
      [x + thick, y + at(0.31), z + side * (far - 2 * thick)],
      metal,
    );
    for (const height of [0.2, 0.3]) {
      b.box(
        [x - thick, y + at(height), z + side * near],
        [x + thick, y + at(height) + 2 * thick, z + side * far],
        metal,
      );
    }
  }
};

/** Trophées alignés sur les armoires, sous le drapeau. */
const buildTrophies = (b: Builder): void => {
  const gold = rgb("#d9a441");
  const silver = rgb("#c5c9cf");
  const bronze = rgb("#a9683a");
  for (const [offset, size, metal] of [
    [-1.15, 0.95, bronze],
    [-0.75, 1.15, silver],
    [-0.35, 1.35, gold],
    [0.05, 1.6, gold],
    [0.45, 1.35, silver],
    [0.85, 1.15, silver],
    [1.2, 0.95, bronze],
  ] as const) {
    trophy(b, [8.12, 1.04, GARAGE_FLAG_Z + offset], size, metal);
  }
};

/** Tuyau posé au sol : une section hexagonale balayée le long du tracé. */
const hose = (
  b: Builder,
  at: (t: number) => readonly [number, number],
  color: Rgb,
): void => {
  const radius = 0.032;
  const steps = 48;
  const sides = 6;
  const ring = (t: number): V3[] => {
    const [x, z] = at(t);
    const [x1, z1] = at(t + 0.002);
    const length = Math.hypot(x1 - x, z1 - z);
    const nx = -(z1 - z) / length;
    const nz = (x1 - x) / length;
    return Array.from({ length: sides }, (_, k) => {
      const angle = (k / sides) * Math.PI * 2;
      const side = Math.cos(angle) * radius;
      return [
        x + nx * side,
        0.03 + radius + Math.sin(angle) * radius,
        z + nz * side,
      ];
    });
  };
  for (let i = 0; i < steps; i++) {
    const a = ring(i / steps);
    const c = ring((i + 1) / steps);
    for (let k = 0; k < sides; k++) {
      const next = (k + 1) % sides;
      const [cx, cz] = at((i + 0.5) / steps);
      const middle = a[k];
      b.face([a[k], a[next], c[next], c[k]], color, [
        middle[0] - cx,
        middle[1] - (0.03 + radius),
        middle[2] - cz,
      ]);
    }
  }
};

const buildHoses = (b: Builder): void => {
  // Air comprimé, depuis le fond de la tente
  hose(
    b,
    (t) => [
      6.4 - 3 * t + 0.7 * Math.sin(t * 9),
      HALF_Z - 0.3 - 6 * t + 0.5 * Math.cos(t * 7),
    ],
    AIR_HOSE,
  );
  // Vidange, depuis les armoires
  hose(
    b,
    (t) => [7.55 - 3.2 * t, -2.3 - 0.9 * t + 0.45 * Math.sin(t * 8)],
    OIL_HOSE,
  );
};

/** Borne d'arcade, sans marque, dans le coin du fond. */
const buildArcade = (
  b: Builder,
  glow: Builder,
  x: number,
  z: number,
  accent: Rgb,
): void => {
  b.box([x, 0, z], [x + 0.8, 1, z + 0.8], BLACK);
  b.box([x, 1, z + 0.3], [x + 0.8, 1.9, z + 0.8], shade(DARK_STEEL, 0.8));
  b.box([x - 0.02, 0.9, z - 0.18], [x + 0.82, 1, z + 0.32], accent);
  b.lathe(
    "z",
    [x + 0.4, 1.12, z + 0.05],
    1,
    [
      [-0.02, 0.09],
      [-0.02, 0.13],
      [0.02, 0.13],
      [0.02, 0.09],
    ],
    [BLACK, BLACK, BLACK],
    10,
  );
  glow.box(
    [x + 0.08, 1.08, z + 0.285],
    [x + 0.72, 1.6, z + 0.3],
    ARCADE_SCREEN,
  );
  glow.box([x, 1.74, z + 0.285], [x + 0.8, 1.9, z + 0.3], accent);
};

export const buildGarageGeometry = ({ accent, rim }: GarageColors) => {
  // La coque reçoit les ombres sans en projeter : sinon le toit plongerait toute la tente dans le noir.
  const shell = createMeshBuilder();
  const props = createMeshBuilder();
  const glow = createMeshBuilder();
  const team = rgb(accent);
  const rimColor = rgb(rim);

  buildShell(shell);
  buildLights(shell, glow);
  buildFloorMarks(shell, team);
  buildCabinets(props, team);
  buildScreenMount(props, glow);
  // Support du logo, un peu plus grand que l'image
  const logoEdge = LOGO_SIZE / 2 + 0.06;
  props.box(
    [-HALF_X, LOGO_Y - logoEdge, LOGO_Z - logoEdge],
    [-HALF_X + 0.08, LOGO_Y + logoEdge, LOGO_Z + logoEdge],
    BLACK,
  );
  buildClothRod(shell, GARAGE_FLAG_Z);
  buildClothRod(shell, GARAGE_NUMBER_Z);
  buildTrophies(props);
  buildHoses(props);

  for (const shelf of [
    { side: -1, z0: -10.4, z1: -7.6, height: 2.3, seed: 1 },
    { side: 1, z0: -10.4, z1: -7.6, height: 2.3, seed: 4 },
    { side: 1, z0: 7.6, z1: 10.4, height: 2.3, seed: 7 },
    { side: -1, z0: 0.5, z1: 3.1, height: 1.75, seed: 11 },
  ])
    buildShelf(props, shelf, team);

  wheelStack(props, -7.9, -5.4, 4, rimColor);
  wheelStack(props, -7.9, -4.5, 5, rimColor);
  wheelStack(props, -7.9, -3.6, 3, rimColor);
  wheelStack(props, -7.9, 4, 5, rimColor);
  wheelStack(props, -7.9, 4.9, 4, rimColor);

  buildToolCase(props, -1.4, team);
  flightCase(props, [2.2, 0, 9.8], 1.1, 0.7, 0.75);
  flightCase(props, [2.25, 0.7, 9.82], 1, 0.55, 0.7);
  flightCase(props, [3.6, 0, 9.8], 0.9, 0.9, 0.75);
  flightCase(props, [-6, 0, 9.8], 1.2, 0.65, 0.75);

  jackStand(props, 4.1, -1.4);
  jackStand(props, 4.1, -0.6);
  jackStand(props, 3.4, 3.6);
  trolleyJack(props, -3.9, 2.2);

  buildArcade(props, glow, -7.8, 9.6, team);

  // Barrière basse à l'entrée, chiffon et bidon au sol
  for (let x = -DOOR_HALF + 0.2; x < DOOR_HALF - 1.8; x += 2.2) {
    props.box([x, 0.95, -HALF_Z - 0.35], [x + 2, 1, -HALF_Z - 0.3], STEEL);
    props.box([x, 0.15, -HALF_Z - 0.35], [x + 2, 0.2, -HALF_Z - 0.3], STEEL);
    for (const post of [x, x + 1.96]) {
      props.box(
        [post, 0, -HALF_Z - 0.35],
        [post + 0.04, 1, -HALF_Z - 0.3],
        STEEL,
      );
    }
  }
  props.face(
    [
      [-3.5, 0.03, -3.5],
      [-3.1, 0.03, -3.6],
      [-3, 0.03, -3.25],
      [-3.45, 0.03, -3.2],
    ],
    rgb("#d8d6cf"),
    [0, 1, 0],
  );
  props.box([-3.9, 0, -4.1], [-3.6, 0.4, -3.85], rgb("#c9c7bd"));

  return {
    shell: shell.toGeometry(),
    props: props.toGeometry(),
    glow: glow.toGeometry(),
  };
};
