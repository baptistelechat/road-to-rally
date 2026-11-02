import type { BufferGeometry } from "three";
import {
  type CarConfig,
  carConfig,
  wheelAxle,
  wheelRestPosition,
} from "@/sim/carConfig";
import { WHEEL_COUNT, type Vec3 } from "@/sim/types";
import { type LiveryColors } from "./livery";
import {
  type Bands,
  createMeshBuilder,
  decalQuads,
  type P2,
  rgb,
  type Rgb,
  type V3,
} from "./meshBuilder";

// Modèle entièrement généré par code. Origine = centre de la caisse physique, avant = -Z, droite = +X.
// Les cotes en hauteur (h) sont données depuis le sol : le sol se déduit des roues de `carConfig`,
// et les passages de roue, ailes et bavettes suivent les positions et rayons de la config.

export interface WheelPart {
  /** Géométrie centrée sur le moyeu, axe de rotation X, jante tournée vers l'extérieur */
  geometry: BufferGeometry;
  /** Disque de frein derrière les branches : il braque avec la roue, mais ne tourne pas */
  disc: BufferGeometry;
  /** Centre de roue au repos dans le repère de la voiture */
  position: Vec3;
}

export interface CarGeometry {
  body: BufferGeometry;
  /** À part pour pouvoir les allumer au freinage */
  brakeLights: BufferGeometry;
  /** À part pour pouvoir les allumer en marche arrière */
  reverseLights: BufferGeometry;
  /** Plaques avant et arrière, à texturer */
  plates: BufferGeometry;
  /** Numéros de portière et de capot, à texturer */
  numbers: BufferGeometry;
  /** Drapeaux de custode, à texturer */
  flags: BufferGeometry;
  /** Dans l'ordre AVG, AVD, ARG, ARD */
  wheels: WheelPart[];
}

// Couleurs hors livrée
const TIRE = rgb("#1b1b1d");
const RIM_FLOOR = rgb("#141416");
const DISC = rgb("#7a7a80");
const PLASTIC = rgb("#26262a");
const WELL = rgb("#0c0c0e");
const GLASS = rgb("#1a2a35");
const LENS = rgb("#fff3c4");
const AMBER = rgb("#e8901c");
const BRAKE_OFF = rgb("#b3231a");
const REVERSE_OFF = rgb("#cfcdc4");
const PLATE = rgb("#f7f4ea");
const INK = rgb("#17171a");

const SIDES = [-1, 1];
const WHEEL_SIDES = 12;
const ARCH_SEGMENTS = 8;
/** Jeu entre le pneu et le passage de roue */
const ARCH_GAP = 0.06;

/** Remontée maximale affichée d'une roue : au-delà, elle traverserait son passage de roue. */
export const maxWheelOffset = (config: CarConfig): number =>
  config.ride.sag + ARCH_GAP - 0.01;

// Cotes depuis le sol
const SILL = 0.24;
const STRIPE_LOW = 0.6;
const STRIPE_HIGH = 0.66;
const BELT = 0.93;
const CABIN_BASE = 0.9;
const ROOF_EDGE = 1.33;
const ROOF_TOP = 1.36;

// Position du pare-brise et du haut de hayon : le long de la voiture, autour du milieu de l'empattement
const WINDSHIELD_BASE = -0.72;
const WINDSHIELD_TOP = -0.2;
const ROOF_REAR = 1.12;

const PLATE_HALF_WIDTH = 0.21;
const DECAL_GAP = 0.004;

// Échappement, côté droit
const EXHAUST = { x: 0.45, h: 0.27, radius: 0.045, inset: 0.1, length: 0.2 };

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const carGroundY = (config: CarConfig): number =>
  Math.min(
    ...Array.from(
      { length: WHEEL_COUNT },
      (_, i) =>
        wheelRestPosition(config, i).y - wheelAxle(config, i).wheelRadius,
    ),
  );

/** Sortie du pot dans le repère de la voiture. */
export const exhaustOutlet = (config: CarConfig = carConfig): Vec3 => ({
  x: EXHAUST.x,
  y: carGroundY(config) + EXHAUST.h,
  z: config.bodyHalfExtents.z - EXHAUST.inset + EXHAUST.length,
});

