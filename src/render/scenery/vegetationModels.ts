import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Haies et vignes réelles (story 5.3), portées des modèles validés au labo végétation (`/decor-lab`).
// Origine au pied, modules allongés selon x local : le pipeline oriente x le long de la haie ou du rang.

type Rgb = [number, number, number];
type Vec3Tuple = [number, number, number];

const HEDGE: Rgb = [0.25, 0.4, 0.15];
const HEDGE_LIGHT: Rgb = [0.31, 0.46, 0.18];
const HEDGE_DARK: Rgb = [0.2, 0.33, 0.13];
const HAWTHORN_FLOWER: Rgb = [0.78, 0.8, 0.7];
const LEAF: Rgb = [0.3, 0.46, 0.15];
const LEAF_YELLOW: Rgb = [0.5, 0.55, 0.2];
const STOCK: Rgb = [0.3, 0.22, 0.15];
const POST: Rgb = [0.52, 0.47, 0.4];
const WIRE: Rgb = [0.6, 0.6, 0.62];

/** Longueur d'un module de rang de vigne, en mètres : le même que `vegetation.ts` */
const VINE_MODULE = 5;

/** Hachage entier : jamais `Math.random`, les modèles sont les mêmes à chaque chargement. Résultat dans [0, 1[. */
const hash = (a: number, b: number, salt: number): number => {
  let h =
    Math.imul(a, 374761393) +
    Math.imul(b, 668265263) +
    Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Hachage d'une position au millimètre : les sommets confondus bougent ensemble, la surface ne se déchire pas. */
const hashPoint = (x: number, y: number, z: number, salt: number): number =>
  hash(
    Math.round(x * 1000) ^ Math.imul(Math.round(z * 1000), 73856093),
    Math.round(y * 1000),
    salt,
  );

interface PartOptions {
  at?: Vec3Tuple;
  scale?: Vec3Tuple;
  /** Appliquée dans l'ordre X, Z puis Y */
  rotation?: Vec3Tuple;
  /** Bosselage des sommets, en unités de la forme avant mise à l'échelle */
  bumps?: number;
  salt?: number;
  /** Écart relatif de teinte entre facettes */
  shade?: number;
  /** Couleur d'une facette selon son centre (y après mise à l'échelle) et un tirage ; `null` garde la couleur de base */
  paint?: (centerY: number, roll: number) => Rgb | null;
}

/** Pièce sans index, bosselée, colorée par facette, puis placée. */
const part = (
  source: BufferGeometry,
  color: Rgb,
  options: PartOptions = {},
): BufferGeometry => {
  const {
    at = [0, 0, 0],
    scale = [1, 1, 1],
    rotation = [0, 0, 0],
    bumps = 0,
    salt = 0,
    shade = 0.1,
    paint,
  } = options;
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");
  const position = geometry.getAttribute("position");
  if (bumps > 0)
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      position.setXYZ(
        i,
        x + (hashPoint(x, y, z, salt) - 0.5) * 2 * bumps,
        y + (hashPoint(x, y, z, salt + 1) - 0.5) * 2 * bumps,
        z + (hashPoint(x, y, z, salt + 2) - 0.5) * 2 * bumps,
      );
    }
  geometry.scale(scale[0], scale[1], scale[2]);
  const colors = new Float32Array(position.count * 3);
  for (let t = 0; t < position.count / 3; t++) {
    const centerY =
      (position.getY(t * 3) +
        position.getY(t * 3 + 1) +
        position.getY(t * 3 + 2)) /
      3;
    const base = paint?.(centerY, hash(t, salt, 77)) ?? color;
    const k = 1 + (hash(t, salt, 31) - 0.5) * 2 * shade;
    for (let v = 0; v < 3; v++)
      colors.set([base[0] * k, base[1] * k, base[2] * k], (t * 3 + v) * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.rotateX(rotation[0]);
  geometry.rotateZ(rotation[2]);
  geometry.rotateY(rotation[1]);
  geometry.translate(at[0], at[1], at[2]);
  return geometry;
};

/** Une géométrie par modèle : un seul appel de dessin par lot instancié. */
const merged = (...parts: BufferGeometry[]): BufferGeometry => {
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error("Pièces de végétation incompatibles");
  parts.forEach((piece) => piece.dispose());
  geometry.computeVertexNormals();
  return geometry;
};

/** Haie « boules fusionnées » : trois icosaèdres bosselés, environ 3 m de long, quelques fleurs d'aubépine. */
const bush = (): BufferGeometry =>
  merged(
    part(new IcosahedronGeometry(1, 0), HEDGE, {
      at: [-0.85, 0.85, 0],
      scale: [1, 0.85, 1],
      bumps: 0.14,
      salt: 101,
    }),
    part(new IcosahedronGeometry(1.15, 0), HEDGE_LIGHT, {
      at: [0.25, 1, 0.12],
      scale: [1, 0.9, 0.9],
      bumps: 0.15,
      salt: 102,
      paint: (centerY, roll) =>
        roll < 0.08 && centerY > 0 ? HAWTHORN_FLOWER : null,
    }),
    part(new IcosahedronGeometry(0.9, 0), HEDGE_DARK, {
      at: [1.15, 0.78, -0.15],
      scale: [1, 0.85, 1],
      bumps: 0.12,
      salt: 103,
    }),
  );

interface BandShape {
  segments: number;
  bottom: number;
  top: number;
  /** Demi-largeurs de la bande en bas et en haut, en mètres */
  bottomHalf: number;
  topHalf: number;
  /** Bosselage des sommets intérieurs ; les bouts restent droits pour se raccorder au module voisin */
  bumps: number;
  salt: number;
}

/** Bande de feuillage continue sur un module : deux flancs, un dessus, fermée aux bouts. */
const band = (shape: BandShape): BufferGeometry => {
  const { segments, bottom, top, bottomHalf, topHalf, bumps, salt } = shape;
  const half = VINE_MODULE / 2;
  // Section : bas gauche, haut gauche, haut droit, bas droit
  const section = (i: number): Vec3Tuple[] => {
    const x = -half + (VINE_MODULE * i) / segments;
    const inner = i > 0 && i < segments;
    const wobble = (k: number): number =>
      inner ? (hash(i, salt, k) - 0.5) * 2 * bumps : 0;
    return [
      [x, bottom + wobble(1), -bottomHalf + wobble(2)],
      [x, top + wobble(3), -topHalf + wobble(4)],
      [x, top + wobble(5), topHalf + wobble(6)],
      [x, bottom + wobble(7), bottomHalf + wobble(8)],
    ];
  };
  const positions: number[] = [];
  const quad = (
    a: Vec3Tuple,
    b: Vec3Tuple,
    c: Vec3Tuple,
    d: Vec3Tuple,
  ): void => {
    // Ordre inversé : faces tournées vers l'extérieur de la bande
    positions.push(...a, ...c, ...b, ...a, ...d, ...c);
  };
  for (let i = 0; i < segments; i++) {
    const [a0, a1, a2, a3] = section(i);
    const [b0, b1, b2, b3] = section(i + 1);
    quad(a0, b0, b1, a1);
    quad(a1, b1, b2, a2);
    quad(a2, b2, b3, a3);
  }
  const [s0, s1, s2, s3] = section(0);
  quad(s0, s1, s2, s3);
  const [e0, e1, e2, e3] = section(segments);
  quad(e3, e2, e1, e0);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  return geometry;
};

/** Piquet en tête de module, en x = -2,5 m. */
const post = (height: number, salt: number): BufferGeometry =>
  part(new CylinderGeometry(0.04, 0.05, height, 4, 1, true), POST, {
    at: [-VINE_MODULE / 2, height / 2, 0],
    salt,
  });

/** Rang de vigne de près, « palissage complet » : piquet, fil, cinq ceps, bande à cinq segments. */
const vineRow = (): BufferGeometry =>
  merged(
    post(1.8, 201),
    part(new BoxGeometry(VINE_MODULE, 0.015, 0.015), WIRE, {
      at: [0, 0.5, 0],
      salt: 202,
    }),
    ...Array.from({ length: 5 }, (_, i) =>
      part(new CylinderGeometry(0.03, 0.05, 0.62, 3, 1, true), STOCK, {
        at: [-2 + i, 0.31, 0],
        rotation: [0, i * 1.3, (hash(i, 203, 1) - 0.5) * 0.3],
        salt: 204 + i,
      }),
    ),
    part(
      band({
        segments: 5,
        bottom: 0.55,
        top: 1.55,
        bottomHalf: 0.15,
        topHalf: 0.32,
        bumps: 0.07,
        salt: 210,
      }),
      LEAF,
      {
        salt: 211,
        shade: 0.14,
        paint: (_centerY, roll) => (roll < 0.12 ? LEAF_YELLOW : null),
      },
    ),
  );

/** Rang de vigne de loin, « bande économique » : piquet et bande effilée à deux segments, ni fil ni cep. */
const vineRowFar = (): BufferGeometry =>
  merged(
    post(1.6, 221),
    part(
      band({
        segments: 2,
        bottom: 0.3,
        top: 1.4,
        bottomHalf: 0.06,
        topHalf: 0.3,
        bumps: 0.06,
        salt: 222,
      }),
      LEAF,
      {
        salt: 223,
        shade: 0.14,
        // Bas de la bande couleur cep : il se lit comme les ceps, sans les dessiner
        paint: (centerY, roll) =>
          centerY < 0.6 ? STOCK : roll < 0.12 ? LEAF_YELLOW : null,
      },
    ),
  );

export const VEGETATION_GEOMETRY = {
  bush: bush(),
  vineRow: vineRow(),
  vineRowFar: vineRowFar(),
};

// Essences d'arbres (story 5.3), copiées du labo (`src/app/decor-lab/vegetation/trees.ts`) : origine au pied,
// environ 6 à 14 m de haut à l'échelle 1. Les versions lointaines `*Far` existent là où le labo en a une.

const BARK: Rgb = [0.34, 0.24, 0.16];
const BARK_DARK: Rgb = [0.27, 0.2, 0.14];
const BIRCH_BARK: Rgb = [0.86, 0.84, 0.78];
const BIRCH_MARK: Rgb = [0.17, 0.16, 0.15];
const PINE_BARK_TOP: Rgb = [0.62, 0.37, 0.21];
const DEAD_WOOD: Rgb = [0.45, 0.39, 0.33];
const OAK: Rgb = [0.3, 0.45, 0.16];
const OAK_DARK: Rgb = [0.24, 0.37, 0.13];
const BEECH: Rgb = [0.35, 0.49, 0.18];
const POPLAR: Rgb = [0.37, 0.51, 0.2];
const BIRCH_LEAF: Rgb = [0.46, 0.58, 0.22];
const WILLOW: Rgb = [0.47, 0.57, 0.3];
const WILLOW_HANG: Rgb = [0.52, 0.6, 0.32];
const FIR: Rgb = [0.13, 0.29, 0.16];
const FIR_LIGHT: Rgb = [0.16, 0.34, 0.18];
const SCOTS: Rgb = [0.21, 0.35, 0.17];
const ORCHARD_LEAF: Rgb = [0.36, 0.52, 0.2];
const APPLE: Rgb = [0.72, 0.17, 0.1];

/** Tronc ouvert aux deux bouts : ses disques seraient cachés par le sol et le houppier. */
const trunk = (
  top: number,
  bottom: number,
  height: number,
  segments: number,
  color: Rgb = BARK,
  salt = 0,
): BufferGeometry =>
  part(new CylinderGeometry(top, bottom, height, segments, 1, true), color, {
    at: [0, height / 2, 0],
    shade: 0.08,
    salt,
  });

/** Branche ancrée à sa base, inclinée de `tilt` puis tournée de `yaw`. */
const branch = (
  length: number,
  tilt: number,
  yaw: number,
  at: Vec3Tuple,
  salt: number,
): BufferGeometry =>
  part(
    new CylinderGeometry(0.035, 0.09, length, 3, 1, true).translate(
      0,
      length / 2,
      0,
    ),
    DEAD_WOOD,
    { rotation: [0, yaw, tilt], at, salt },
  );

/** Chêne à lobes : trois masses bosselées sur un tronc court. */
const oakLobed = (): BufferGeometry =>
  merged(
    trunk(0.25, 0.38, 3.2, 5, BARK, 1),
    part(new IcosahedronGeometry(2.2, 0), OAK, {
      at: [0, 4.7, 0],
      scale: [1, 0.85, 1],
      bumps: 0.22,
      salt: 2,
    }),
    part(new IcosahedronGeometry(1.6, 0), OAK_DARK, {
      at: [1.4, 4.0, 0.5],
      bumps: 0.18,
      salt: 3,
    }),
    part(new IcosahedronGeometry(1.5, 0), BEECH, {
      at: [-1.2, 4.3, -0.6],
      bumps: 0.18,
      salt: 4,
    }),
  );

const oakLobedFar = (): BufferGeometry =>
  merged(
    trunk(0.25, 0.38, 3.2, 3, BARK, 1),
    part(new IcosahedronGeometry(2.6, 0), OAK, {
      at: [0, 4.5, 0],
      scale: [1.1, 0.85, 1.1],
      bumps: 0.2,
      salt: 5,
    }),
  );

/** Feuillu étagé : trois plateaux de feuillage, le hêtre ou le chêne de futaie. */
const oakTiered = (): BufferGeometry =>
  merged(
    trunk(0.22, 0.34, 3.6, 5, BARK_DARK, 11),
    part(new IcosahedronGeometry(2.4, 0), OAK_DARK, {
      at: [0, 3.7, 0],
      scale: [1, 0.45, 1],
      bumps: 0.2,
      salt: 12,
    }),
    part(new IcosahedronGeometry(2, 0), OAK, {
      at: [0.3, 4.9, -0.2],
      scale: [1, 0.5, 1],
      bumps: 0.2,
      salt: 13,
    }),
    part(new IcosahedronGeometry(1.3, 0), BEECH, {
      at: [-0.1, 6, 0.1],
      scale: [1, 0.65, 1],
      bumps: 0.15,
      salt: 14,
    }),
  );

const oakTieredFar = (): BufferGeometry =>
  merged(
    trunk(0.22, 0.34, 3.6, 3, BARK_DARK, 11),
    part(new IcosahedronGeometry(2.4, 0), OAK_DARK, {
      at: [0, 4, 0],
      scale: [1, 0.55, 1],
      bumps: 0.2,
      salt: 15,
    }),
    part(new IcosahedronGeometry(1.6, 0), OAK, {
      at: [0.2, 5.5, 0],
      scale: [1, 0.6, 1],
      bumps: 0.15,
      salt: 16,
    }),
  );

/** Peuplier : un fuseau de 32 facettes (octaèdre subdivisé étiré). */
const poplar = (): BufferGeometry =>
  merged(
    trunk(0.18, 0.3, 2.4, 5, BARK, 21),
    part(new OctahedronGeometry(1, 1), POPLAR, {
      at: [0, 8, 0],
      scale: [1.4, 6, 1.4],
      bumps: 0.12,
      salt: 22,
    }),
  );

/** Bouleau : tronc blanc en trois tranches, les facettes sombres font les marques de l'écorce. */
const birch = (): BufferGeometry =>
  merged(
    part(new CylinderGeometry(0.13, 0.2, 4.6, 5, 3, true), BIRCH_BARK, {
      at: [0, 2.3, 0],
      salt: 31,
      shade: 0.05,
      paint: (_centerY, roll) => (roll < 0.3 ? BIRCH_MARK : null),
    }),
    part(new IcosahedronGeometry(1.4, 0), BIRCH_LEAF, {
      at: [0.3, 5.3, 0],
      scale: [1, 1.25, 1],
      bumps: 0.2,
      salt: 32,
    }),
    part(new IcosahedronGeometry(1.1, 0), BIRCH_LEAF, {
      at: [-0.5, 6.4, 0.3],
      scale: [1, 1.2, 1],
      bumps: 0.15,
      salt: 33,
    }),
  );

const birchFar = (): BufferGeometry =>
  merged(
    trunk(0.13, 0.2, 4.6, 5, BIRCH_BARK, 34),
    part(new IcosahedronGeometry(1.5, 0), BIRCH_LEAF, {
      at: [0, 5.8, 0],
      scale: [1, 1.5, 1],
      bumps: 0.2,
      salt: 35,
    }),
  );

/** Saule pleureur : houppier aplati et jupe ouverte qui retombe jusqu'à un mètre du sol. */
const willow = (): BufferGeometry =>
  merged(
    trunk(0.3, 0.45, 2.4, 5, BARK_DARK, 41),
    part(new IcosahedronGeometry(2.6, 0), WILLOW, {
      at: [0, 3.7, 0],
      scale: [1, 0.6, 1],
      bumps: 0.2,
      salt: 42,
    }),
    part(new CylinderGeometry(2.3, 2.95, 2.7, 8, 1, true), WILLOW_HANG, {
      at: [0, 2.35, 0],
      bumps: 0.22,
      salt: 43,
    }),
  );

/** Cônes empilés qui débordent les uns des autres : les étages du sapin se lisent même de loin. */
const firTiers = (
  tiers: Vec3Tuple[],
  segments: number,
  salt: number,
): BufferGeometry[] =>
  tiers.map(([radius, height, base], i) =>
    part(
      new ConeGeometry(radius, height, segments),
      i % 2 === 0 ? FIR : FIR_LIGHT,
      { at: [0, base + height / 2, 0], bumps: 0.07, salt: salt + i },
    ),
  );

const fir = (): BufferGeometry =>
  merged(
    trunk(0.14, 0.24, 1.4, 5, BARK_DARK, 51),
    ...firTiers(
      [
        [2, 2.6, 0.9],
        [1.6, 2.4, 2.4],
        [1.15, 2.1, 3.8],
        [0.7, 1.8, 5.1],
      ],
      7,
      52,
    ),
  );

const firFar = (): BufferGeometry =>
  merged(
    trunk(0.14, 0.24, 1.4, 3, BARK_DARK, 51),
    ...firTiers(
      [
        [2, 3.6, 0.9],
        [1.3, 3.4, 3.4],
      ],
      6,
      58,
    ),
  );

/** Pin sylvestre : long fût brun en bas, orangé en haut, houppier plat. */
const scotsPine = (): BufferGeometry =>
  merged(
    part(new CylinderGeometry(0.12, 0.26, 6.6, 5, 2, true), BARK, {
      at: [0, 3.3, 0],
      salt: 61,
      shade: 0.06,
      paint: (centerY) => (centerY > 0 ? PINE_BARK_TOP : null),
    }),
    part(new IcosahedronGeometry(1.8, 0), SCOTS, {
      at: [0.4, 7, 0],
      scale: [1.25, 0.42, 1.1],
      bumps: 0.25,
      salt: 62,
    }),
    part(new IcosahedronGeometry(1.4, 0), SCOTS, {
      at: [-0.8, 7.7, 0.4],
      scale: [1.1, 0.5, 1],
      bumps: 0.2,
      salt: 63,
    }),
  );

/** Fruitier de verger : quelques facettes rouges font les pommes, sans un triangle de plus. */
const fruitTree = (): BufferGeometry =>
  merged(
    trunk(0.11, 0.17, 1.3, 5, BARK, 71),
    part(new IcosahedronGeometry(1.5, 0), ORCHARD_LEAF, {
      at: [0, 2.3, 0],
      scale: [1.15, 0.8, 1.15],
      bumps: 0.18,
      salt: 72,
      paint: (_centerY, roll) => (roll < 0.15 ? APPLE : null),
    }),
  );

/** Arbre mort, rare : tronc gris et quatre branches nues. */
const deadTree = (): BufferGeometry =>
  merged(
    trunk(0.12, 0.3, 4.2, 5, DEAD_WOOD, 81),
    branch(1.8, 0.75, 0.3, [0, 2.4, 0], 82),
    branch(1.5, 0.6, 2.4, [0, 2.9, 0], 83),
    branch(1.3, 0.8, 4.3, [0, 3.4, 0], 84),
    branch(1.1, 0.35, 1.2, [0, 3.9, 0], 85),
  );

/** `tree` et `pine` gardent leur nom (empreinte de `stageHash`, décor de la story 1.7) : chêne à lobes et sapin. */
export const TREE_GEOMETRY = {
  tree: oakLobed(),
  treeFar: oakLobedFar(),
  pine: fir(),
  pineFar: firFar(),
  oakTiered: oakTiered(),
  oakTieredFar: oakTieredFar(),
  poplar: poplar(),
  birch: birch(),
  birchFar: birchFar(),
  willow: willow(),
  scotsPine: scotsPine(),
  fruitTree: fruitTree(),
  deadTree: deadTree(),
};
