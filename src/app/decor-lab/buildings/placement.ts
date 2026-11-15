import type { BufferGeometry } from "three";
import type { Lod } from "./generator";
import { createBuffers, toGeometry, triangleCount } from "./mesh";
import {
  type RoofChoice,
  ROOF_LABEL,
  TYPOLOGIES,
  type Variant,
} from "./typologies";

// Disposition des maquettes dans la scène du labo.

export interface Lot {
  key: string;
  geometry: BufferGeometry;
  x: number;
  z: number;
  title: string;
  detail: string;
  /** Hauteur du haut de la maquette, pour poser l'étiquette */
  top: number;
}

export interface Layout {
  lots: Lot[];
  /** Taille de la zone occupée, pour placer la caméra */
  extent: number;
  /** Ligne de la rue devant le premier rang */
  streetZ: number;
}

/** « all » : vue d'ensemble ; sinon l'id d'une typologie, ses deux variantes en proche et en lointain */
export type Selection = string;

const LOD_LABEL: Record<Lod, string> = { near: "proche", far: "lointain" };
const GAP = 10;

interface Model {
  key: string;
  geometry: BufferGeometry;
  title: string;
  detail: string;
  sizeX: number;
  sizeZ: number;
  top: number;
}

const model = (
  variant: Variant,
  letter: string,
  lod: Lod,
  choice: RoofChoice,
): Model => {
  const out = createBuffers();
  const roofs = variant.build(out, lod, choice);
  const geometry = toGeometry(out);
  const box = geometry.boundingBox;
  const perBuilding = Math.round(triangleCount(out) / variant.count);
  const roofText = [...new Set(roofs.map((r) => ROOF_LABEL[r]))].join(", ");
  return {
    key: `${variant.id}-${lod}`,
    geometry,
    title: `${letter} · ${variant.label} (${LOD_LABEL[lod]})`,
    detail: `${perBuilding} tri./bât. · toit : ${roofText}`,
    sizeX: box ? box.max.x - box.min.x : 10,
    sizeZ: box ? box.max.z - box.min.z : 10,
    top: box ? box.max.y : 10,
  };
};

const focusLayout = (typologyId: string, choice: RoofChoice): Layout => {
  const typology = TYPOLOGIES.find((t) => t.id === typologyId) ?? TYPOLOGIES[0];
  const [a, b] = typology.variants;
  const grid: [Model, number, number][] = [
    [model(a, "A", "near", choice), -1, 1],
    [model(b, "B", "near", choice), 1, 1],
    [model(a, "A", "far", choice), -1, -1],
    [model(b, "B", "far", choice), 1, -1],
  ];
  const cellX = Math.max(...grid.map(([m]) => m.sizeX)) + GAP;
  const cellZ = Math.max(...grid.map(([m]) => m.sizeZ)) + GAP;
  return {
    lots: grid.map(([m, col, row]) => ({
      ...m,
      x: (col * cellX) / 2,
      z: (row * cellZ) / 2,
    })),
    extent: Math.max(cellX, cellZ) * 2,
    streetZ: cellZ - GAP / 2 + 2,
  };
};

const overviewLayout = (choice: RoofChoice): Layout => {
  const columns = TYPOLOGIES.map((t) => [
    model(t.variants[0], "A", "near", choice),
    model(t.variants[1], "B", "near", choice),
  ]);
  const widths = columns.map(
    (pair) => Math.max(...pair.map((m) => m.sizeX)) + GAP,
  );
  const depth = Math.max(...columns.flat().map((m) => m.sizeZ)) + GAP;
  const total = widths.reduce((sum, w) => sum + w, 0);
  let cursor = -total / 2;
  const lots = columns.flatMap((pair, i) => {
    const x = cursor + widths[i] / 2;
    cursor += widths[i];
    return pair.map((m, row) => ({
      ...m,
      x,
      z: row === 0 ? depth / 2 : -depth / 2,
    }));
  });
  return { lots, extent: total, streetZ: depth - GAP / 2 + 2 };
};

export const layoutFor = (selection: Selection, choice: RoofChoice): Layout =>
  selection === "all" ? overviewLayout(choice) : focusLayout(selection, choice);
