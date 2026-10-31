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
  throttle: number;
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
}

export interface Track {
  /** Points de l'axe à pas constant, sans doublon de fermeture */
  points: Vec3[];
  closed: boolean;
  width: number;
  length: number;
  ribbon: MeshData;
  /** Point de l'axe le plus proche, sur le plan horizontal */
  nearest: (x: number, z: number) => TrackSample;
  surfaceAt: (x: number, z: number) => Surface;
  /** Pose de départ, dans le sens de la route */
  startPose: Pose;
  /** Pose de remise en piste au plus proche de (x, z), dans le sens de la route */
  respawnPose: (x: number, z: number) => Pose;
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
