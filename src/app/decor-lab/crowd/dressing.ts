import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
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
  type Vec3,
} from "./geometry";

// Habillage du bord de route : couleurs fixes par sommet, origine au pied. Le lettrage vient de textures à part.

/** Couleurs de l'application : tokens sombres de `globals.css` (direction « Nuit facettée »), le jaune de marque en tête. */
export const APP_HEX = {
  /** --brand */
  brand: "#ffd23f",
  /** --background */
  ink: "#0b1018",
  /** --card */
  night: "#121a26",
  /** --accent */
  slate: "#1e2a3c",
  /** --foreground */
  snow: "#e9edf3",
  /** --muted-foreground */
  mist: "#93a0b4",
  /** --chart-2, en touche secondaire seulement */
  sky: "#5fb3ff",
  /** --chart-3 */
  ember: "#ff8f5a",
  /** --chart-4 */
  mint: "#7ee0a1",
  /** --chart-5 */
  violet: "#c792ff",
} as const;

export const DA = {
  brand: linear(APP_HEX.brand),
  ink: linear(APP_HEX.ink),
  night: linear(APP_HEX.night),
  slate: linear(APP_HEX.slate),
  snow: linear(APP_HEX.snow),
  mist: linear(APP_HEX.mist),
  sky: linear(APP_HEX.sky),
  ember: linear(APP_HEX.ember),
  mint: linear(APP_HEX.mint),
  violet: linear(APP_HEX.violet),
  // Matières et rubalise : couleurs réelles, hors charte.
  tapeRed: linear("#d9472b"),
  white: linear("#f4f2ec"),
  steel: linear("#8d9299"),
  wood: linear("#7a5a3a"),
};

/** Recolore chaque triangle selon son rang : la couleur vient de `colorOf`. */
const painted = (
  geometry: BufferGeometry,
  colorOf: (triangle: number) => Rgb,
): BufferGeometry => {
  const attribute = geometry.getAttribute("color");
  for (let vertex = 0; vertex < attribute.count; vertex++) {
    attribute.setXYZ(vertex, ...colorOf(Math.floor(vertex / 3)));
  }
  return geometry;
};

/** Rubalise rouge et blanche sur piquets, le long de +X ; le ruban s'affaisse entre deux piquets. */
export const tapeLine = (length: number, spacing = 2.5): BufferGeometry => {
  const spans = Math.max(1, Math.round(length / spacing));
  const step = length / spans;
  const parts: BufferGeometry[] = [];
  const pieces = 5;
  for (let s = 0; s <= spans; s++) {
    parts.push(
      piece(placed(new BoxGeometry(0.05, 1.1, 0.05), [s * step, 0.55, 0]), {
        color: DA.white,
      }),
    );
  }
  for (let s = 0; s < spans; s++) {
    for (let p = 0; p < pieces; p++) {
      const t0 = p / pieces;
      const t1 = (p + 1) / pieces;
      const sag = (t: number): number => 1.02 - 0.12 * 4 * t * (1 - t);
      parts.push(
        segment(
          [s * step + t0 * step, sag(t0), 0],
          [s * step + t1 * step, sag(t1), 0],
          0.035,
          4,
          {
            color: (s * pieces + p) % 2 === 0 ? DA.tapeRed : DA.white,
          },
        ),
      );
    }
  }
  return merged(parts);
};

/** Deux piquets et leurs haubans ; la toile imprimée est un plan texturé à part. */
export const bannerPosts = (width: number, top: number): BufferGeometry =>
  merged(
    [-width / 2 - 0.05, width / 2 + 0.05].flatMap((x) => [
      segment([x, 0, 0], [x, top + 0.15, 0], 0.035, 6, { color: DA.steel }),
      segment([x, top + 0.1, 0], [x + Math.sign(x) * 1.2, 0, -0.5], 0.008, 3, {
        color: DA.ink,
      }),
    ]),
  );

/** Arche gonflable en demi-tore, jaune de marque et nuit par quartiers, lestée aux pieds : la même au départ, aux intermédiaires et à l'arrivée. */
export const inflatableArch = (span: number): BufferGeometry => {
  const radius = span / 2;
  const tube = 0.45;
  const torus = piece(new TorusGeometry(radius, tube, 6, 12, Math.PI));
  // Les triangles vont par paires, tronçon après tronçon autour du tube : on colore par tronçon le long de l'arche.
  painted(torus, (triangle) =>
    Math.floor((Math.floor(triangle / 2) % 12) / 4) === 1 ? DA.night : DA.brand,
  );
  return merged([
    torus,
    ...[-radius, radius].map((x) =>
      piece(placed(new BoxGeometry(1.1, 0.35, 1.1), [x, 0.17, 0]), {
        color: DA.ink,
      }),
    ),
  ]);
};

