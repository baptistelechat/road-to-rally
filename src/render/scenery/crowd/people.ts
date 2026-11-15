// Copie de `src/app/decor-lab/crowd/people.ts` : le labo évolue à part, resynchroniser à la main.
import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import {
  linear,
  merged,
  PART,
  type Part,
  piece,
  placed,
  type Rgb,
  SLOT,
  type Slot,
  segment,
  type Vec3,
} from "./geometry";

// Personnages du public : un squelette par pose, habillé selon un style. Face au +Z, pieds en y = 0, 1,75 m.

export const STYLES = ["facet", "figurine", "picto"] as const;
export type StyleId = (typeof STYLES)[number];

export const POSES = [
  "cheer",
  "rail",
  "photo",
  "seated",
  "shoulders",
  "flag",
  "marshal",
] as const;
export type PoseId = (typeof POSES)[number];

export const POSE_LABEL: Record<PoseId, string> = {
  cheer: "bras levés",
  rail: "mains sur la rambarde",
  photo: "appareil photo",
  seated: "assis sur la glacière",
  shoulders: "enfant sur les épaules",
  flag: "drapeau",
  marshal: "commissaire",
};

type Shape = "ico" | "sphere" | "octa";

interface StyleSpec {
  label: string;
  blurb: string;
  limbSides: number;
  limbRadius: number;
  /** Coudes et genoux : sinon un seul segment par membre */
  joints: boolean;
  torsoSides: number;
  /** Rapport largeur du bas sur largeur des épaules */
  taper: number;
  /** Rapport profondeur sur largeur du torse */
  depth: number;
  /** Dôme sur les épaules : arrondit la silhouette */
  shoulderDome: boolean;
  head: Shape;
  neck: boolean;
  hands: "none" | "octa" | "ico";
  feet: boolean;
  /** Côtés des bonnets et couronnes de casquette */
  hatSides: number;
}

export const STYLE_SPECS: Record<StyleId, StyleSpec> = {
  facet: {
    label: "A · Facetté",
    blurb:
      "Arêtes franches et prismes à 4 pans, comme la carrosserie de la voiture.",
    limbSides: 4,
    limbRadius: 0.055,
    joints: true,
    torsoSides: 4,
    taper: 0.78,
    depth: 0.55,
    shoulderDome: false,
    head: "ico",
    neck: true,
    hands: "octa",
    feet: true,
    hatSides: 5,
  },
  figurine: {
    label: "B · Figurine",
    blurb: "Volumes arrondis à 6-8 pans, tête ronde : plus doux, plus cher.",
    limbSides: 6,
    limbRadius: 0.06,
    joints: true,
    torsoSides: 8,
    taper: 0.86,
    depth: 0.7,
    shoulderDome: true,
    head: "sphere",
    neck: true,
    hands: "ico",
    feet: true,
    hatSides: 8,
  },
  picto: {
    label: "C · Pictogramme",
    blurb: "Blocs pleins, tête détachée, sans coudes : lisible de très loin.",
    limbSides: 4,
    limbRadius: 0.07,
    joints: false,
    torsoSides: 4,
    taper: 1,
    depth: 0.5,
    shoulderDome: false,
    head: "octa",
    neck: false,
    hands: "none",
    feet: false,
    hatSides: 4,
  },
};

interface Skeleton {
  pelvis: Vec3;
  chest: Vec3;
  head: Vec3;
  /** Côté droit (x > 0) : hanche, genou, pied */
  legR: Vec3[];
  legL: Vec3[];
  /** Épaule, coude, main */
  armR: Vec3[];
  armL: Vec3[];
}

const mirror = ([x, y, z]: Vec3): Vec3 => [-x, y, z];
const mirrored = (points: Vec3[]): Vec3[] => points.map(mirror);

const LEG: Vec3[] = [
  [0.1, 0.9, 0],
  [0.11, 0.48, 0.02],
  [0.12, 0.08, 0.02],
];
const ARM_DOWN: Vec3[] = [
  [0.21, 1.4, 0],
  [0.25, 1.12, 0.03],
  [0.26, 0.86, 0.06],
];
const ARM_UP: Vec3[] = [
  [0.21, 1.4, 0],
  [0.33, 1.68, 0.04],
  [0.3, 1.95, 0.06],
];

