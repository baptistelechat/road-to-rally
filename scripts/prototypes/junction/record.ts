// Enregistre une fois pour toutes les réponses BRouter des trois ronds-points. Une requête par seconde.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const CASES = [
  { name: "a-5.75", arm: [5.751612, 45.148089], ring: [5.755222, 45.147165] },
  { name: "b-0.90", arm: [-0.906174, 44.214339], ring: [-0.900878, 44.213054] },
  { name: "c-6.07", arm: [6.077, 44.562996], ring: [6.078623, 44.563734] },
];

/** Altitudes IGN autour de chaque route, sur la grille de 16 m du jeu. Une seule requête par cas. */
const recordIgn = async (): Promise<void> => {
  const { fetchAltitudes } = await import("../../../src/geo/ign");
  const { unproject } = await import("../../../src/geo/gpx");
  const { readRoute } = await import("./geometry");
  const { localNodes } = await import("./mesh");
  for (const { name, ring } of CASES) {
    const route = readRoute(name, ring);
    const nodes = localNodes(route.points, 220);
    const altitudes = await fetchAltitudes(
      nodes.map((p) => unproject(p, route.origin)),
      {},
    );
    writeFileSync(
      join("scripts/prototypes/junction/ign", `${name}.json`),
      JSON.stringify({ nodes, altitudes }),
    );
    console.log(name, nodes.length, "nœuds");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

const main = async (): Promise<void> => {
  if (process.argv.includes("ign")) return recordIgn();
  for (const { name, arm, ring } of CASES) {
    const lonlats = [arm, ring, arm].map((p) => p.join(",")).join("|");
    const url = `https://brouter.de/brouter?lonlats=${lonlats}&profile=car-fast&alternativeidx=0&format=geojson`;
    const response = await fetch(url);
    const text = await response.text();
    if (!response.ok) throw new Error(`${name} : ${response.status} ${text}`);
    writeFileSync(
      join("fixtures/brouter/roundabouts", `${name}.geojson`),
      text,
    );
    console.log(name, text.length);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

if (process.argv[1]?.endsWith("record.ts")) void main();
