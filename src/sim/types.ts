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

export interface Track {
  /** Points de l'axe à pas constant, sans doublon de fermeture */
  points: Vec3[];
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
  /** Point de l'axe le plus proche, sur le plan horizontal */
  nearest: (x: number, z: number) => TrackSample;
  surfaceAt: (x: number, z: number) => Surface;
  /** Altitude du sol en (x, z), `null` hors du couloir d'une spéciale */
  groundAt: (x: number, z: number) => number | null;
  /** Pose de départ, dans le sens de la route */
  startPose: Pose;
  /** Pose de remise en piste au plus proche de (x, z), dans le sens de la route */
  respawnPose: (x: number, z: number) => Pose;
  /** Pose de remise en piste à une abscisse donnée, dans le sens de la route */
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
  /** Terrain conforme à la route, `null` tant que le pipeline ne le produit pas */
  terrain: MeshData | null;
  /** Version du pipeline : tout changement de seuil l'incrémente */
  pipelineVersion: number;
  /** Date de génération, ISO 8601. Hors empreinte. */
  generatedAt: string;
  /** Empreinte des entrées et des maillages (story 2.8), vide tant qu'elle n'est pas calculée */
  hash: string;
}

export type SceneryKind = "tree" | "pine" | "rock" | "hay" | "sign" | "post";

export interface SceneryItem {
  kind: SceneryKind;
  position: Vec3;
  /** Rotation autour de Y en radians */
  yaw: number;
  scale: number;
  /** Rayon du collider en mètres, 0 = pas de collision */
  colliderRadius: number;
}
