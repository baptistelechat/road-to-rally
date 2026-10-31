// Tous les paramètres de la voiture vivent ici : physique, modèle 3D et futurs réglages lisent ce même objet.

export interface AxleConfig {
  /** Position Z du centre de roue, avant = négatif */
  z: number;
  /** Demi-voie : distance en X entre l'axe de la voiture et le centre de roue */
  halfTrack: number;
  /** Position Y du point d'attache de suspension, relative au centre de la caisse */
  attachY: number;
  wheelRadius: number;
  wheelWidth: number;
  suspensionRestLength: number;
  suspensionTravel: number;
  suspensionStiffness: number;
  dampingCompression: number;
  dampingRelaxation: number;
  /** Coefficient d'adhérence longitudinale du pneu : force max = coefficient × charge */
  frictionSlip: number;
  /** Coefficient d'adhérence latérale du pneu au pic de la courbe */
  sideFriction: number;
  /** Part de la force de freinage, somme des deux essieux = 1 */
  brakeShare: number;
  /** Part du couple moteur, somme des deux essieux = 1 */
  driveShare: number;
}

export interface CarConfig {
  mass: number;
  /** Assiette au repos, mesurée sur `carConfig` et vérifiée par scripts/checks/recovery.check.ts */
  ride: {
    /** Hauteur du centre de la caisse au-dessus de la route */
    height: number;
    /** Remontée des roues par rapport à la suspension détendue */
    sag: number;
  };
  /** Demi-dimensions du collider de caisse */
  bodyHalfExtents: { x: number; y: number; z: number };
  /** Décalage vertical du centre de gravité par rapport au centre de la caisse */
  centerOfMassY: number;
  /** Multiplicateur d'inertie sur l'axe vertical, plus élevé = pivote moins vite */
  yawInertiaScale: number;
  /** Force max d'une suspension en N, au-delà la caisse touche */
  maxSuspensionForce: number;
  /** Courbe de glissement des pneus, voir `tireCurve` dans `vehicle.ts` */
  tires: {
    /** Angle de dérive du pic d'adhérence, en radians */
    peakSlipAngle: number;
    /** Angle de dérive où le plateau de glisse est atteint, en radians */
    slideSlipAngle: number;
    /** Adhérence sur le plateau de glisse, en part du pic */
    slideGripRatio: number;
    /** Part latérale minimale gardée au freinage ou à l'accélération à fond (hors frein à main) */
    minLateralShare: number;
    /** Adhérence latérale arrière pied levé, en part de la normale : 1 = aucun décrochage */
    liftOffRearGrip: number;
    /** 1 = force latérale appliquée au sol (roulis maximal), 0 = au centre de gravité */
    rollInfluence: number;
    /** Même principe pour la force longitudinale et le tangage */
    pitchInfluence: number;
  };
  front: AxleConfig;
  rear: AxleConfig;
  engine: {
    maxForce: number;
    idleRpm: number;
    redlineRpm: number;
    finalDrive: number;
    /** Rapports de marche avant, du premier au dernier */
    gears: number[];
    reverseGear: number;
    /** Vitesse max en marche arrière, en m/s */
    reverseMaxSpeed: number;
    /** Régime ajouté à fond tant que l'embrayage patine au démarrage */
    launchRpm: number;
    upshiftRpm: number;
    downshiftRpm: number;
    shiftTimeS: number;
    /** Force de frein moteur appliquée sans gaz */
    engineBrake: number;
  };
  brakes: {
    maxForce: number;
    handbrakeForce: number;
    /** Multiplie l'adhérence latérale arrière quand le frein à main est tiré */
    handbrakeSideFriction: number;
  };
  steering: {
    maxAngle: number;
    /** Angle max à haute vitesse */
    minAngleAtSpeed: number;
    /** Accélération latérale visée en m/s² : l'angle est limité à ce que les pneus peuvent tenir à cette vitesse */
    gripAccel: number;
    /** Vitesse de rotation du volant en rad/s */
    rate: number;
  };
  assists: {
    /** Force d'aide au contre-braquage, 0 = aucune */
    counterSteer: number;
    /** Limite de vitesse de lacet en rad/s, 0 = aucune */
    yawRateLimit: number;
    /** Couple qui ramène la caisse à plat, 0 = aucun */
    antiRoll: number;
    /** Force du rappel vers la vitesse au-delà de `driftFreeAngle`, 0 = aucun */
    driftStability: number;
    /** Angle de dérive laissé libre, en radians */
    driftFreeAngle: number;
    /** Frottement aérodynamique */
    drag: number;
  };
  /** Multiplicateurs d'adhérence et résistance au roulement par surface */
  surfaces: {
    asphalt: { grip: number; rollingResistance: number };
    grass: { grip: number; rollingResistance: number };
  };
}