const standing = (armR: Vec3[], armL: Vec3[]): Skeleton => ({
  pelvis: [0, 0.86, 0],
  chest: [0, 1.44, 0],
  head: [0, 1.63, 0.01],
  legR: LEG,
  legL: mirrored(LEG),
  armR,
  armL,
});

const SKELETONS: Record<PoseId, Skeleton> = {
  cheer: standing(ARM_UP, mirrored(ARM_UP)),
  rail: (() => {
    const arm: Vec3[] = [
      [0.21, 1.37, 0.1],
      [0.27, 1.17, 0.25],
      [0.24, 1.02, 0.42],
    ];
    const leg: Vec3[] = [
      [0.1, 0.9, 0],
      [0.12, 0.48, -0.02],
      [0.13, 0.08, -0.06],
    ];
    return {
      pelvis: [0, 0.86, 0],
      chest: [0, 1.4, 0.1],
      head: [0, 1.6, 0.15],
      legR: leg,
      legL: mirrored(leg),
      armR: arm,
      armL: mirrored(arm),
    };
  })(),
  photo: (() => {
    const arm: Vec3[] = [
      [0.21, 1.4, 0],
      [0.25, 1.3, 0.22],
      [0.09, 1.55, 0.3],
    ];
    return standing(arm, mirrored(arm));
  })(),
  seated: (() => {
    const leg: Vec3[] = [
      [0.1, 0.52, 0],
      [0.12, 0.5, 0.4],
      [0.13, 0.08, 0.44],
    ];
    return {
      pelvis: [0, 0.48, -0.02],
      chest: [0, 1.04, -0.04],
      head: [0, 1.23, -0.03],
      legR: leg,
      legL: mirrored(leg),
      armR: [
        [0.21, 1.0, -0.04],
        [0.26, 0.78, 0.12],
        [0.16, 0.58, 0.32],
      ],
      armL: [
        [-0.21, 1.0, -0.04],
        [-0.3, 0.84, 0.16],
        [-0.27, 1.02, 0.3],
      ],
    };
  })(),
  shoulders: (() => {
    const arm: Vec3[] = [
      [0.21, 1.4, 0],
      [0.31, 1.44, 0.13],
      [0.17, 1.54, 0.16],
    ];
    return standing(arm, mirrored(arm));
  })(),
  flag: standing(ARM_UP, ARM_DOWN.map(mirror)),
  marshal: standing(
    [
      [0.21, 1.4, 0],
      [0.42, 1.5, 0.15],
      [0.6, 1.6, 0.3],
    ],
    mirrored(ARM_DOWN),
  ),
};

/** Enfant sur les épaules : même squelette réduit, posé sur le bassin de l'adulte. */
const CHILD: Skeleton = (() => {
  const leg: Vec3[] = [
    [0.07, 1.8, 0],
    [0.13, 1.76, 0.13],
    [0.15, 1.52, 0.16],
  ];
  const arm: Vec3[] = [
    [0.13, 2.06, -0.02],
    [0.21, 2.23, 0],
    [0.18, 2.4, 0.02],
  ];
  return {
    pelvis: [0, 1.8, -0.03],
    chest: [0, 2.08, -0.02],
    head: [0, 2.21, 0],
    legR: leg,
    legL: mirrored(leg),
    armR: arm,
    armL: mirrored(arm),
  };
})();

const UP = new Vector3(0, 1, 0);

/** Prisme ou cylindre effilé de `a` (bas) à `b` (haut), aplati en profondeur. */
const torsoPiece = (
  spec: StyleSpec,
  a: Vec3,
  b: Vec3,
  width: number,
  slot: Slot,
  color: Rgb = [1, 1, 1],
  part: Part = PART.always,
): BufferGeometry => {
  const from = new Vector3(...a);
  const direction = new Vector3(...b).sub(from);
  const length = direction.length();
  // À 4 pans, le rayon vise la demi-largeur des faces, pas celle des arêtes.
  const radius = spec.torsoSides === 4 ? width * 0.707 : width / 2;
  const geometry = new CylinderGeometry(
    radius,
    radius * spec.taper,
    length,
    spec.torsoSides,
  );
  if (spec.torsoSides === 4) geometry.rotateY(Math.PI / 4);
  geometry.scale(1, 1, spec.depth);
  geometry.translate(0, length / 2, 0);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(UP, direction.normalize()),
  );
  geometry.translate(from.x, from.y, from.z);
  return piece(geometry, { slot, color, part });
};