const buildBrakeDisc = (
  radius: number,
  width: number,
  side: number,
): BufferGeometry => {
  const mesh = createMeshBuilder();
  // Entre le fond de jante (largeur / 2 - 0,05) et les branches.
  const face = width / 2 - 0.038;
  mesh.lathe(
    "x",
    [0, 0, 0],
    side,
    [
      [face, radius * 0.66 - 0.045],
      [face, 0],
    ],
    [DISC],
    WHEEL_SIDES,
  );
  return mesh.toGeometry();
};

const buildWheel = (
  radius: number,
  width: number,
  side: number,
  livery: LiveryColors,
): BufferGeometry => {
  const mesh = createMeshBuilder();
  const rim = rgb(livery.rim);
  const half = width / 2;
  const rimRadius = radius * 0.66;
  const floor = half - 0.05;
  const spokeTop = half - 0.012;

  mesh.lathe(
    "x",
    [0, 0, 0],
    side,
    [
      [-half, 0],
      [-half, radius - 0.02],
      [half - 0.03, radius],
      [half, radius - 0.03],
      [half, rimRadius],
      [half, rimRadius - 0.018],
      [floor, rimRadius - 0.03],
      [floor, 0],
    ],
    [TIRE, TIRE, TIRE, TIRE, rim, rim, RIM_FLOOR],
    WHEEL_SIDES,
  );

  // Cinq branches : c'est elles qui rendent la rotation visible.
  const hub = radius * 0.16;
  const tip = rimRadius - 0.02;
  for (let k = 0; k < 5; k++) {
    const angle = (k / 5) * Math.PI * 2;
    const [c, s] = [Math.cos(angle), Math.sin(angle)];
    const at = (d: number, along: number, across: number): V3 => [
      side * d,
      along * c - across * s,
      along * s + across * c,
    ];
    const [w0, w1] = [0.03, 0.022];
    mesh.face(
      [
        at(spokeTop, hub, -w0),
        at(spokeTop, tip, -w1),
        at(spokeTop, tip, w1),
        at(spokeTop, hub, w0),
      ],
      rim,
      [side, 0, 0],
    );
    for (const flank of [-1, 1]) {
      mesh.face(
        [
          at(floor, hub, flank * w0),
          at(floor, tip, flank * w1),
          at(spokeTop, tip, flank * w1),
          at(spokeTop, hub, flank * w0),
        ],
        rim,
        [0, -s * flank, c * flank],
      );
    }
  }
  mesh.lathe(
    "x",
    [0, 0, 0],
    side,
    [
      [spokeTop, hub],
      [spokeTop, 0],
    ],
    [rim],
    6,
  );
  return mesh.toGeometry();
};

