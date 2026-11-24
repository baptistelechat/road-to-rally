// Contrats partagés de la simulation. Aucun import React ni rendu ici.
//
// Repère monde et repère voiture : Y vers le haut, unités en mètres.
// Dans le repère local de la voiture : avant = -Z, droite = +X (convention three.js).

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Pose {
  position: Vec3;
  rotation: Quat;
}

export interface CarInput {
  /** -1 = plein gauche, +1 = plein droite */
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
  /** Remise en piste maintenue. Absent = relâché. */
  respawn?: boolean;
}

export const NEUTRAL_INPUT: Readonly<CarInput> = {
  steer: 0,
  throttle: 0,
  brake: 0,
  handbrake: false,
};

export type Surface = "asphalt" | "grass";

/** Ordre fixe des roues partout : avant gauche, avant droite, arrière gauche, arrière droite. */
export const WHEEL_COUNT = 4;

export interface WheelState {
  /** Angle de braquage en radians, positif = vers la droite */
  steerAngle: number;
  /** Rotation cumulée de la roue en radians, positif = marche avant */
  spinAngle: number;
  /** Décalage vertical du centre de roue par rapport à sa position au repos dans `carConfig`, en mètres */
  offsetY: number;
  /** 0 = suspension détendue, 1 = en butée */
  compression: number;
  inContact: boolean;
  surface: Surface;
  /** Glissement latéral normalisé, 0 = adhérence, 1 = pleine glisse */
  slip: number;
}

export interface CarState extends Pose {
  linearVelocity: Vec3;
  /** Vitesse en m/s, toujours positive */
  speed: number;
  /** Vitesse projetée sur l'avant de la voiture en m/s, négative en marche arrière */
  forwardSpeed: number;
  rpm: number;
  /** 1 à N en marche avant, -1 en marche arrière, 0 au point mort */
  gear: number;
  /** Charge du moteur, 0 à 1 : en marche arrière, c'est la pédale de frein qui la donne */
  throttle: number;
  /** Serrage des freins, 0 à 1 : en marche arrière, c'est la pédale d'accélérateur qui le donne */
  brake: number;
  handbrake: boolean;
  wheels: WheelState[];
  /** Dernier choc encaissé par la caisse, 0 à 1, pour le son et la caméra */
  impact: number;
}

/** Géométrie brute, utilisable pour un `BufferGeometry` comme pour un collider Rapier. */
export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
  /** RGB par sommet, 0 à 1 */
  colors?: Float32Array;
}

export interface TrackSample {
  /** Abscisse le long de l'axe, en mètres */
  s: number;
  point: Vec3;
  /** Tangente normalisée dans le sens de la route */
  tangent: Vec3;
  /** Distance horizontale à l'axe, en mètres */
  distance: number;
  /** Largeur de la route à cet endroit, en mètres */
  width: number;
}

/**
 * Aller-retour : la fin de l'axe recopie son début en sens inverse. Pour tout k de 0 à `armEnd`,
 * `points[returnStart + k]` et sa largeur valent exactement `points[armEnd - k]` et la sienne, et `returnStart + armEnd` est le dernier index.
 */
export interface SharedRange {
  /** Index de la jonction à l'aller : le bras finit ici, la boucle commence */
  armEnd: number;
  /** Index de la jonction au retour : la boucle finit ici, sur les mêmes coordonnées, et la recopie commence */
  returnStart: number;
}

export type ChicaneSide = "left" | "right";

/**
 * Un bloc de chicane : barrière sur les deux faces, pile de bottes entre les deux.
 * Repère du bloc : X = en travers de la route vers la droite, Y = haut, Z = le long de la route.
 */
