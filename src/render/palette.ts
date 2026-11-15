// Couleurs du décor réel (epic 5), en RVB linéaire 0..1 comme les couleurs par sommet du reste du jeu.
// La direction artistique (story 5.1) règle ces valeurs ; les vues du décor ne codent aucune couleur en dur.

export type Rgb = [number, number, number];

export interface DecorPalette {
  wall: Record<"house" | "farm" | "industrial" | "church" | "other", Rgb>;
  roof: Record<"house" | "farm" | "industrial" | "church" | "other", Rgb>;
  water: Rgb;
  /** Teintes du sol par occupation (story 5.4) */
  ground: {
    field: Rgb;
    meadow: Rgb;
    vineyard: Rgb;
    orchard: Rgb;
    forestFloor: Rgb;
    built: Rgb;
  };
}

export const DECOR_PALETTE: DecorPalette = {
  wall: {
    house: [0.86, 0.8, 0.68],
    farm: [0.72, 0.62, 0.48],
    industrial: [0.62, 0.64, 0.66],
    church: [0.78, 0.74, 0.64],
    other: [0.76, 0.72, 0.64],
  },
  roof: {
    house: [0.6, 0.27, 0.18],
    farm: [0.48, 0.3, 0.22],
    industrial: [0.42, 0.44, 0.47],
    church: [0.33, 0.35, 0.4],
    other: [0.5, 0.3, 0.24],
  },
  water: [0.22, 0.38, 0.45],
  ground: {
    field: [0.66, 0.58, 0.3],
    meadow: [0.36, 0.5, 0.22],
    vineyard: [0.46, 0.44, 0.25],
    orchard: [0.38, 0.47, 0.22],
    forestFloor: [0.22, 0.3, 0.15],
    built: [0.5, 0.48, 0.42],
  },
};

/** Teintes des bâtiments typés (story 5.2), reprises du labo `decor-lab/buildings`. */
export interface BuildingPalette {
  /** Façades : plusieurs teintes par parement, une tirée par bâtiment selon sa position */
  facade: {
    /** Crépis de bourg : beige, blanc cassé, ocre clair, rosé */
    render: Rgb[];
    /** Crépis de pavillon, plus clairs */
    renderLight: Rgb[];
    stone: Rgb[];
    granite: Rgb[];
    brick: Rgb[];
    wood: Rgb[];
    metal: Rgb[];
    /** Bardage vert ou bleu des entrepôts */
    metalGreen: Rgb[];
    /** Tôle galvanisée ou béton des silos */
    silo: Rgb[];
    /** Verre de serre, gris-bleu très clair */
    glass: Rgb[];
    /** Pierre de taille claire des monuments */
    stoneLight: Rgb[];
  };
  roof: {
    tile: Rgb;
    tileDark: Rgb;
    canal: Rgb;
    slate: Rgb;
    metal: Rgb;
    metalDark: Rgb;
    membrane: Rgb;
    glass: Rgb;
    stone: Rgb;
  };
  /** Volets battants : bleu-gris, vert, bordeaux, blanc cassé */
  shutters: Rgb[];
  /** Volets bleus des longères bretonnes */
  shuttersBlue: Rgb[];
  detail: {
    glass: Rgb;
    glassBlue: Rgb;
    stainedGlass: Rgb;
    frame: Rgb;
    doorWood: Rgb;
    doorSteel: Rgb;
    doorDark: Rgb;
    sign: Rgb;
    plinthStone: Rgb;
    plinthGrey: Rgb;
    concrete: Rgb;
    quoins: Rgb;
    quoinsGranite: Rgb;
    chimney: Rgb;
    underside: Rgb;
    post: Rgb;
    ridge: Rgb;
    ridgeSlate: Rgb;
    parapet: Rgb;
    parapetLight: Rgb;
  };
}

export const BUILDING_PALETTE: BuildingPalette = {
  facade: {
    render: [
      [0.88, 0.83, 0.72],
      [0.9, 0.88, 0.82],
      [0.85, 0.75, 0.6],
      [0.87, 0.77, 0.7],
    ],
    renderLight: [
      [0.93, 0.91, 0.87],
      [0.91, 0.89, 0.83],
      [0.9, 0.86, 0.78],
    ],
    stone: [
      [0.72, 0.62, 0.47],
      [0.68, 0.6, 0.49],
      [0.76, 0.67, 0.52],
    ],
    granite: [
      [0.56, 0.56, 0.54],
      [0.6, 0.59, 0.56],
      [0.52, 0.52, 0.5],
    ],
    brick: [
      [0.62, 0.38, 0.27],
      [0.58, 0.36, 0.27],
    ],
    wood: [
      [0.38, 0.27, 0.18],
      [0.42, 0.31, 0.21],
    ],
    metal: [
      [0.74, 0.76, 0.77],
      [0.7, 0.72, 0.74],
    ],
    metalGreen: [
      [0.3, 0.42, 0.34],
      [0.32, 0.38, 0.42],
    ],
    silo: [
      [0.78, 0.79, 0.8],
      [0.72, 0.73, 0.73],
    ],
    glass: [
      [0.84, 0.88, 0.9],
      [0.82, 0.86, 0.89],
    ],
    stoneLight: [
      [0.82, 0.78, 0.7],
      [0.78, 0.75, 0.68],
    ],
  },
  roof: {
    tile: [0.6, 0.27, 0.18],
    tileDark: [0.47, 0.23, 0.16],
    canal: [0.68, 0.36, 0.22],
    slate: [0.25, 0.27, 0.31],
    metal: [0.52, 0.54, 0.56],
    metalDark: [0.36, 0.38, 0.41],
    membrane: [0.45, 0.44, 0.41],
    glass: [0.8, 0.86, 0.9],
    stone: [0.72, 0.69, 0.62],
  },
  shutters: [
    [0.36, 0.48, 0.56],
    [0.3, 0.42, 0.32],
    [0.46, 0.2, 0.18],
    [0.82, 0.8, 0.74],
  ],
  shuttersBlue: [[0.28, 0.4, 0.52]],
  detail: {
    glass: [0.14, 0.17, 0.21],
    glassBlue: [0.2, 0.28, 0.36],
    stainedGlass: [0.17, 0.16, 0.28],
    frame: [0.9, 0.88, 0.82],
    doorWood: [0.32, 0.21, 0.14],
    doorSteel: [0.56, 0.58, 0.6],
    doorDark: [0.2, 0.2, 0.21],
    sign: [0.55, 0.16, 0.14],
    plinthStone: [0.46, 0.43, 0.39],
    plinthGrey: [0.52, 0.52, 0.51],
    concrete: [0.6, 0.6, 0.58],
    quoins: [0.84, 0.8, 0.7],
    quoinsGranite: [0.46, 0.46, 0.45],
    chimney: [0.62, 0.5, 0.42],
    underside: [0.4, 0.33, 0.27],
    post: [0.36, 0.3, 0.24],
    ridge: [0.42, 0.18, 0.12],
    ridgeSlate: [0.18, 0.19, 0.22],
    parapet: [0.62, 0.64, 0.66],
    parapetLight: [0.8, 0.79, 0.75],
  },
};
