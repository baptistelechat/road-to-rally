import type { Lod } from "./generator";
import { createBuffers, triangleCount } from "./mesh";
import type { RoofKind } from "./roofs";
import {
  type RoofChoice,
  TYPOLOGIES,
  type Typology,
  type Variant,
} from "./typologies";

// Comptes de triangles par bâtiment et estimation pour un village.

export const VILLAGE_SIZE = 500;
/** Budget visé pour un bâtiment lointain, en moyenne */
export const FAR_BUDGET = 60;
/** Part des bâtiments affichés en version proche (à moins de ~40 m de la route) */
export const NEAR_SHARE = 0.2;

export interface VariantStats {
  variant: Variant;
  near: number;
  far: number;
  roofs: RoofKind[];
}

export interface TypologyStats {
  typology: Typology;
  variants: VariantStats[];
}

export interface VillageStats {
  rows: TypologyStats[];
  /** Moyennes pondérées par la part de chaque typologie */
  averageNear: number;
  averageFar: number;
}

/** Triangles par bâtiment de la variante, et toits obtenus. */
export const measure = (
  variant: Variant,
  lod: Lod,
  choice: RoofChoice,
): { triangles: number; roofs: RoofKind[] } => {
  const out = createBuffers();
  const roofs = variant.build(out, lod, choice);
  return { triangles: triangleCount(out) / variant.count, roofs };
};

export const villageStats = (choice: RoofChoice): VillageStats => {
  const rows = TYPOLOGIES.map((typology) => ({
    typology,
    variants: typology.variants.map((variant) => {
      const near = measure(variant, "near", choice);
      return {
        variant,
        near: near.triangles,
        far: measure(variant, "far", choice).triangles,
        roofs: near.roofs,
      };
    }),
  }));
  let averageNear = 0;
  let averageFar = 0;
  for (const row of rows) {
    const mean = (lod: "near" | "far"): number =>
      row.variants.reduce((sum, v) => sum + v[lod], 0) / row.variants.length;
    averageNear += row.typology.share * mean("near");
    averageFar += row.typology.share * mean("far");
  }
  return { rows, averageNear, averageFar };
};

export const formatCount = (value: number): string =>
  Math.round(value).toLocaleString("fr-FR");
