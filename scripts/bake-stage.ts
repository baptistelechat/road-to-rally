// Cuit les spéciales de fixtures/stages/ dans public/stages/, sans réseau. À lancer depuis la racine du dépôt.
// `--refresh` redemande les altitudes et les routes, puis réécrit fixtures/stages/<id>.inputs.json.
// Un cache sans altitudes de couloir ne redemande que celles-ci.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { traceFromGpx } from "../src/geo/gpx";
import {
  axisHash,
  buildStage,
  fetchCorridorAltitudes,
  fetchStageInputs,
  type StageInputs,
} from "../src/geo/pipeline";
import { stageHash } from "../src/geo/stageHash";
import { stageToJson } from "../src/sim/track/stageCodec";

const fixtures = join("fixtures", "stages");
const output = join("public", "stages");

const STAGES = [
  { id: "mountain", name: "Col de Turini" },
  { id: "road", name: "Départementale des Landes" },
];

// Overpass répond 406 au `fetch` de Node sans cet en-tête. Dans le navigateur, il déclencherait une requête CORS préalable.
const bakeFetch: typeof fetch = (url, init) =>
  fetch(url, {
    ...init,
    headers: { ...init?.headers, "User-Agent": "rally-stage-bake/0.1" },
  });

const readInputs = (path: string): StageInputs | null => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as StageInputs;
  } catch {
    return null;
  }
};

const main = async (): Promise<void> => {
  const refresh = process.argv.includes("--refresh");
  mkdirSync(output, { recursive: true });
  for (const { id, name } of STAGES) {
    const gpx = readFileSync(join(fixtures, `${id}.gpx`), "utf8");
    const path = join(fixtures, `${id}.inputs.json`);
    const cached = readInputs(path);
    let inputs = refresh ? null : cached;
    if (!inputs) {
      const result = await fetchStageInputs(gpx, { fetch: bakeFetch });
      for (const warning of result.warnings) console.warn(`${id} : ${warning}`);
      inputs = result.inputs;
      // Overpass sature souvent : les voies du dernier relevé valent mieux que 5 m partout.
      inputs.ways ??= cached?.ways ?? null;
      writeFileSync(path, JSON.stringify(inputs));
    } else if (inputs.axisHash !== axisHash(traceFromGpx(gpx))) {
      throw new Error(
        `${id} : l'axe a changé depuis le dernier relevé, les altitudes en cache ne valent plus. Relancer avec --refresh.`,
      );
    } else if (!inputs.terrain) {
      inputs.terrain = await fetchCorridorAltitudes(traceFromGpx(gpx), {
        fetch: bakeFetch,
      });
      writeFileSync(path, JSON.stringify(inputs));
    }
    const stage = buildStage(inputs, name);
    stage.hash = stageHash(stage);
    const json = JSON.stringify(stageToJson(stage));
    writeFileSync(join(output, `${id}.json`), json);
    console.log(
      `${id} : ${stage.points.length} points, ${Math.round(stage.finishS - stage.startS)} m, ` +
        `${(stage.terrain?.positions.length ?? 0) / 3} sommets et ${(stage.terrain?.indices.length ?? 0) / 3} triangles de terrain, ` +
        `${(json.length / 1e6).toFixed(2)} Mo`,
    );
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
