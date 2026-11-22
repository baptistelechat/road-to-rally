import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Shape,
  TorusGeometry,
} from "three";
import {
  linear,
  merged,
  piece,
  placed,
  type Rgb,
  segment,
} from "./crowd/geometry";

// Habillage rallye repris du labo « Public et banderoles » (`src/app/decor-lab/crowd/dressing.ts`) : couleurs par
// sommet, origine au pied. Les textes viennent de l'atlas `rallyAtlas.ts`, les drapeaux de `crowd/flagAtlas.ts`.

/** Couleurs de marque, tokens sombres de `globals.css` (« Nuit facettée ») : le jaune en tête, le bleu en touche. */
export const RALLY_HEX = {
  /** --brand */
  brand: "#ffd23f",
  /** --brand-foreground, --background */
  ink: "#0b1018",
  /** --card */
  night: "#121a26",
  /** --accent */
  slate: "#1e2a3c",
  /** --foreground */
  snow: "#e9edf3",
  /** --chart-2, en touche secondaire seulement */
  sky: "#5fb3ff",
} as const;

const DA = {
  brand: linear(RALLY_HEX.brand),
  ink: linear(RALLY_HEX.ink),
  night: linear(RALLY_HEX.night),
  snow: linear(RALLY_HEX.snow),
  sky: linear(RALLY_HEX.sky),
  // Matières, rubalise et damier : couleurs réelles, hors charte.
  tapeRed: linear("#d9472b"),
  white: linear("#f4f2ec"),
  black: linear("#10161f"),
  steel: linear("#8d9299"),
  wood: linear("#7a5a3a"),
};

/** Arche gonflable du labo : 11 m entre les pieds ; la vue la met à l'échelle de chaque arche du jeu. */
export const ARCH_SPAN = 11;
/** Centre de l'enseigne et du panneau lumineux, à l'échelle du labo */
export const ARCH_SIGN = { y: 4.1, width: 4, height: 1 };
export const ARCH_LIGHTS_Y = 3.3;
/** Échelle de l'arche du labo pour que ses pieds tombent à `halfSpan`, là où sont leurs colliders. */
export const archScale = (halfSpan: number): number =>
  halfSpan / (ARCH_SPAN / 2);

/** Banderole tendue : toile de 6 × 1 m, centre à 1,85 m */
export const BANNER = { width: 6, height: 1, y: 1.85 };
/** Face imprimée de la pancarte, juste devant la planche */
export const PLACARD_FACE = { width: 0.94, height: 0.54, y: 1.45, z: 0 };
/** Enseigne de la tente, sur le lambrequin côté route (+Z local) */
export const TENT_SIGN = { width: 2.9, height: 0.21, y: 2.1, z: 1.52 };
/** Toile du drapeau de pays au sommet du mât, en 3:2 comme les cellules de l'atlas */
export const MAST_CLOTH = { width: 1.26, height: 0.84, top: 4.95, segments: 6 };
/** Longueur d'un module de rubalise, le même que dans `rallyDressing.ts` */
export const TAPE_MODULE = 5;

/** Recolore chaque triangle selon son rang. */
const painted = (
  geometry: BufferGeometry,
  colorOf: (triangle: number) => Rgb,
): BufferGeometry => {
  const attribute = geometry.getAttribute("color");
  for (let vertex = 0; vertex < attribute.count; vertex++)
    attribute.setXYZ(vertex, ...colorOf(Math.floor(vertex / 3)));
  return geometry;
};

/** Rubalise rouge et blanche sur piquets, centrée, le long de X ; le ruban s'affaisse entre deux piquets. */
const tapeModule = (length: number, spacing = 2.5): BufferGeometry => {
  const spans = Math.max(1, Math.round(length / spacing));
  const step = length / spans;
  const from = -length / 2;
  const parts: BufferGeometry[] = [];
  const pieces = 5;
  const sag = (t: number): number => 1.02 - 0.12 * 4 * t * (1 - t);
  for (let s = 0; s <= spans; s++)
    parts.push(
      piece(
        placed(new BoxGeometry(0.05, 1.1, 0.05), [from + s * step, 0.55, 0]),
        { color: DA.white },
      ),
    );
  for (let s = 0; s < spans; s++)
    for (let p = 0; p < pieces; p++) {
      const t0 = p / pieces;
      const t1 = (p + 1) / pieces;
      parts.push(
        segment(
          [from + (s + t0) * step, sag(t0), 0],
          [from + (s + t1) * step, sag(t1), 0],
          0.035,
          4,
          { color: (s * pieces + p) % 2 === 0 ? DA.tapeRed : DA.white },
        ),
      );
    }
  return merged(parts);
};

/** Arche gonflable en demi-tore, jaune de marque et nuit par quartiers, pieds lestés et enfoncés d'un mètre. */
const inflatableArch = (span: number): BufferGeometry => {
  const radius = span / 2;
  const tube = 0.45;
  const torus = piece(new TorusGeometry(radius, tube, 6, 12, Math.PI));
  // Les triangles vont par paires, tronçon après tronçon : on colore par tronçon le long de l'arche.
  painted(torus, (triangle) =>
    Math.floor((Math.floor(triangle / 2) % 12) / 4) === 1 ? DA.night : DA.brand,
  );
  return merged([
    torus,
    // Lest de 1,1 m de côté, du sol à 1 m dessous : le bas-côté descend parfois.
    ...[-radius, radius].map((x) =>
      piece(placed(new BoxGeometry(1.1, 1.35, 1.1), [x, -0.325, 0]), {
        color: DA.ink,
      }),
    ),
  ]);
};