export interface ChicaneBlock {
  /** Abscisse du centre du bloc */
  s: number;
  /** Bord de la route auquel le bloc s'accroche */
  side: ChicaneSide;
  /** Décalage du centre du bloc depuis l'axe, positif à droite */
  lateral: number;
  /** Longueur en travers de la route, bas-côté compris */
  span: number;
  /** Largeur de route laissée libre à côté du bloc */
  passage: number;
  /** Épaisseur le long de la route */
  depth: number;
  /** Hauteur au-dessus de `position.y` */
  height: number;
  /** Partie enterrée sous `position.y` */
  skirt: number;
  /** Centre du bloc au niveau de la route */
  position: Vec3;
  /** Rotation autour de Y en radians : l'axe X local pointe à droite de la route */
  yaw: number;
}

/** Îlot d'un rond-point : un cœur incassable, pour qu'on ne coupe pas par le centre, ceint de séparateurs renversables (`islandSeparators.ts`). */
export interface RoundaboutIsland {
  /** Centre au niveau de la route */
  position: Vec3;
  radius: number;
  /** Hauteur au-dessus de `position.y` */
  height: number;
  /** Partie enterrée sous `position.y` */
  skirt: number;
}

/** Glissière du terre-plein entre les deux chaussées d'un aller-retour en milieu de spéciale. */
export interface MedianBarrier {
  /** Pied de la glissière, au niveau du sol, tous les 2 m environ */
  points: Vec3[];
  /** Hauteur au-dessus des points */
  height: number;
  /** Partie enterrée sous les points */
  skirt: number;
}

/** Style d'un pont, choisi par le pipeline (`src/geo/bridges.ts`) */
export type BridgeStyle = "stone" | "concrete" | "steel" | "viaduct";

/** Un pont de la spéciale : l'ouvrage sous la route entre deux points de `points`. */
export interface StageBridge {
  /** Premier et dernier point de `points` sur le pont, dans l'axe unique */
  from: number;
  to: number;
  style: BridgeStyle;
  /** Demi-largeur du tablier, bas-côtés compris, en mètres */
  halfWidth: number;
}

/** Un tunnel de la spéciale (PR-21) : le tube autour de la route entre deux points de `points`. */
export interface StageTunnel {
  /** Premier et dernier point de `points` dans le tunnel, dans l'axe unique */
  from: number;
  to: number;
  /** Demi-largeur intérieure du tube, bas-côtés compris, en mètres */
  halfWidth: number;
  /** Montagne au-dessus du tube, là où la roche le recouvre. Absent : tube à l'air sur toute sa longueur. */
  roof?: MeshData;
}

/** Usage d'un bâtiment, pour sa couleur et son toit (epic 5) */
export type DecorBuildingKind =
  "house" | "farm" | "industrial" | "church" | "other";

/**
 * Typologie déduite des données IGN (story 5.2, labo `decor-lab/buildings`). L'ordre fixe l'empreinte : n'ajouter qu'à la fin.
 * `townHouse` maison de bourg, `shop` maison de bourg à vitrine, `house` pavillon, `longhouse` longère,
 * `barn` grange, `hangar` hangar ouvert, `workshop` bâtiment d'activité, `apartment` petit immeuble,
 * `tower` tour ou clocher seul, `annex` annexe ou garage.
 */
export const DECOR_BUILDING_TYPES = [
  "townHouse",
  "shop",
  "house",
  "longhouse",
  "barn",
  "hangar",
  "workshop",
  "apartment",
  "church",
  "chapel",
  "tower",
  "annex",
  "silo",
  "greenhouse",
  "monument",
] as const;
export type DecorBuildingType = (typeof DECOR_BUILDING_TYPES)[number];

/** Toit voulu ; le rendu retombe croupe → pignon → plat si l'emprise ne s'y prête pas. N'ajouter qu'à la fin. */
export const DECOR_ROOF_KINDS = [
  "gable",
  "hip",
  "flat",
  "parapet",
  "shed",
] as const;
export type DecorRoofKind = (typeof DECOR_ROOF_KINDS)[number];

/** `tile` tuile plate ou mécanique, `canal` tuile canal, `membrane` toit-terrasse. N'ajouter qu'à la fin. */
export const DECOR_ROOF_MATERIALS = [
  "tile",
  "canal",
  "slate",
  "metal",
  "glass",
  "stone",
  "membrane",
] as const;
export type DecorRoofMaterial = (typeof DECOR_ROOF_MATERIALS)[number];