export const carConfig: CarConfig = {
  mass: 1100,
  ride: { height: 0.685, sag: 0.115 },
  bodyHalfExtents: { x: 0.85, y: 0.32, z: 1.9 },
  centerOfMassY: -0.3,
  yawInertiaScale: 1,
  maxSuspensionForce: 30000,
  tires: {
    peakSlipAngle: 0.16,
    slideSlipAngle: 0.5,
    slideGripRatio: 0.72,
    minLateralShare: 0.4,
    liftOffRearGrip: 0.78,
    rollInfluence: 0.85,
    pitchInfluence: 1,
  },
  front: {
    z: -1.25,
    halfTrack: 0.78,
    attachY: -0.05,
    wheelRadius: 0.33,
    wheelWidth: 0.24,
    suspensionRestLength: 0.42,
    suspensionTravel: 0.28,
    suspensionStiffness: 21,
    dampingCompression: 2.8,
    dampingRelaxation: 2.2,
    frictionSlip: 2.6,
    sideFriction: 1.05,
    brakeShare: 0.6,
    driveShare: 0.5,
  },
  rear: {
    z: 1.25,
    halfTrack: 0.78,
    attachY: -0.05,
    wheelRadius: 0.33,
    wheelWidth: 0.24,
    suspensionRestLength: 0.42,
    suspensionTravel: 0.28,
    suspensionStiffness: 19,
    dampingCompression: 2.6,
    dampingRelaxation: 2.1,
    frictionSlip: 2.4,
    sideFriction: 1.12,
    brakeShare: 0.4,
    driveShare: 0.5,
  },
  engine: {
    maxForce: 5200,
    idleRpm: 900,
    redlineRpm: 7500,
    finalDrive: 4.1,
    gears: [3.3, 2.2, 1.6, 1.25, 1.0],
    reverseGear: 3.0,
    reverseMaxSpeed: 12,
    launchRpm: 2500,
    upshiftRpm: 6900,
    downshiftRpm: 3200,
    shiftTimeS: 0.12,
    engineBrake: 600,
  },
  brakes: {
    maxForce: 9000,
    handbrakeForce: 2500,
    handbrakeSideFriction: 0.7,
  },
  steering: {
    maxAngle: 0.6,
    minAngleAtSpeed: 0.16,
    gripAccel: 11,
    rate: 2.8,
  },
  assists: {
    counterSteer: 0.35,
    yawRateLimit: 2.2,
    antiRoll: 0.5,
    driftStability: 16,
    driftFreeAngle: 0.5,
    drag: 0.6,
  },
  surfaces: {
    asphalt: { grip: 1, rollingResistance: 0 },
    grass: { grip: 0.55, rollingResistance: 900 },
  },
};

/** Position locale d'une roue au repos (centre de roue), index dans l'ordre AVG, AVD, ARG, ARD. */
export const wheelRestPosition = (
  config: CarConfig,
  index: number,
): { x: number; y: number; z: number } => {
  const axle = index < 2 ? config.front : config.rear;
  const side = index % 2 === 0 ? -1 : 1;
  return {
    x: side * axle.halfTrack,
    y: axle.attachY - axle.suspensionRestLength,
    z: axle.z,
  };
};

export const wheelAxle = (config: CarConfig, index: number): AxleConfig =>
  index < 2 ? config.front : config.rear;
