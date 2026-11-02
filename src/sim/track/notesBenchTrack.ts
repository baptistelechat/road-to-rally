import type { StageData, Vec3 } from "../types";

const WIDTH = 6;
/** Pas de l'axe en mètres */
const STEP = 2;
/** Marge de route avant le départ et après l'arrivée, en mètres */
const LEAD = 30;
/** Ligne droite entre deux virages qui s'annoncent séparément, en mètres */
const APART = 70;

interface BenchSection {
  name: string;
  length: number;
  /** Rotation du cap sur la section, en degrés : positive vers la droite */
  turn: number;
}

const straight = (length: number): BenchSection => ({
  name: "Ligne droite",
  length,
  turn: 0,
});

/** Arc de rayon constant : la longueur se déduit de l'angle. */
const arc = (name: string, radius: number, turn: number): BenchSection => ({
  name,
  length: (radius * Math.abs(turn) * Math.PI) / 180,
  turn,
});

// Chaque arc fait au moins 20 m : plus court, la fenêtre de mesure de la courbure élargirait son rayon.
// Sens alternés d'un groupe à l'autre, pour que la route ne se recoupe jamais.
export const NOTES_BENCH_SECTIONS: BenchSection[] = [
  straight(LEAD + 40),
  arc("Gauche 1", 14, -90),
  straight(APART),
  arc("Droite 1", 14, 90),
  straight(APART),
  arc("Droite 2", 27, 90),
  straight(APART),
  arc("Gauche 2", 27, -90),
  straight(APART),
  arc("Gauche 3", 45, -60),
  straight(APART),
  arc("Droite 3", 45, 60),
  straight(APART),
  arc("Droite 4", 70, 45),
  straight(APART),
  arc("Gauche 4", 70, -45),
  straight(APART),
  arc("Gauche 5", 105, -40),
  straight(APART),
  arc("Droite 5", 105, 40),
  straight(APART),
  arc("Droite 6", 165, 30),
  straight(APART),
  arc("Gauche 6", 165, -30),
  straight(APART),
  arc("Virage long", 90, -90),
  straight(APART),
  arc("Retour du virage long", 60, 90),
  straight(APART),
  // Le rayon passe de 180 m à 40 m sur 75 m.
  { name: "Virage qui se resserre", length: 25, turn: 8 },
  { name: "Virage qui se resserre", length: 25, turn: 16 },
  { name: "Virage qui se resserre", length: 25, turn: 36 },
  straight(APART),
  arc("Retour du virage qui se resserre", 60, -60),
  { name: "Crête", length: 200, turn: 0 },
  { name: "Bosse", length: 80, turn: 0 },
  // « gauche 3 puis droite 4 »
  arc("Paire, gauche 3", 45, -60),
  straight(30),
  arc("Paire, droite 4", 70, 45),
  straight(APART),
  // Trois virages de note 2 presque collés.
  arc("Enfilade, gauche 2", 27, -60),
  straight(4),
  arc("Enfilade, droite 2", 27, 120),
  straight(4),
  arc("Enfilade, gauche 2 de sortie", 27, -60),
  straight(LEAD + 60),
];

/** Reliefs ajoutés sur l'axe plat, centrés sur leur section. Les mêmes que le circuit du sandbox. */
const RELIEFS: { section: string; height: number; length: number }[] = [
  { section: "Crête", height: 2.5, length: 80 },
  { section: "Bosse", height: 0.5, length: 14 },
];

/**
 * Piste d'essai des notes : une spéciale plate et sans terrain, comme le circuit du sandbox, mais en arcs de rayon exact
 * pour viser chaque note. Le joueur la roule comme toute spéciale, sans changer la simulation.
 */
export const createNotesBenchStage = (): StageData => {
  const points: Vec3[] = [{ x: 0, y: 0, z: 0 }];
  // Cap de départ quelconque, pour la même raison que `axisFrom` : éviter de tomber pile sur les arêtes des maillages.
  let heading = 0.37;
  const ranges = new Map<string, [number, number]>();
  for (const { name, length, turn } of NOTES_BENCH_SECTIONS) {
    const count = Math.round(length / STEP);
    const from = (points.length - 1) * STEP;
    for (let i = 0; i < count; i++) {
      heading += (turn * Math.PI) / 180 / count;
      const last = points[points.length - 1];
      points.push({
        x: last.x + Math.cos(heading) * STEP,
        y: 0,
        z: last.z + Math.sin(heading) * STEP,
      });
    }
    ranges.set(name, [from, (points.length - 1) * STEP]);
  }
  for (const { section, height, length } of RELIEFS) {
    const range = ranges.get(section);
    if (!range) continue;
    const center = (range[0] + range[1]) / 2;
    points.forEach((point, i) => {
      const u = (i * STEP - center) / length + 0.5;
      if (u > 0 && u < 1)
        point.y += (height / 2) * (1 - Math.cos(2 * Math.PI * u));
    });
  }
  return {
    name: "Pace notes",
    origin: { lat: 0, lon: 0 },
    baseAltitude: 0,
    points,
    widths: points.map(() => WIDTH),
    startS: LEAD,
    finishS: (points.length - 1) * STEP - LEAD,
    terrain: null,
    pipelineVersion: 0,
    generatedAt: "2026-11-02T00:00:00.000Z",
    hash: "",
  };
};