/** Parement des murs. N'ajouter qu'à la fin. */
export const DECOR_WALL_MATERIALS = [
  "render",
  "stone",
  "granite",
  "brick",
  "wood",
  "metal",
  "glass",
] as const;
export type DecorWallMaterial = (typeof DECOR_WALL_MATERIALS)[number];

/** Un bâtiment réel (BD TOPO IGN), dans le plan local de la spéciale (story 5.2). */
export interface DecorBuilding {
  /** Emprise au sol, contour extérieur sans point répété, sens anti-horaire vu du dessus, au centimètre */
  footprint: { x: number; z: number }[];
  /** Altitude du pied dans le repère de la spéciale (comme `points[].y`), au point le plus bas de l'emprise */
  base: number;
  /** Hauteur des murs au-dessus de `base`, en mètres */
  height: number;
  kind: DecorBuildingKind;
  type: DecorBuildingType;
  /** Niveaux, rez-de-chaussée compris, au moins 1 */
  floors: number;
  roof: DecorRoofKind;
  roofMaterial: DecorRoofMaterial;
  wallMaterial: DecorWallMaterial;
  /** Murs mitoyens, croissants : le mur k va de `footprint[k]` à `footprint[k + 1]` */
  party: number[];
  /** Mur tourné vers la route (porte, vitrine), même numérotation */
  street: number;
}

/**
 * Végétation réelle (story 5.3). L'ordre fixe l'empreinte de `stageHash` : n'ajouter qu'à la fin.
 * `bush` : module de haie de 3 m, `vineRow` : module de rang de vigne de 5 m, tous deux allongés selon x local.
 * `tree` est le chêne à lobes, `pine` le sapin ; les autres essences du labo suivent `vineRow`.
 */
export const DECOR_TREE_KINDS = [
  "tree",
  "pine",
  "bush",
  "vineRow",
  "oakTiered",
  "poplar",
  "birch",
  "willow",
  "scotsPine",
  "fruitTree",
  "deadTree",
] as const;
export type DecorTreeKind = (typeof DECOR_TREE_KINDS)[number];

/** Un arbre réel ou peuplé dans une zone de végétation réelle (story 5.3). */
export interface DecorTree {
  kind: DecorTreeKind;
  position: Vec3;
  /** Rotation autour de Y en radians */
  yaw: number;
  scale: number;
}

/**
 * Surface d'eau à plat (stories 5.4 et 5.9) : étang, rivière, ou une case d'une rivière en pente.
 * Le terrain est creusé dessous : on peut y entrer. Sous un pont, la surface passe sous la route, à son propre niveau.
 */
export interface DecorWater {
  outline: { x: number; z: number }[];
  /** Îles, contours sans point répété. Absent : aucune. */
  holes?: { x: number; z: number }[][];
  /** Altitude de la surface dans le repère de la spéciale */
  y: number;
}

/**
 * Décor issu des vraies données, calculé une fois par le pipeline : de simples données, triées, arrondies,
 * identiques au bit près pour les mêmes entrées. La simulation n'en lit que ce qui porte un collider.
 */
export interface StageDecor {
  /** Triés par distance croissante à l'axe */
  buildings: DecorBuilding[];
  /** Triés par distance croissante à l'axe */
  trees: DecorTree[];
  water: DecorWater[];
}

