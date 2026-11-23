import type { StageData, Vec3 } from "../types";

const WIDTH = 7;
/** Pas de l'axe en mètres */
const STEP = 2;
/** Marge de route avant le départ et après l'arrivée, en mètres */
const LEAD = 30;
/** Longueur sur laquelle la pente passe d'une valeur à la suivante, en mètres : sans elle, chaque cassure ferait sauter la voiture */
const BLEND = 60;

interface SlopeSection {
  length: number;
  /** Pente en %, positive en montée */
  grade: number;
}

const flat = (length: number): SlopeSection => ({ length, grade: 0 });

/** Élan à plat, puis une montée par palier de 4 %, chacune suivie d'un plat pour relancer, puis deux descentes. */
export const SLOPE_BENCH_SECTIONS: SlopeSection[] = [
  flat(LEAD + 500),
  { length: 600, grade: 4 },
  flat(400),
  { length: 600, grade: 8 },
  flat(400),
  { length: 600, grade: 12 },
  flat(400),
  { length: 500, grade: 16 },
  flat(400),
  { length: 600, grade: -8 },
  flat(300),
  { length: 500, grade: -16 },
  flat(LEAD + 300),
];

/**
 * Piste d'essai des pentes : une ligne droite plate et sans terrain, comme `notes`, dont l'altitude suit des paliers de pente
 * connus. Sert à juger la voiture en montée sans changer la simulation.
 */
export const createSlopeBenchStage = (): StageData => {
  // Pente voulue en chaque point, puis lissée par moyenne glissante sur `BLEND`.
  const grades: number[] = [];
  for (const { length, grade } of SLOPE_BENCH_SECTIONS)
    for (let i = 0; i < Math.round(length / STEP); i++) grades.push(grade);
  const half = Math.round(BLEND / STEP / 2);
  const points: Vec3[] = [{ x: 0, y: 0, z: 0 }];
  // Cap de départ quelconque, pour la même raison que `axisFrom` : éviter de tomber pile sur les arêtes des maillages.
  const heading = 0.37;
  grades.forEach((_, i) => {
    const window = grades.slice(Math.max(0, i - half), i + half + 1);
    const grade = window.reduce((sum, g) => sum + g, 0) / window.length;
    const last = points[points.length - 1];
    points.push({
      x: last.x + Math.cos(heading) * STEP,
      y: last.y + (grade / 100) * STEP,
      z: last.z + Math.sin(heading) * STEP,
    });
  });
  return {
    name: "Slopes",
    origin: { lat: 0, lon: 0 },
    baseAltitude: 0,
    points,
    widths: points.map(() => WIDTH),
    startS: LEAD,
    finishS: (points.length - 1) * STEP - LEAD,
    terrain: null,
    pipelineVersion: 0,
    generatedAt: "2026-11-23T00:00:00.000Z",
    hash: "",
  };
};