/** Voile « beach flag » sur mât souple : une forme de plume, recto et verso. */
export const beachFlag = (main: Rgb, edge: Rgb): BufferGeometry => {
  const outline = new Shape();
  outline.moveTo(0, 0);
  outline.lineTo(0, 2.6);
  outline.quadraticCurveTo(0.2, 3.2, 0.75, 3.0);
  outline.quadraticCurveTo(0.8, 1.6, 0.6, 0.7);
  outline.lineTo(0, 0);
  // Voile extrudée d'un centimètre : visible des deux côtés sans matériau double face.
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

/** Mât et drapeau rectangulaire ondulé en trois lés. */
export const flagPole = (bands: Rgb[]): BufferGeometry =>
  merged([
    segment([0, 0, 0], [0, 5, 0], 0.04, 6, { color: DA.steel }),
    ...bands.map((color, i) =>
      piece(
        placed(
          new BoxGeometry(0.42, 0.9, 0.02),
          [0.25 + i * 0.42, 4.5, (i % 2) * 0.06],
          [0, i % 2 === 0 ? 0.18 : -0.18, 0],
        ),
        { color },
      ),
    ),
  ]);

/** Mât seul : la toile du pays vient de l'atlas des drapeaux (voir `MastFlags`). */
export const flagMast = (): BufferGeometry =>
  merged([segment([0, 0, 0], [0, 5, 0], 0.04, 6, { color: DA.steel })]);

/** Barnum de 3 m : quatre pieds, toit pyramidal à pans alternés, lambrequin. */
export const tent = (roof: Rgb[], skirt: Rgb): BufferGeometry => {
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

/** Parasol de plage à huit pans rayés. */
export const parasol = (colors: Rgb[]): BufferGeometry => {
  const canopy = piece(placed(new ConeGeometry(1.2, 0.4, 8), [0, 2.1, 0]));
  painted(canopy, (triangle) => colors[triangle % colors.length]);
  return merged([
    segment([0, 0, 0], [0.12, 2.15, 0], 0.025, 5, { color: DA.white }),
    canopy,
  ]);
};

/** Chaise pliante : toile tendue, pieds en X. Face au +Z. */
export const foldingChair = (cloth: Rgb): BufferGeometry =>
  merged([
    piece(placed(new BoxGeometry(0.46, 0.04, 0.42), [0, 0.45, 0]), {
      color: cloth,
    }),
    piece(
      placed(new BoxGeometry(0.46, 0.5, 0.04), [0, 0.75, -0.24], [-0.15, 0, 0]),
      { color: cloth },
    ),
    ...[-0.22, 0.22].flatMap((x) => [
      segment([x, 0, -0.2], [x, 0.45, 0.2], 0.015, 4, { color: DA.steel }),
      segment([x, 0, 0.2], [x, 0.45, -0.2], 0.015, 4, { color: DA.steel }),
    ]),
  ]);

/** Rambarde de bois : poteaux et deux lisses, le long de +X. */
export const woodRail = (length: number): BufferGeometry => {
  const posts = Math.max(2, Math.round(length / 2) + 1);
  return merged([
    ...Array.from({ length: posts }, (_, i) =>
      piece(
        placed(new BoxGeometry(0.1, 1.05, 0.1), [
          (i * length) / (posts - 1),
          0.52,
          0,
        ]),
        { color: DA.wood },
      ),
    ),
    ...[0.55, 0.98].map((y) =>
      piece(
        placed(new BoxGeometry(length + 0.1, 0.08, 0.06), [length / 2, y, 0]),
        { color: DA.wood },
      ),
    ),
  ]);
};

/** Piquet et planche d'une pancarte ; le message est un plan texturé posé devant. */
export const placardStake = (): BufferGeometry =>
  merged([
    piece(placed(new BoxGeometry(0.06, 1.5, 0.06), [0, 0.75, -0.04]), {
      color: DA.wood,
    }),
    piece(placed(new BoxGeometry(1.0, 0.6, 0.03), [0, 1.45, -0.02]), {
      color: DA.white,
    }),
  ]);

/** Face imprimée de la pancarte, juste devant la planche. */
export const PLACARD_FACE: { width: number; height: number; at: Vec3 } = {
  width: 0.94,
  height: 0.54,
  at: [0, 1.45, 0],
};