const shape = (kind: Shape, radius: number): BufferGeometry => {
  if (kind === "sphere") return new SphereGeometry(radius, 8, 6);
  if (kind === "octa") return new OctahedronGeometry(radius * 1.05, 0);
  return new IcosahedronGeometry(radius, 0);
};

const add = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 => [
  ax + bx,
  ay + by,
  az + bz,
];
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const SHOE: Rgb = linear("#2a2420");
const BAND: Rgb = linear("#ffd23f");

/** Toutes les coiffes d'une tête : le masque de l'instance n'en montre qu'une. */
const headwear = (
  spec: StyleSpec,
  center: Vec3,
  r: number,
): BufferGeometry[] => {
  const head = SLOT.head;
  return [
    piece(placed(shape(spec.head, r * 1.07), add(center, [0, 0.025, -0.035])), {
      slot: head,
      part: PART.hair,
    }),
    piece(
      placed(
        shape(spec.head, r * 1.1),
        add(center, [0, 0.035, -0.01]),
        [0, 0, 0],
        [1, 0.75, 1],
      ),
      { slot: head, part: PART.cap },
    ),
    piece(
      placed(
        new BoxGeometry(r * 1.5, 0.02, r * 1.1),
        add(center, [0, 0.03, r * 0.85]),
        [-0.15, 0, 0],
      ),
      { slot: head, part: PART.cap },
    ),
    piece(
      placed(
        new CylinderGeometry(r * 0.8, r * 1.1, r * 0.95, spec.hatSides),
        add(center, [0, r * 0.5, -0.005]),
      ),
      { slot: head, part: PART.beanie },
    ),
    piece(placed(shape(spec.head, r * 0.3), add(center, [0, r * 1.08, 0])), {
      slot: head,
      part: PART.beanie,
    }),
    piece(placed(shape(spec.head, r * 1.28), add(center, [0, 0.01, -0.06])), {
      slot: SLOT.top,
      part: PART.hood,
    }),
  ];
};

interface BodyOptions {
  headRadius: number;
  limbScale: number;
  torsoWidth: number;
  topSlot: Slot;
  bottomSlot: Slot;
}

const ADULT: BodyOptions = {
  headRadius: 0.12,
  limbScale: 1,
  torsoWidth: 0.42,
  topSlot: SLOT.top,
  bottomSlot: SLOT.bottom,
};

/** Membre en un ou deux segments : sans articulation, le coude ou le genou saute. */
const limb = (
  spec: StyleSpec,
  points: Vec3[],
  radius: number,
  slot: Slot,
): BufferGeometry[] => {
  const path = spec.joints ? points : [points[0], points[points.length - 1]];
  return path
    .slice(1)
    .map((point, i) =>
      segment(path[i], point, radius, spec.limbSides, { slot }),
    );
};