export interface Track {
  /** Points de l'axe à pas constant, sans doublon de fermeture */
  points: Vec3[];
  /** Aller-retour : ce que la fin de l'axe recopie. `null` sur tout autre tracé. */
  shared: SharedRange | null;
  /** Ce qui existe une seule fois : ruban, collisions, décor et marquage ne parcourent que ça. Sans `shared`, tout l'axe. */
  unique: { points: Vec3[]; widths: number[]; shoulders: number[] };
  closed: boolean;
  /** Largeur la plus grande du tracé. Pour la largeur locale : `widths` ou `nearest().width`. */
  width: number;
  /** Largeur en chaque point de l'axe */
  widths: number[];
  /** Largeur du bas-côté en chaque point, rétrécie là où deux branches d'épingle se touchent */
  shoulders: number[];
  length: number;
  /** Abscisse de la ligne de départ : 0 sur le circuit, après le prolongement sur une spéciale */
  startS: number;
  /** Abscisse de la ligne d'arrivée : `length` sur le circuit */
  finishS: number;
  ribbon: MeshData;
  /** Terrain d'une spéciale, `null` sur le circuit qui garde son sol plat */
  terrain: MeshData | null;
  /** Blocs de chicane, fixes, triés par abscisse. Vide sans chicane. */
  obstacles: ChicaneBlock[];
  /** Voies en chaque point de `unique.points`, pour le marquage. Absent : deux partout, comme le circuit. */
  laneCounts?: number[];
  /** Îlots des ronds-points roulés. Vide sans rond-point. */
  islands: RoundaboutIsland[];
  /** Glissières des terre-pleins. Vide sans aller-retour en milieu de spéciale. */
  medians: MedianBarrier[];
  /** Décor réel d'une spéciale (epic 5). Absent sur le circuit et sur une spéciale sans données de décor. */
  decor?: StageDecor;
  /** Ponts d'une spéciale. Absent sans pont. */
  bridges?: StageBridge[];
  /** Tunnels autour de la route. Absent sans tunnel, ou sur une spéciale d'avant. */
  tunnels?: StageTunnel[];
  /**
   * Point de l'axe le plus proche, sur le plan horizontal. Sans référence, ou hors aller-retour : au bit près le même, et le
   * premier passage en cas de superposition. Avec `nearS`, l'abscisse suivie : le passage de la voiture, pas le premier venu.
   */
  nearest: (x: number, z: number, nearS?: number) => TrackSample;
  surfaceAt: (x: number, z: number) => Surface;
  /** Altitude du sol en (x, z), `null` hors du couloir d'une spéciale */
  groundAt: (x: number, z: number) => number | null;
  /** Niveau de l'eau en (x, z), `null` hors de l'eau (story 5.9). Absent : aucune eau, circuit compris. */
  waterAt?: (x: number, z: number) => number | null;
  /** Pose de départ, dans le sens de la route */
  startPose: Pose;
  /** Pose de remise en piste au plus proche de (x, z), dans le sens de la route, reculée hors de tout bloc de chicane */
  respawnPose: (x: number, z: number) => Pose;
  /** Pose de remise en piste à une abscisse donnée, dans le sens de la route, reculée hors de tout bloc de chicane */
  poseAt: (s: number) => Pose;
  /** Point de l'axe le plus proche d'une abscisse. Le pas réel varie avec la pente : pas de division par le pas moyen. */
  indexAt: (s: number) => number;
}

/**
 * Spéciale prête à rouler : de simples données, sans réseau ni fonction.
 * Tout le pipeline de `src/geo/` aboutit ici, et `src/sim/` ne connaît que ce contrat.
 */
