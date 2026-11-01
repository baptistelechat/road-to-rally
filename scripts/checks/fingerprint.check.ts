// Empreinte des spéciales : deux générations identiques, égales à la référence committée dans public/stages/.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildStage, type StageInputs } from "../../src/geo/pipeline";
import { stageHash } from "../../src/geo/stageHash";
import { botInput } from "../../src/sim/bot";
import { initRapier } from "../../src/sim/rapier";
import { createSimulation } from "../../src/sim/simulation";
import { parseStage } from "../../src/sim/track/stageCodec";
import type { StageData } from "../../src/sim/types";

const fixtures = join("fixtures", "stages");
/** 30 s de course suffisent à séparer deux mondes différents, sans ralentir la vérification. */
const RACE_STEPS = 1800;

/** Mêmes entrées, même état final au bit près : le JSON garde les doubles exacts. */
const race = (stage: StageData): string => {
  const sim = createSimulation(undefined, stage);
  let lapMs: number | null = null;
  for (let i = 0; i < RACE_STEPS; i++)
    lapMs = sim.step(botInput(sim.state(), sim.track)) ?? lapMs;
  const { position, rotation, linearVelocity, rpm, gear } = sim.state();
  const result = JSON.stringify({
    position,
    rotation,
    linearVelocity,
    rpm,
    gear,
    lapMs,
  });
  sim.free();
  return result;
};

export default async function fingerprintCheck(): Promise<void> {
  await initRapier();
  const ids = readdirSync(fixtures)
    .filter((file) => file.endsWith(".inputs.json"))
    .map((file) => file.replace(".inputs.json", ""));
  assert.ok(ids.length > 0, "aucune fixture");

  for (const id of ids) {
    const inputs = JSON.parse(
      readFileSync(join(fixtures, `${id}.inputs.json`), "utf8"),
    ) as StageInputs;
    const baked = parseStage(
      JSON.parse(readFileSync(join("public", "stages", `${id}.json`), "utf8")),
    );
    const first = buildStage(inputs, baked.name);
    const second = buildStage(inputs, baked.name);

    assert.match(baked.hash, /^[0-9a-f]{16}$/, `${id} : empreinte absente`);
    assert.equal(stageHash(first), stageHash(second), id);
    assert.equal(
      stageHash(first),
      baked.hash,
      `${id} : public/stages à recuire (pnpm bake:stages)`,
    );
    // Le JSON cuit et ses tableaux typés reconstruits gardent la même empreinte.
    assert.equal(stageHash(baked), baked.hash, id);

    // IndexedDB stocke par clone structuré : le cache rend exactement la même spéciale.
    const cached = structuredClone(first);
    assert.equal(stageHash(cached), baked.hash, id);
    assert.equal(race(cached), race(first), `${id} : course du cache`);

    // La date et le champ d'empreinte n'y comptent pas, le moindre écart du tracé si.
    assert.equal(
      stageHash({ ...first, generatedAt: "2000-01-01", hash: "x" }),
      baked.hash,
    );
    const moved = structuredClone(first);
    moved.points[10].y += 0.001;
    assert.notEqual(stageHash(moved), baked.hash, id);
    assert.notEqual(
      stageHash({ ...first, pipelineVersion: first.pipelineVersion + 1 }),
      baked.hash,
      id,
    );
    assert.notEqual(
      stageHash({ ...first, widths: first.widths.map((w) => w + 0.5) }),
      baked.hash,
      id,
    );
    if (first.terrain) {
      const terrain = structuredClone(first.terrain);
      terrain.positions[0] += 1;
      assert.notEqual(stageHash({ ...first, terrain }), baked.hash, id);
    }
  }
}
