import { computeAutoChicanes } from "../src/editor/autoChicanes";
import { analyzeTrace } from "../src/geo/analyzeTrace";
import type { StageInputs } from "../src/geo/pipeline";

/**
 * Entrées de cuisson d'une spéciale de `fixtures/stages/` : le relevé en cache plus les chicanes automatiques, comme
 * l'éditeur les propose. `bake-stage` et les vérifications passent par ici, pour reconstruire exactement le fichier cuit.
 */
export const withAutoChicanes = (inputs: StageInputs): StageInputs => {
  const axis = analyzeTrace(inputs.gpx).axis;
  return {
    ...inputs,
    chicanes: axis ? computeAutoChicanes(axis).chicanes : [],
  };
};
