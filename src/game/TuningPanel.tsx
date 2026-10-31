"use client";

import { button, Leva, useControls } from "leva";
import { useEffect } from "react";
import { carConfig, type CarConfig } from "@/sim/carConfig";
import type { Simulation } from "@/sim/simulation";

const clone = (config: CarConfig): CarConfig =>
  JSON.parse(JSON.stringify(config)) as CarConfig;

// ponytail: une seule config réglée à la fois, l'outil ne sert qu'en développement
const tuned = clone(carConfig);

const range = (value: number, ratio = 3) => ({
  value,
  min: 0,
  max: value > 0 ? value * ratio : 1,
});

/** Réglages en direct, branchés sur `carConfig`. Les versions qui marchent se gardent dans `src/sim/presets/`. */
export const TuningPanel = ({ sim }: { sim: Simulation }) => {

  const values = useControls("Pneus", {
    gripAvant: range(carConfig.front.sideFriction),
    gripArriere: range(carConfig.rear.sideFriction),
    angleDePic: range(carConfig.tires.peakSlipAngle),
    gripEnGlisse: { value: carConfig.tires.slideGripRatio, min: 0, max: 1 },
    leverDePied: { value: carConfig.tires.liftOffRearGrip, min: 0, max: 1 },
  });
  const chassis = useControls("Châssis", {
    raideurAvant: range(carConfig.front.suspensionStiffness),
    raideurArriere: range(carConfig.rear.suspensionStiffness),
    couplage: { value: carConfig.tires.rollInfluence, min: 0, max: 1 },
    moteur: range(carConfig.engine.maxForce, 2),
    freins: range(carConfig.brakes.maxForce, 2),
    freinAMain: range(carConfig.brakes.handbrakeForce),
    gripFreinAMain: {
      value: carConfig.brakes.handbrakeSideFriction,
      min: 0,
      max: 1,
    },
  });
  const assists = useControls("Assistances", {
    directionVitesse: range(carConfig.steering.minAngleAtSpeed),
    contreBraquage: { value: carConfig.assists.counterSteer, min: 0, max: 1 },
    lacetMax: range(carConfig.assists.yawRateLimit),
    antiTonneau: { value: carConfig.assists.antiRoll, min: 0, max: 1 },
    rappelGlisse: range(carConfig.assists.driftStability),
  });

  useControls("Presets", {
    "Copier le JSON": button(() => {
      void navigator.clipboard.writeText(
        JSON.stringify(tuned, null, 2),
      );
    }),
  });

  useEffect(() => {
    const next = tuned;
    next.front.sideFriction = values.gripAvant;
    next.rear.sideFriction = values.gripArriere;
    next.tires.peakSlipAngle = values.angleDePic;
    next.tires.slideGripRatio = values.gripEnGlisse;
    next.tires.liftOffRearGrip = values.leverDePied;
    next.front.suspensionStiffness = chassis.raideurAvant;
    next.rear.suspensionStiffness = chassis.raideurArriere;
    next.tires.rollInfluence = chassis.couplage;
    next.engine.maxForce = chassis.moteur;
    next.brakes.maxForce = chassis.freins;
    next.brakes.handbrakeForce = chassis.freinAMain;
    next.brakes.handbrakeSideFriction = chassis.gripFreinAMain;
    next.steering.minAngleAtSpeed = assists.directionVitesse;
    next.assists.counterSteer = assists.contreBraquage;
    next.assists.yawRateLimit = assists.lacetMax;
    next.assists.antiRoll = assists.antiTonneau;
    next.assists.driftStability = assists.rappelGlisse;
    sim.applyConfig(next);
  }, [sim, values, chassis, assists]);

  return <Leva collapsed titleBar={{ title: "Réglages" }} />;
};