export const buildCarGeometry = (
  livery: LiveryColors,
  config: CarConfig = carConfig,
): CarGeometry => {
  const body = createMeshBuilder();
  const brake = createMeshBuilder();
  const reverse = createMeshBuilder();
  const primary = rgb(livery.primary);
  const secondary = rgb(livery.secondary);
  const accent = rgb(livery.accent);

  const rests = Array.from({ length: WHEEL_COUNT }, (_, i) =>
    wheelRestPosition(config, i),
  );
  const axles = Array.from({ length: WHEEL_COUNT }, (_, i) =>
    wheelAxle(config, i),
  );
  const groundY = carGroundY(config);
  const Y = (h: number): number => groundY + h;

  const nose = -config.bodyHalfExtents.z;
  const tail = config.bodyHalfExtents.z;
  const wheelOuter = Math.max(
    ...rests.map((rest, i) => Math.abs(rest.x) + axles[i].wheelWidth / 2),
  );
  const wheelInner = Math.min(
    ...rests.map((rest, i) => Math.abs(rest.x) - axles[i].wheelWidth / 2),
  );
  const flareX = wheelOuter + 0.015;

  /** Flanc de caisse légèrement rentrant vers le haut */
  const hullX = (h: number): number => wheelOuter - 0.08 - (h - SILL) * 0.11;
  const cabinX = (h: number): number =>
    hullX(BELT) - 0.03 - (h - CABIN_BASE) * 0.3;

  const paint: Bands = {
    cuts: [Y(STRIPE_LOW), Y(STRIPE_HIGH)],
    colors: [secondary, accent, primary],
  };
  const paintAt = (h: number): Rgb =>
    h < STRIPE_LOW ? secondary : h < STRIPE_HIGH ? accent : primary;

  // --- Passages de roue : une entaille dans la silhouette, sur toute la largeur de la caisse ---
  const arches = [config.front, config.rear].map((axle, i) => {
    // Dessiné pour l'assiette de repos : c'est là que la roue se trouve la plupart du temps.
    const center = rests[i * 2].y + config.ride.sag - groundY;
    const radius = axle.wheelRadius + ARCH_GAP;
    const start = Math.asin(Math.min(1, (center - SILL) / radius));
    const arc = (r: number): P2[] =>
      Array.from({ length: ARCH_SEGMENTS + 1 }, (_, k) => {
        const angle = lerp(-start, Math.PI + start, k / ARCH_SEGMENTS);
        return [
          axle.z - r * Math.cos(angle),
          center + r * Math.sin(angle),
        ] as P2;
      });
    return { z: axle.z, center, radius, arc, axle };
  });

  // --- Caisse : silhouette latérale d'un seul tenant, parcourue dans le sens trigonométrique en (z, h) ---
  const hood: P2[] = [
    [WINDSHIELD_BASE - 0.06, 0.92],
    [nose + 0.4, 0.82],
    [nose + 0.12, 0.75],
  ];
  const hullOutline: P2[] = [
    [nose + 0.2, 0.3],
    ...arches[0].arc(arches[0].radius),
    ...arches[1].arc(arches[1].radius),
    [tail - 0.16, 0.28],
    [tail - 0.02, 0.44],
    [tail, STRIPE_LOW],
    [tail - 0.005, STRIPE_HIGH],
    [tail - 0.03, 0.92],
    [tail - 0.2, 0.95],
    [WINDSHIELD_BASE - 0.02, BELT],
    ...hood,
    [nose + 0.02, STRIPE_HIGH],
    [nose, STRIPE_LOW],
    [nose, 0.44],
    [nose + 0.06, 0.33],
  ];
  const inArch = ([z, h]: P2): boolean =>
    arches.some(
      (arch) => Math.hypot(z - arch.z, h - arch.center) < arch.radius + 0.01,
    );
  body.extrude(
    hullOutline.map(([z, h]) => [z, Y(h)] as P2),
    (y) => hullX(y - groundY),
    paint,
    (a, b) => {
      const [pa, pb]: P2[] = [
        [a[0], a[1] - groundY],
        [b[0], b[1] - groundY],
      ];
      if (inArch(pa) && inArch(pb)) return WELL;
      const h = (pa[1] + pb[1]) / 2;
      return h < SILL + 0.07 ? PLASTIC : paintAt(h);
    },
  );

  // Fond des passages de roue : bouche la vue à travers la voiture, en laissant la place au braquage.
  for (const arch of arches) {
    const well = wheelInner - 0.2;
    body.box(
      [-well, Y(SILL), arch.z - arch.radius],
      [well, Y(arch.center + arch.radius - 0.02), arch.z + arch.radius],
      WELL,
    );
  }

  // --- Ailes élargies : un bourrelet qui suit le passage de roue et recouvre le pneu ---
  for (const arch of arches) {
    const inner = arch.arc(arch.radius);
    const outer = arch.arc(arch.radius + 0.09);
    const base = arch.arc(arch.radius + 0.12);
    for (const side of SIDES) {
      const atFlare = ([z, h]: P2): V3 => [side * flareX, Y(h), z];
      const atHull = ([z, h]: P2): V3 => [side * hullX(h), Y(h), z];
      for (let k = 0; k < ARCH_SEGMENTS; k++) {
        const angle = lerp(0, Math.PI, (k + 0.5) / ARCH_SEGMENTS);
        const radial: V3 = [0, Math.sin(angle), -Math.cos(angle)];
        body.paintedFace(
          [
            atFlare(inner[k]),
            atFlare(inner[k + 1]),
            atFlare(outer[k + 1]),
            atFlare(outer[k]),
          ],
          paint,
          [side, 0, 0],
        );
        body.paintedFace(
          [
            atFlare(outer[k]),
            atFlare(outer[k + 1]),
            atHull(base[k + 1]),
            atHull(base[k]),
          ],
          paint,
          [side, radial[1], radial[2]],
        );
        body.face(
          [
            atFlare(inner[k]),
            atFlare(inner[k + 1]),
            atHull(inner[k + 1]),
            atHull(inner[k]),
          ],
          WELL,
          [0, -radial[1], -radial[2]],
        );
        // Paroi côté capot : le haut de l'aile dépasse du capot et se voit depuis la vue capot.
        body.paintedFace(
          [
            atHull(base[k]),
            atHull(base[k + 1]),
            atHull(inner[k + 1]),
            atHull(inner[k]),
          ],
          paint,
          [-side, 0, 0],
        );
      }
      for (const [k, out] of [
        [0, -1],
        [ARCH_SEGMENTS, 1],
      ]) {
        body.face(
          [
            atFlare(inner[k]),
            atFlare(outer[k]),
            atHull(base[k]),
            atHull(inner[k]),
          ],
          PLASTIC,
          [0, -0.5, out],
        );
      }
    }
  }

  // Bas de caisse en plastique entre les ailes
  const skirtFront = arches[0].z + arches[0].radius + 0.1;
  const skirtRear = arches[1].z - arches[1].radius - 0.1;
  for (const side of SIDES) {
    const [inner, outer] = [
      side * (hullX(SILL) - 0.1),
      side * (hullX(SILL) + 0.04),
    ];
    body.box(
      [Math.min(inner, outer), Y(SILL - 0.03), skirtFront],
      [Math.max(inner, outer), Y(SILL + 0.07), skirtRear],
      PLASTIC,
    );
  }

  // --- Habitacle : deuxième silhouette, plus rentrante, posée sur la ceinture de caisse ---
  const hatchBase = tail - 0.16;
  const cabinOutline: P2[] = [
    [WINDSHIELD_BASE, CABIN_BASE],
    [hatchBase, CABIN_BASE],
    [ROOF_REAR, ROOF_EDGE],
    [(WINDSHIELD_TOP + ROOF_REAR) / 2, ROOF_TOP],
    [WINDSHIELD_TOP, ROOF_EDGE],
  ];
  body.extrude(
    cabinOutline.map(([z, h]) => [z, Y(h)] as P2),
    (y) => cabinX(y - groundY),
    { cuts: [], colors: [primary] },
    () => primary,
  );

  // Vitres de custode et de portière, sur le plan incliné du flanc
  const zAt = (a: P2, b: P2, h: number): number =>
    lerp(a[0], b[0], (h - a[1]) / (b[1] - a[1]));
  const windshieldZ = (h: number): number =>
    zAt([WINDSHIELD_BASE, CABIN_BASE], [WINDSHIELD_TOP, ROOF_EDGE], h) + 0.08;
  const hatchZ = (h: number): number =>
    zAt([hatchBase, CABIN_BASE], [ROOF_REAR, ROOF_EDGE], h) - 0.08;
  const [sillGlass, topGlass, pillar] = [0.97, 1.29, 0.42];
  for (const side of SIDES) {
    const at = (z: number, h: number): V3 => [
      side * (cabinX(h) + 0.01),
      Y(h),
      z,
    ];
    const out: V3 = [side, 0.3, 0];
    body.face(
      [
        at(windshieldZ(sillGlass), sillGlass),
        at(pillar, sillGlass),
        at(pillar, topGlass),
        at(windshieldZ(topGlass), topGlass),
      ],
      GLASS,
      out,
    );
    body.face(
      [
        at(pillar + 0.07, sillGlass),
        at(hatchZ(sillGlass), sillGlass),
        at(hatchZ(topGlass), topGlass),
        at(pillar + 0.07, topGlass),
      ],
      GLASS,
      out,
    );
  }

  const slopeNormal = (from: P2, to: P2): P2 => {
    const [dz, dh] = [to[0] - from[0], to[1] - from[1]];
    const length = Math.hypot(dz, dh);
    return [dh / length, -dz / length];
  };

  /** Bande posée sur une pente de la silhouette, `from` et `to` donnés dans le sens de la silhouette. */
  const onSlope = (
    from: P2,
    to: P2,
    t0: number,
    t1: number,
    halfWidth: (h: number) => number,
    color: Rgb,
    lift = 0.012,
  ): void => {
    const [nz, nh] = slopeNormal(from, to);
    const at = (t: number, sign: number): V3 => {
      const h = lerp(from[1], to[1], t);
      return [
        sign * halfWidth(h),
        Y(h + nh * lift),
        lerp(from[0], to[0], t) + nz * lift,
      ];
    };
    body.face([at(t0, -1), at(t0, 1), at(t1, 1), at(t1, -1)], color, [
      0,
      nh,
      nz,
    ]);
  };
  const windshieldTop: P2 = [WINDSHIELD_TOP, ROOF_EDGE];
  const windshieldBottom: P2 = [WINDSHIELD_BASE, CABIN_BASE];
  const glassWidth = (h: number): number => cabinX(h) - 0.07;
  onSlope(windshieldTop, windshieldBottom, 0.17, 0.9, glassWidth, GLASS);
  // Le bandeau de pare-brise, très rallye
  onSlope(windshieldTop, windshieldBottom, 0.07, 0.17, glassWidth, accent);
  onSlope(
    [hatchBase, CABIN_BASE],
    [ROOF_REAR, ROOF_EDGE],
    0.18,
    0.9,
    glassWidth,
    GLASS,
  );

  // Bandes de capot et de toit, visibles en vue de poursuite
  const centerBand = (): number => 0.17;
  for (let k = 0; k < hood.length - 1; k++) {
    onSlope(hood[k], hood[k + 1], 0, 1, centerBand, accent, 0.006);
  }
  const roofMid: P2 = [(WINDSHIELD_TOP + ROOF_REAR) / 2, ROOF_TOP];
  onSlope([ROOF_REAR, ROOF_EDGE], roofMid, 0, 1, centerBand, accent, 0.006);
  onSlope(roofMid, windshieldTop, 0, 1, centerBand, accent, 0.006);

  // Prise d'air de toit et rétroviseurs
  body.box(
    [-0.1, Y(ROOF_TOP - 0.01), roofMid[0] - 0.05],
    [0.1, Y(ROOF_TOP + 0.04), roofMid[0] + 0.22],
    PLASTIC,
  );
  for (const side of SIDES) {
    const x = cabinX(1.02);
    const [x0, x1] = [side * (x - 0.02), side * (x + 0.14)];
    body.box(
      [Math.min(x0, x1), Y(0.99), WINDSHIELD_BASE + 0.26],
      [Math.max(x0, x1), Y(1.07), WINDSHIELD_BASE + 0.32],
      primary,
    );
  }

  // --- Flancs : portière, poignée, numéro ---
  const hullRect = (
    side: number,
    z0: number,
    z1: number,
    h0: number,
    h1: number,
    color: Rgb,
  ): void => {
    const at = (z: number, h: number): V3 => [
      side * (hullX(h) + 0.008),
      Y(h),
      z,
    ];
    body.face([at(z0, h0), at(z1, h0), at(z1, h1), at(z0, h1)], color, [
      side,
      0.1,
      0,
    ]);
  };
  const doorFront = arches[0].z + arches[0].radius + 0.14;
  const numberQuads: [V3, V3, V3, V3][] = [];
  const flagQuads: [V3, V3, V3, V3][] = [];
  for (const side of SIDES) {
    hullRect(side, doorFront, doorFront + 0.012, SILL + 0.07, BELT - 0.02, INK);
    hullRect(side, pillar, pillar + 0.012, SILL + 0.07, BELT - 0.02, INK);
    hullRect(side, pillar - 0.16, pillar - 0.05, 0.84, 0.865, INK);

    const center = (doorFront + pillar - 0.16) / 2;
    // Sens de lecture : vers l'avant sur le flanc droit, vers l'arrière sur le flanc gauche.
    const at = (u: number, h: number): V3 => [
      side * (hullX(h) + 0.012),
      Y(h),
      center - side * u,
    ];
    numberQuads.push([
      at(-0.25, 0.68),
      at(0.25, 0.68),
      at(0.25, 0.9),
      at(-0.25, 0.9),
    ]);
    // Drapeau sur la custode : au-dessus de la roue, l'aile monte plus haut que la caisse et n'offre aucun plat.
    const [flagLeft, flagRight] = side > 0 ? [0.75, 0.48] : [0.48, 0.75];
    const flagAt = (z: number, h: number): V3 => [
      side * (hullX(h) + 0.012),
      Y(h),
      z,
    ];
    flagQuads.push([
      flagAt(flagLeft, 0.69),
      flagAt(flagRight, 0.69),
      flagAt(flagRight, 0.87),
      flagAt(flagLeft, 0.87),
    ]);
  }

  // Numéro de capot : se lit face à la voiture, le haut des chiffres vers le pare-brise.
  const [hoodNz, hoodNh] = slopeNormal(hood[0], hood[1]);
  const hoodAt = (x: number, t: number): V3 => [
    x,
    Y(lerp(hood[0][1], hood[1][1], t) + hoodNh * 0.012),
    lerp(hood[0][0], hood[1][0], t) + hoodNz * 0.012,
  ];
  numberQuads.push([
    hoodAt(0.25, 0.65),
    hoodAt(-0.25, 0.65),
    hoodAt(-0.25, 0.35),
    hoodAt(0.25, 0.35),
  ]);

  // --- Avant : calandre, phares, pare-chocs, rampe de quatre phares ---
  const noseFace = (
    x0: number,
    x1: number,
    h0: number,
    h1: number,
    color: Rgb,
  ): void => {
    const z = nose - 0.006;
    body.face(
      [
        [x0, Y(h0), z],
        [x1, Y(h0), z],
        [x1, Y(h1), z],
        [x0, Y(h1), z],
      ],
      color,
      [0, 0, -1],
    );
  };
  noseFace(-0.5, 0.5, 0.46, 0.58, PLASTIC);
  for (const side of SIDES) {
    noseFace(side * 0.5, side * 0.71, 0.46, 0.58, LENS);
    noseFace(side * 0.71, side * 0.77, 0.46, 0.58, AMBER);
  }

  const bumperWidth = (): number => hullX(0.4) + 0.01;
  const plastic: Bands = { cuts: [], colors: [PLASTIC] };
  body.extrude(
    (
      [
        [nose - 0.06, 0.34],
        [nose + 0.22, 0.3],
        [nose + 0.22, 0.44],
        [nose - 0.05, 0.44],
      ] as P2[]
    ).map(([z, h]) => [z, Y(h)] as P2),
    bumperWidth,
    plastic,
    () => PLASTIC,
  );

  const rampZ = nose + 0.3;
  const rampH = 0.91;
  body.box(
    [-0.64, Y(rampH - 0.05), rampZ + 0.03],
    [0.64, Y(rampH - 0.02), rampZ + 0.08],
    PLASTIC,
  );
  for (const x of [-0.38, 0.38]) {
    body.box(
      [x - 0.02, Y(0.78), rampZ + 0.03],
      [x + 0.02, Y(rampH - 0.03), rampZ + 0.08],
      PLASTIC,
    );
  }
  for (const x of [-0.54, -0.18, 0.18, 0.54]) {
    body.lathe(
      "z",
      [x, Y(rampH), rampZ + 0.04],
      -1,
      [
        [0, 0],
        [0, 0.085],
        [0.09, 0.085],
        [0.09, 0],
      ],
      [PLASTIC, PLASTIC, LENS],
      8,
    );
  }

  // --- Arrière : bandeau sombre, feux, plaque, pare-chocs, échappement, aileron ---
  const tailZ = (h: number): number =>
    tail - 0.005 - (0.025 * (h - STRIPE_HIGH)) / (0.92 - STRIPE_HIGH);
  const panelX = hullX(0.76) - 0.01;
  body.face(
    [
      [-panelX, Y(0.68), tailZ(0.68) + 0.006],
      [panelX, Y(0.68), tailZ(0.68) + 0.006],
      [panelX, Y(0.84), tailZ(0.84) + 0.006],
      [-panelX, Y(0.84), tailZ(0.84) + 0.006],
    ],
    INK,
    [0, 0, 1],
  );
  for (const side of SIDES) {
    // Bloc arrière d'époque : le tiers intérieur est le feu de recul.
    const [inner, outer] = [0.38, panelX - 0.02];
    const split = inner + (outer - inner) / 3;
    const lamp = (
      builder: ReturnType<typeof createMeshBuilder>,
      from: number,
      to: number,
      color: Rgb,
    ): void => {
      const [x0, x1] = [side * from, side * to];
      builder.box(
        [Math.min(x0, x1), Y(0.7), tail - 0.08],
        [Math.max(x0, x1), Y(0.82), tail + 0.012],
        color,
      );
    };
    lamp(reverse, inner, split, REVERSE_OFF);
    lamp(brake, split, outer, BRAKE_OFF);
  }
  // Support de plaque, recouvert par la texture. Vue de face, la droite est +X à l'arrière et -X à l'avant.
  const plate = (halfX: number, h0: number, h1: number, z: number): V3[] => [
    [-halfX, Y(h0), z],
    [halfX, Y(h0), z],
    [halfX, Y(h1), z],
    [-halfX, Y(h1), z],
  ];
  const [plateX, frontLow, frontHigh] = [PLATE_HALF_WIDTH, 0.345, 0.435];
  const frontZ = nose - 0.07;
  const rearZ = tail + 0.008;
  body.box([-plateX, Y(0.47), tail - 0.03], [plateX, Y(0.56), rearZ], PLATE);
  body.box(
    [-plateX, Y(frontLow), frontZ],
    [plateX, Y(frontHigh), nose - 0.045],
    PLATE,
  );
  const plateQuads = [
    plate(-plateX, frontLow, frontHigh, frontZ - DECAL_GAP),
    plate(plateX, 0.47, 0.56, rearZ + DECAL_GAP),
  ] as [V3, V3, V3, V3][];

  body.extrude(
    (
      [
        [tail - 0.22, 0.3],
        [tail + 0.06, 0.34],
        [tail + 0.05, 0.44],
        [tail - 0.22, 0.44],
      ] as P2[]
    ).map(([z, h]) => [z, Y(h)] as P2),
    bumperWidth,
    plastic,
    () => PLASTIC,
  );
  body.lathe(
    "z",
    [EXHAUST.x, Y(EXHAUST.h), tail - EXHAUST.inset],
    1,
    [
      [0, EXHAUST.radius],
      [EXHAUST.length, EXHAUST.radius],
      [EXHAUST.length, 0],
    ],
    [rgb("#6a6a70"), WELL],
    8,
  );

  // Gros aileron : il doit dépasser du toit, c'est lui qu'on reconnaît de dos.
  const wingFront = tail - 0.5;
  const wingRear = tail - 0.12;
  const wingHalfSpan = 0.78;
  body.extrude(
    (
      [
        [wingFront, 1.4],
        [wingRear, 1.42],
        [wingRear + 0.02, 1.48],
        [wingFront + 0.08, 1.44],
      ] as P2[]
    ).map(([z, h]) => [z, Y(h)] as P2),
    () => wingHalfSpan,
    { cuts: [], colors: [secondary] },
    () => secondary,
  );
  for (const side of SIDES) {
    const [x0, x1] = [side * wingHalfSpan, side * (wingHalfSpan + 0.025)];
    body.box(
      [Math.min(x0, x1), Y(1.35), wingFront - 0.02],
      [Math.max(x0, x1), Y(1.51), wingRear + 0.04],
      accent,
    );
    const [p0, p1] = [side * 0.44, side * 0.48];
    body.box(
      [Math.min(p0, p1), Y(1), tail - 0.4],
      [Math.max(p0, p1), Y(1.41), tail - 0.34],
      PLASTIC,
    );
  }

  // --- Bavettes derrière chaque roue, grandes à l'arrière : un repère fort de dos ---
  arches.forEach((arch, i) => {
    const z = arch.z + arch.radius + 0.02;
    // Le sol réel est à `sag` sous les cotes : elles partent des roues détendues, la voiture repose plus bas.
    const low =
      config.ride.sag +
      (i === 0
        ? config.mudflaps.frontClearance
        : config.mudflaps.rearClearance);
    for (const side of SIDES) {
      const [x0, x1] = [side * (wheelInner - 0.02), side * (wheelOuter + 0.02)];
      body.box(
        [Math.min(x0, x1), Y(low), z],
        [Math.max(x0, x1), Y(SILL + 0.06), z + 0.02],
        accent,
      );
    }
  });

  const wheels = rests.map((rest, i) => ({
    geometry: buildWheel(
      axles[i].wheelRadius,
      axles[i].wheelWidth,
      Math.sign(rest.x),
      livery,
    ),
    disc: buildBrakeDisc(
      axles[i].wheelRadius,
      axles[i].wheelWidth,
      Math.sign(rest.x),
    ),
    position: rest,
  }));

  return {
    body: body.toGeometry(),
    brakeLights: brake.toGeometry(),
    reverseLights: reverse.toGeometry(),
    plates: decalQuads(plateQuads),
    numbers: decalQuads(numberQuads),
    flags: decalQuads(flagQuads),
    wheels,
  };
};
