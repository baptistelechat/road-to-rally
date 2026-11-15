import type { BufferGeometry } from "three";
import type { DecorBuilding } from "@/sim/types";
import type { GroundAt, Lod } from "./buildingGenerator";
import { createBuffers, toGeometry } from "./buildingMesh";
import { pushTypedBuilding } from "./buildingTypes";

/**
 * Tous les bâtiments en une seule géométrie sans index : un appel de dessin, normales par face. `null` si vide.
 * `near` : fenêtres, volets, portes, débords, cheminées, soubassement et chaînages ; `far` : volumes et toits seuls.
 * `groundAt` : sol rendu, où se posent seuils et rez-de-chaussée ; `null` : rangs comptés depuis l'égout.
 */
export const buildingsGeometry = (
  buildings: DecorBuilding[],
  lod: Lod,
  groundAt: GroundAt | null = null,
): BufferGeometry | null => {
  if (buildings.length === 0) return null;
  const out = createBuffers();
  for (const building of buildings)
    pushTypedBuilding(out, building, lod, groundAt);
  if (out.positions.length === 0) return null;
  return toGeometry(out);
};