export interface StageData {
  name: string;
  /** Origine de la projection locale : x vers l'est, z vers le sud */
  origin: { lat: number; lon: number };
  /** Altitude réelle de y = 0, en mètres */
  baseAltitude: number;
  /** Axe à pas constant, prolongement compris, arrondi au millimètre. y >= 0. */
  points: Vec3[];
  /** Largeur en chaque point de `points` */
  widths: number[];
  /** Abscisses des lignes de départ et d'arrivée le long de `points` */
  startS: number;
  finishS: number;
  /** Aller-retour sur la même route (story 3.7). Absent sur tout autre tracé. */
  shared?: SharedRange;
  /** Blocs de chicane déjà calculés, triés par abscisse (story 3.8). Absent sans chicane. */
  obstacles?: ChicaneBlock[];
  /** Voies de circulation en chaque point de `points`, pour le marquage seul. Absent sur une spéciale d'avant : deux partout. */
  lanes?: number[];
  /** Îlots des ronds-points, dans l'ordre du passage. Absent sans rond-point. */
  islands?: RoundaboutIsland[];
  /** Glissières des terre-pleins, dans l'ordre du passage. Absent sans aller-retour en milieu de spéciale. */
  medians?: MedianBarrier[];
  /** Terrain conforme à la route, `null` tant que le pipeline ne le produit pas */
  terrain: MeshData | null;
  /** Ponts dessinés sous la route. Absent sans pont, ou sur une spéciale d'avant : la route seule, comme avant. */
  bridges?: StageBridge[];
  /** Tunnels autour de la route. Absent sans tunnel, ou sur une spéciale d'avant. */
  tunnels?: StageTunnel[];
  /** Décor réel (epic 5). Absent : données indisponibles ou spéciale d'avant, le décor procédural de la story 1.7 prend le relais. */
  decor?: StageDecor;
  /** Version du pipeline : tout changement de seuil l'incrémente */
  pipelineVersion: number;
  /** Date de génération, ISO 8601. Hors empreinte. */
  generatedAt: string;
  /** Empreinte des entrées et des maillages (story 2.8), vide tant qu'elle n'est pas calculée */
  hash: string;
}

export type SceneryKind =
  /** Chêne à lobes et sapin : la végétation pseudo-aléatoire de la story 1.7 et les arbres réels les plus courants */
  | "tree"
  | "pine"
  /** Autres essences réelles (story 5.3), mêmes règles de collider que `tree` */
  | "oakTiered"
  | "poplar"
  | "birch"
  | "willow"
  | "scotsPine"
  | "fruitTree"
  | "deadTree"
  /** Versions lointaines, choisies par `scenery.ts` selon la distance au bord de route : jamais de collider */
  | "treeFar"
  | "pineFar"
  | "oakTieredFar"
  | "birchFar"
  /** Haie et vigne réelles : décor seul, sans collider (story 5.3) ; `vineRowFar` est la bande économique de loin */
  | "bush"
  | "vineRow"
  | "vineRowFar"
  /** Même buisson ou rang, près de la route : objet léger renversable (voir `lightProps.ts`), en fin de décor */
  | "bushProp"
  | "vineRowProp"
  | "rock"
  | "hay"
  | "hayUpright"
  | "sign"
  | "post"
  /** Annonce de chicane, dessin d'un premier virage à gauche ou à droite (voir `chicaneSignKind`) */
  | "chicaneSignLeft"
  | "chicaneSignRight"
  /**
   * Panneau de freinage avant un virage serré au bout d'une ligne droite : 3, 2 puis 1 chevrons vers le virage
   * (voir `brakeBoards.ts`). Dessiné des deux côtés : tourné d'un demi-tour, il pointe à gauche.
   */
  | "brakeBoard3"
  | "brakeBoard2"
  | "brakeBoard1"
  /** Séparateur plastique lesté autour d'un îlot de rond-point (voir `islandSeparators.ts`), rouge et blanc en alternance */
  | "islandSeparatorRed"
  | "islandSeparatorWhite"
  /** Spectateur : décor seul, sans collider (story 5.5) */
  | "spectator"
  | RallySceneryKind;

/**
 * Habillage rallye (story 5.5, `rallyDressing.ts`) : commissaire sans collider, tente fixe, le reste (rubalise
 * comprise) renversable comme les panneaux (voir `RALLY_PROP_SHAPE`).
 */
export type RallySceneryKind =
  | "marshal"
  | "rallyTape"
  | "rallyTent"
  | "rallySail"
  | "rallyPlacard"
  | "rallyMast"
  | "rallyCheckerMast"
  | "rallyBanner"
  | "rallyBarrier";

export interface SceneryItem {
  kind: SceneryKind;
  position: Vec3;
  /** Rotation autour de Y en radians */
  yaw: number;
  /** Normale du sol sous l'objet, unitaire. Absente : posé à plat. */
  up?: Vec3;
  scale: number;
  /** Rayon du collider en mètres, 0 = pas de collision */
  colliderRadius: number;
}