/** Voile « beach flag » sur mât souple : une plume extrudée d'un centimètre, visible des deux côtés. */
const beachFlag = (main: Rgb, edge: Rgb): BufferGeometry => {
  const outline = new Shape();
  outline.moveTo(0, 0);
  outline.lineTo(0, 2.6);
  outline.quadraticCurveTo(0.2, 3.2, 0.75, 3.0);
  outline.quadraticCurveTo(0.8, 1.6, 0.6, 0.7);
  outline.lineTo(0, 0);
  const sail = new ExtrudeGeometry(outline, {
    depth: 0.01,
    bevelEnabled: false,
    curveSegments: 3,
  });
  return merged([
    segment([0, 0, 0], [0, 3.6, 0], 0.025, 5, { color: DA.steel }),
    piece(placed(sail, [0, 0.6, -0.005]), { color: main }),
    segment([0.02, 0.62, 0.01], [0.02, 3.2, 0.01], 0.03, 4, { color: edge }),
  ]);
};

/** Mât seul : la toile du pays vient de l'atlas des drapeaux. */
const flagMast = (): BufferGeometry =>
  merged([segment([0, 0, 0], [0, 5, 0], 0.04, 6, { color: DA.steel })]);

/** Mât et drapeau à damier noir et blanc, ondulé en trois lés : l'arrivée. */
const checkerMast = (): BufferGeometry => {
  const cell = MAST_CLOTH.width / 6;
  const cells: BufferGeometry[] = [];
  for (let column = 0; column < 6; column++)
    for (let row = 0; row < 4; row++)
      cells.push(
        piece(
          placed(new BoxGeometry(cell, cell, 0.02), [
            0.04 + cell * (column + 0.5),
            MAST_CLOTH.top - cell * (row + 0.5),
            Math.floor(column / 2) % 2 === 0 ? 0 : 0.05,
          ]),
          { color: (column + row) % 2 === 0 ? DA.black : DA.white },
        ),
      );
  return merged([
    segment([0, 0, 0], [0, 5, 0], 0.04, 6, { color: DA.steel }),
    ...cells,
  ]);
};

/** Barnum de 3 m : quatre pieds, toit pyramidal à pans alternés, lambrequin. Façade en +Z. */
const tent = (roof: Rgb[], skirt: Rgb): BufferGeometry => {
  const half = 1.5;
  const legs = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ].map(([x, z]) =>
    segment([x, 0, z], [x, 2.2, z], 0.035, 4, { color: DA.steel }),
  );
  const top = piece(
    placed(
      new ConeGeometry(half * 1.414, 0.9, 4),
      [0, 2.65, 0],
      [0, Math.PI / 4, 0],
    ),
  );
  painted(top, (triangle) => roof[triangle % roof.length]);
  const skirts = [0, 1, 2, 3].map((i) =>
    piece(
      placed(
        new BoxGeometry(half * 2, 0.22, 0.02),
        [
          Math.sin((i * Math.PI) / 2) * half,
          2.1,
          Math.cos((i * Math.PI) / 2) * half,
        ],
        [0, (i * Math.PI) / 2, 0],
      ),
      { color: skirt },
    ),
  );
  return merged([...legs, top, ...skirts]);
};

/** Deux piquets haubanés ; la toile imprimée est un plan texturé à part. */
const bannerPosts = (width: number, top: number): BufferGeometry =>
  merged(
    [-width / 2 - 0.05, width / 2 + 0.05].flatMap((x) => [
      segment([x, 0, 0], [x, top + 0.15, 0], 0.035, 6, { color: DA.steel }),
      segment([x, top + 0.1, 0], [x + Math.sign(x) * 1.2, 0, -0.5], 0.008, 3, {
        color: DA.ink,
      }),
    ]),
  );

/** Piquet et planche d'une pancarte ; le message est un plan texturé posé devant. */
const placardStake = (): BufferGeometry =>
  merged([
    piece(placed(new BoxGeometry(0.06, 1.5, 0.06), [0, 0.75, -0.04]), {
      color: DA.wood,
    }),
    piece(placed(new BoxGeometry(1.0, 0.6, 0.03), [0, 1.45, -0.02]), {
      color: DA.white,
    }),
  ]);

// ponytail: géométries partagées toute la vie de l'application, comme `SCENERY_GEOMETRY`.
export const RALLY_GEOMETRY = {
  arch: inflatableArch(ARCH_SPAN),
  tape: tapeModule(TAPE_MODULE),
  /** Une voile sur quatre reprend le bleu, en touche secondaire ; les autres le jaune et la nuit. */
  sails: [
    beachFlag(DA.brand, DA.night),
    beachFlag(DA.night, DA.brand),
    beachFlag(DA.brand, DA.snow),
    beachFlag(DA.sky, DA.night),
  ],
  mast: flagMast(),
  checkerMast: checkerMast(),
  tent: tent([DA.brand, DA.night], DA.night),
  bannerPosts: bannerPosts(BANNER.width, 2.4),
  placard: placardStake(),
  /** Rallonge d'un pied d'arche vers un sol plus bas : 1 m de haut, origine en bas, à l'échelle de l'arche en largeur */
  archLeg: piece(placed(new CylinderGeometry(0.45, 0.45, 1, 6), [0, 0.5, 0]), {
    color: DA.brand,
  }),
  /** Lest posé sur le sol réel, sous un pied rallongé ou raccourci */
  archBallast: piece(placed(new BoxGeometry(1.1, 0.35, 1.1), [0, 0.175, 0]), {
    color: DA.ink,
  }),
  /** Corde de la banderole d'intermédiaire : 1 m de long en x, mise à l'écartement des mâts */
  bannerRope: piece(new BoxGeometry(1, 0.06, 0.06), { color: DA.ink }),
};