const body = (
  spec: StyleSpec,
  skeleton: Skeleton,
  options: BodyOptions,
): BufferGeometry[] => {
  const r = options.headRadius;
  const limbRadius = spec.limbRadius * options.limbScale;
  const parts: BufferGeometry[] = [
    torsoPiece(
      spec,
      skeleton.pelvis,
      skeleton.chest,
      options.torsoWidth,
      options.topSlot,
    ),
    // Bande du polo d'équipe ou du gilet de commissaire.
    torsoPiece(
      spec,
      lerp(skeleton.pelvis, skeleton.chest, 0.62),
      lerp(skeleton.pelvis, skeleton.chest, 0.74),
      options.torsoWidth * 1.03,
      SLOT.fixed,
      BAND,
      PART.band,
    ),
    // Bassin : le haut des jambes rejoint le torse.
    torsoPiece(
      spec,
      add(skeleton.pelvis, [0, -0.08, 0]),
      add(skeleton.pelvis, [0, 0.04, 0]),
      options.torsoWidth * spec.taper * 0.98,
      options.bottomSlot,
    ),
    piece(placed(shape(spec.head, r), skeleton.head), { slot: SLOT.skin }),
    ...headwear(spec, skeleton.head, r),
    ...limb(spec, skeleton.legR, limbRadius * 1.15, options.bottomSlot),
    ...limb(spec, skeleton.legL, limbRadius * 1.15, options.bottomSlot),
    ...limb(spec, skeleton.armR, limbRadius, options.topSlot),
    ...limb(spec, skeleton.armL, limbRadius, options.topSlot),
  ];
  if (spec.shoulderDome) {
    parts.push(
      piece(
        placed(
          new SphereGeometry(
            options.torsoWidth / 2,
            8,
            2,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2,
          ),
          skeleton.chest,
          [0, 0, 0],
          [1, 0.45, spec.depth],
        ),
        { slot: options.topSlot },
      ),
    );
  }
  if (spec.neck) {
    parts.push(
      segment(
        add(skeleton.chest, [0, -0.02, 0]),
        add(skeleton.head, [0, -r * 0.6, 0]),
        r * 0.4,
        spec.limbSides,
        {
          slot: SLOT.skin,
        },
      ),
    );
  }
  if (spec.hands !== "none") {
    for (const arm of [skeleton.armR, skeleton.armL]) {
      const hand = arm[arm.length - 1];
      const size = limbRadius * 0.95;
      const geometry =
        spec.hands === "ico"
          ? new IcosahedronGeometry(size, 0)
          : new OctahedronGeometry(size, 0);
      parts.push(piece(placed(geometry, hand), { slot: SLOT.skin }));
    }
  }
  if (spec.feet) {
    for (const leg of [skeleton.legR, skeleton.legL]) {
      // Le pied pend sous le bout de la jambe : au sol pour l'adulte, en l'air pour l'enfant.
      const [x, y, z] = leg[leg.length - 1];
      const scale = options.limbScale;
      parts.push(
        piece(
          placed(new BoxGeometry(0.11 * scale, 0.08 * scale, 0.22 * scale), [
            x,
            y - 0.04 * scale,
            z + 0.04,
          ]),
          { color: SHOE },
        ),
      );
    }
  }
  return parts;
};

const GREY: Rgb = linear("#8d9299");
const DARK: Rgb = linear("#1c1f24");
const COOLER: Rgb = linear("#2f6fd1");
const LID: Rgb = linear("#efe6d2");
const CAN: Rgb = linear("#d9472b");
const MARSHAL_FLAG: Rgb = linear("#ffd23f");

/** Accessoires propres à la pose, en couleurs fixes. */
const props = (pose: PoseId, spec: StyleSpec): BufferGeometry[] => {
  switch (pose) {
    case "photo":
      return [
        piece(placed(new BoxGeometry(0.16, 0.1, 0.07), [0, 1.57, 0.33]), {
          color: DARK,
        }),
        piece(
          placed(
            new CylinderGeometry(0.035, 0.04, 0.07, spec.hatSides),
            [0, 1.57, 0.39],
            [Math.PI / 2, 0, 0],
          ),
          { color: GREY },
        ),
      ];
    case "seated":
      return [
        piece(placed(new BoxGeometry(0.5, 0.4, 0.34), [0, 0.2, -0.04]), {
          color: COOLER,
        }),
        piece(placed(new BoxGeometry(0.52, 0.07, 0.36), [0, 0.43, -0.04]), {
          color: LID,
        }),
        piece(
          placed(
            new CylinderGeometry(0.035, 0.035, 0.12, 6),
            [-0.27, 1.07, 0.3],
          ),
          { color: CAN },
        ),
      ];
    case "shoulders":
      // L'enfant porte le bas de l'adulte en haut, et inversement : deux couleurs pour le prix d'une tenue.
      return body(spec, CHILD, {
        headRadius: 0.09,
        limbScale: 0.72,
        torsoWidth: 0.27,
        topSlot: SLOT.bottom,
        bottomSlot: SLOT.top,
      });
    case "flag":
      // La toile est un plan texturé à part (atlas des drapeaux, voir `FlagCloths`).
      return [
        segment([0.3, 1.5, 0.08], [0.3, 2.75, 0.08], 0.018, 5, { color: GREY }),
      ];
    case "marshal":
      return [
        segment([0.6, 1.45, 0.3], [0.6, 2.05, 0.3], 0.015, 5, { color: GREY }),
        piece(placed(new BoxGeometry(0.42, 0.3, 0.015), [0.81, 1.88, 0.3]), {
          color: MARSHAL_FLAG,
        }),
      ];
    default:
      return [];
  }
};

/** Géométrie complète d'un personnage, coiffes facultatives comprises. */
export const buildPerson = (style: StyleId, pose: PoseId): BufferGeometry => {
  const spec = STYLE_SPECS[style];
  return merged([...body(spec, SKELETONS[pose], ADULT), ...props(pose, spec)]);
};
