// Diagnostic des tunnels d'un GPX : largeur du tube, montagne au-dessus, terrain qui entre dans le tube.
// pnpm tsx scripts/debug-tunnels.ts <fichier.gpx> [cache.json]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  buildStage,
  fetchStageInputs,
  type StageInputs,
} from "../src/geo/pipeline";
import { shoulderWidths } from "../src/sim/track/roadContact";
import {
  TUNNEL_VAULT_RISE,
  TUNNEL_WALL_HEIGHT,
} from "../src/sim/track/tunnelShape";

const [gpxPath, cachePath] = process.argv.slice(2);
const bakeFetch: typeof fetch = (url, init) =>
  fetch(url, {
    ...init,
    headers: { ...init?.headers, "User-Agent": "rally-debug/0.1" },
  });

const main = async (): Promise<void> => {
  const gpx = readFileSync(gpxPath, "utf8");
  let inputs: StageInputs;
  if (cachePath && existsSync(cachePath))
    inputs = JSON.parse(readFileSync(cachePath, "utf8")) as StageInputs;
  else {
    const result = await fetchStageInputs(gpx, { fetch: bakeFetch });
    for (const w of result.warnings) console.warn("⚠", w);
    inputs = result.inputs;
    if (cachePath) writeFileSync(cachePath, JSON.stringify(inputs));
  }
  console.log(
    "voies :",
    inputs.ways?.length ?? "aucune",
    "· tunnels tagués :",
    inputs.ways?.filter((w) => w.tags.tunnel).length,
  );
  const stage = buildStage({ ...inputs, decor: null }, "debug");
  const unique = stage.shared
    ? stage.points.slice(0, stage.points.length - stage.shared.armEnd)
    : stage.points;
  const widths = stage.widths.slice(0, unique.length);
  const shoulders = shoulderWidths(unique, widths, false);
  const edge = widths.map((w, i) => w / 2 + shoulders[i]);
  const terrain = stage.terrain;
  for (const t of stage.tunnels ?? []) {
    const span = edge.slice(t.from, t.to + 1);
    let inside = 0;
    if (terrain) {
      const pos = terrain.positions;
      for (let v = 0; v < pos.length; v += 3) {
        for (let i = t.from; i <= t.to; i++) {
          const p = unique[i];
          const d = Math.hypot(pos[v] - p.x, pos[v + 2] - p.z);
          const h = pos[v + 1] - p.y;
          if (
            d < t.halfWidth - 0.05 &&
            h > 0.5 &&
            h < TUNNEL_WALL_HEIGHT + TUNNEL_VAULT_RISE
          ) {
            inside++;
            break;
          }
        }
      }
    }
    console.log(
      `tunnel ${t.from}→${t.to} (${(t.to - t.from) * 2} m) · demi-largeur ${t.halfWidth} · bord local ${Math.min(...span).toFixed(2)} à ${Math.max(...span).toFixed(2)} · montagne ${t.roof ? t.roof.indices.length / 3 + " triangles" : "aucune"} · sommets de terrain dans le tube ${inside}`,
    );
  }
  if (!stage.tunnels) console.log("aucun tunnel dans la spéciale");
};

void main();
