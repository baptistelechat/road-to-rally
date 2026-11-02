// Profil d'altitude et score du tracé de l'éditeur (stories 3.5 et 3.6), sans réseau ni navigateur.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ElevationChart } from "../../src/editor/ui/ElevationChart";
import { IGN_NO_DATA, STEP } from "../../src/geo/config";
import { StageError } from "../../src/geo/errors";
import { traceFromGpx, type PlanePoint } from "../../src/geo/gpx";
import { buildStage, type StageInputs } from "../../src/geo/pipeline";
import {
  buildPreviewProfile,
  elevationStats,
  fetchPreviewProfile,
  previewSampleIndices,
  type PreviewProfile,
} from "../../src/geo/previewProfile";
import { computeTraceStats, type TraceStats } from "../../src/geo/traceStats";

/** Écart relatif maximal entre le dénivelé cumulé de l'aperçu et celui de la spéciale générée */
const MAX_ELEVATION_GAP = 0.1;
/** Par sens, l'écart relatif n'a pas de sens sur quelques mètres : une montagne qui ne fait que monter descend de 1 m. */
const MAX_GAP_PER_SIGN = { ratio: 0.1, meters: 3 };
/** Budget de `computeTraceStats` sur 15 km, en millisecondes */
const MAX_STATS_MS = 50;

const round = (value: number): number => Math.round(value * 100) / 100;

const loadInputs = (id: string): StageInputs =>
  JSON.parse(
    readFileSync(join("fixtures", "stages", `${id}.inputs.json`), "utf8"),
  ) as StageInputs;

interface Fixture {
  axis: PlanePoint[];
  runoffPoints: number;
  stats: TraceStats;
  preview: PreviewProfile;
}

const checkFixture = (id: string): Fixture => {
  const inputs = loadInputs(id);
  const trace = traceFromGpx(inputs.gpx);
  const count = trace.points.length;
  const run = trace.runoffPoints;

  // Le terrain ne joue pas sur le profil, et il coûte l'essentiel du temps.
  const stage = buildStage({ ...inputs, terrain: null }, id);
  const real = elevationStats(
    stage.points.map((p) => p.y),
    run,
    count - 1 - run,
  );

  const samples = previewSampleIndices(count).map((i) => inputs.altitudes[i]);
  const started = performance.now();
  const preview = buildPreviewProfile(samples, count, run);
  const previewMs = performance.now() - started;

  const previewTotal = preview.ascent + preview.descent;
  const realTotal = real.ascent + real.descent;
  const gap = Math.abs(previewTotal - realTotal) / realTotal;
  console.log(
    `     ${id} : dénivelé aperçu +${round(preview.ascent)} / -${round(preview.descent)} m, ` +
      `spéciale +${round(real.ascent)} / -${round(real.descent)} m, ` +
      `écart cumulé ${round(gap * 100)} %, pente ${round(preview.maxSlope * 100)} %, ` +
      `calcul ${Math.round(previewMs)} ms`,
  );
  assert.ok(
    gap < MAX_ELEVATION_GAP,
    `${id} : ${gap} d'écart sur le dénivelé cumulé`,
  );
  for (const [a, b] of [
    [preview.ascent, real.ascent],
    [preview.descent, real.descent],
  ])
    assert.ok(
      Math.abs(a - b) < MAX_GAP_PER_SIGN.meters ||
        Math.abs(a - b) / b < MAX_GAP_PER_SIGN.ratio,
      `${id} : ${a} m contre ${b} m`,
    );

  // Un axe à 2 m, un point par point, et des lignes là où est le prolongement.
  assert.equal(preview.altitudes.length, count);
  assert.equal(preview.abscissas[count - 1], (count - 1) * STEP);
  assert.equal(preview.startS, run * STEP);
  assert.equal(preview.finishS, (count - 1 - run) * STEP);

  const stats = computeTraceStats(trace.points, run);
  assert.deepEqual(
    computeTraceStats(trace.points, run),
    stats,
    "mêmes chiffres à chaque exécution",
  );
  assert.ok(
    Math.abs(stats.length - trace.length) < 0.01,
    "longueur hors prolongement",
  );
  for (const turn of stats.turns)
    assert.ok(turn.fromS >= preview.startS && turn.toS <= preview.finishS);
  console.log(
    `     ${id} : ${round(stats.length)} m, ${stats.turns.length} virages, ${round(stats.turnsPerKm)}/km, ` +
      `${stats.hairpins} épingles, ligne droite ${stats.longestStraight.length} m ` +
      `(${stats.longestStraight.fromS} à ${stats.longestStraight.toS}), ${stats.verdict}`,
  );

  return { axis: trace.points, runoffPoints: run, stats, preview };
};

/** Plus grand écart des points d'une portion à la corde qui joint ses bouts, en mètres. */
const chordDeviation = (
  axis: PlanePoint[],
  fromS: number,
  toS: number,
): number => {
  const a = axis[fromS / STEP];
  const b = axis[toS / STEP];
  const norm = Math.hypot(b.x - a.x, b.z - a.z);
  let max = 0;
  for (let i = fromS / STEP; i <= toS / STEP; i++) {
    const p = axis[i];
    max = Math.max(
      max,
      Math.abs((p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x)) / norm,
    );
  }
  return max;
};

const checkComparison = (mountain: Fixture, road: Fixture): void => {
  assert.ok(
    mountain.stats.turnsPerKm > 5 * road.stats.turnsPerKm,
    "Turini doit avoir nettement plus de virages",
  );
  assert.ok(mountain.stats.hairpins >= 5);
  assert.equal(road.stats.hairpins, 0);
  assert.equal(mountain.stats.verdict, "très sinueuse");
  assert.equal(road.stats.verdict, "roulante");

  const straight = road.stats.longestStraight;
  assert.ok(straight.length > mountain.stats.longestStraight.length);
  // Le bon endroit : vraiment droite, sans aucun virage dedans, et sur la spéciale.
  const deviation = chordDeviation(road.axis, straight.fromS, straight.toS);
  console.log(
    `     road : la ligne droite s'écarte de ${round(deviation)} m de sa corde`,
  );
  assert.ok(
    deviation < straight.length * 0.01,
    `${deviation} m d'écart à la corde`,
  );
  assert.ok(
    straight.fromS >= road.preview.startS &&
      straight.toS <= road.preview.finishS,
  );
  for (const turn of road.stats.turns)
    assert.ok(turn.toS <= straight.fromS || turn.fromS >= straight.toS);
};

/** Tronçons droits et arcs, à 2 m, en partant vers le nord. `radius` négatif : à gauche. */
const buildAxis = (
  parts: { straight?: number; radius?: number; degrees?: number }[],
): PlanePoint[] => {
  const points: PlanePoint[] = [{ x: 0, z: 0 }];
  let heading = 0; // 0 = nord, positif = vers l'est
  const advance = (): void => {
    const last = points[points.length - 1];
    points.push({
      x: last.x + Math.sin(heading) * STEP,
      z: last.z - Math.cos(heading) * STEP,
    });
  };
  for (const { straight = 0, radius = 0, degrees = 0 } of parts) {
    for (let d = 0; d < straight; d += STEP) advance();
    const arc = Math.abs(radius) * ((degrees * Math.PI) / 180);
    for (let d = 0; d < arc; d += STEP) {
      heading += (Math.sign(radius) * STEP) / Math.abs(radius);
      advance();
    }
  }
  return points;
};

const checkTurnRules = (): void => {
  const straight = { straight: 200 };
  const right = (radius: number, degrees: number) => ({ radius, degrees });

  const single = computeTraceStats(
    buildAxis([straight, right(50, 90), straight]),
    0,
  );
  assert.equal(single.turns.length, 1);
  assert.equal(single.turns[0].side, "right", "signe de curvatureAt");
  assert.equal(single.hairpins, 0);

  const left = computeTraceStats(
    buildAxis([straight, right(-50, 90), straight]),
    0,
  );
  assert.equal(left.turns[0].side, "left");

  // Une succession de virages dans le même sens compte pour un, sauf loin l'un de l'autre.
  const close = computeTraceStats(
    buildAxis([
      straight,
      right(40, 60),
      { straight: 30 },
      right(40, 60),
      straight,
    ]),
    0,
  );
  assert.equal(close.turns.length, 1);
  assert.ok(
    Math.abs(close.turns[0].angle - 120) < 5,
    `${close.turns[0].angle}°`,
  );
  const far = computeTraceStats(
    buildAxis([
      straight,
      right(40, 60),
      { straight: 300 },
      right(40, 60),
      straight,
    ]),
    0,
  );
  assert.equal(far.turns.length, 2);
  const chicane = computeTraceStats(
    buildAxis([straight, right(40, 60), right(-40, 60), straight]),
    0,
  );
  assert.equal(chicane.turns.length, 2, "sens opposés");

  const hairpin = computeTraceStats(
    buildAxis([straight, right(12, 180), straight]),
    0,
  );
  assert.equal(hairpin.hairpins, 1);

  // Le bruit de rééchantillonnage ne fait pas de virage, et ne coupe pas la ligne droite.
  const noisy = buildAxis([{ straight: 2000 }]).map((p, i) => ({
    x: p.x + (i % 2 ? 0.005 : -0.005),
    z: p.z,
  }));
  const quiet = computeTraceStats(noisy, 0);
  assert.equal(quiet.turns.length, 0);
  assert.equal(quiet.longestStraight.length, 2000);
  assert.equal(quiet.verdict, "roulante");

  // La ligne droite la plus longue, à la bonne place.
  const located = computeTraceStats(
    buildAxis([
      { straight: 300 },
      right(30, 90),
      { straight: 900 },
      right(30, 90),
      { straight: 100 },
    ]),
    0,
  ).longestStraight;
  assert.ok(Math.abs(located.length - 900) < 60, `${located.length} m`);
  assert.ok(
    Math.abs(located.fromS - (300 + 30 * (Math.PI / 2))) < 40,
    `${located.fromS}`,
  );

  // Le prolongement ne compte pas : le virage y reste invisible.
  const inRunoff = computeTraceStats(
    buildAxis([right(30, 90), { straight: 3000 }, right(30, 90)]),
    60,
  );
  assert.equal(inRunoff.turns.length, 0);
};

const checkSpeed = (mountain: Fixture): void => {
  // Turini répété jusqu'à 15 km : le pire cas réaliste.
  const axis: PlanePoint[] = [];
  const copy = mountain.axis;
  for (let offset = 0; axis.length < 7500; offset++)
    for (const p of copy)
      axis.push({
        x: p.x + offset * (copy[copy.length - 1].x - copy[0].x),
        z: p.z + offset * (copy[copy.length - 1].z - copy[0].z),
      });
  const long = axis.slice(0, 7500);
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    computeTraceStats(long, 125);
    best = Math.min(best, performance.now() - started);
  }
  console.log(`     15 km : computeTraceStats en ${round(best)} ms`);
  assert.ok(best < MAX_STATS_MS, `${best} ms`);
};

const checkPreviewNetwork = async (mountain: Fixture): Promise<void> => {
  const count = mountain.axis.length;
  const origin = { lat: 44, lon: 7 };
  const indices = previewSampleIndices(count);
  assert.equal(indices[1], 10, "un point tous les 20 m");
  assert.equal(
    indices[indices.length - 1],
    count - 1,
    "le dernier point compte",
  );

  const reply = (elevations: number[]): Response =>
    new Response(JSON.stringify({ elevations }));
  const flat = indices.map(() => 500);

  let lats: string[] = [];
  const ok = await fetchPreviewProfile(mountain.axis, origin, {
    runoffPoints: mountain.runoffPoints,
    fetch: async (_url, init) => {
      lats = (JSON.parse(String(init?.body)) as { lat: string }).lat.split("|");
      return reply(flat);
    },
  });
  assert.equal(lats.length, indices.length, "requête limitée à l'échantillon");
  assert.equal(ok.maxAltitude, 500);

  // -99999 n'atteint jamais le graphique : le refus part à la place du profil.
  const holed = [...flat];
  holed[Math.floor(holed.length / 2)] = IGN_NO_DATA;
  await assert.rejects(
    fetchPreviewProfile(mountain.axis, origin, {
      runoffPoints: mountain.runoffPoints,
      fetch: async () => reply(holed),
    }),
    (error: unknown) => {
      assert.ok(error instanceof StageError && error.code === "outOfFrance");
      assert.match(error.message, /France/);
      return true;
    },
  );
  assert.throws(
    () => buildPreviewProfile(holed, count, mountain.runoffPoints),
    StageError,
  );

  // IGN en panne : une erreur que l'éditeur peut montrer à la place du graphique.
  await assert.rejects(
    fetchPreviewProfile(mountain.axis, origin, {
      runoffPoints: mountain.runoffPoints,
      fetch: async () => new Response("", { status: 400 }),
    }),
    (error: unknown) => error instanceof StageError && error.code === "service",
  );

  // Réponse périmée : la première requête finit après la seconde et après son annulation, elle est refusée.
  const stale = new AbortController();
  let releaseStale = (): void => undefined;
  const staleResult = fetchPreviewProfile(mountain.axis, origin, {
    runoffPoints: mountain.runoffPoints,
    signal: stale.signal,
    fetch: () =>
      new Promise<Response>((resolve) => {
        releaseStale = () => resolve(reply(flat));
      }),
  });
  stale.abort();
  const fresh = await fetchPreviewProfile(mountain.axis, origin, {
    runoffPoints: mountain.runoffPoints,
    fetch: async () => reply(indices.map(() => 700)),
  });
  assert.equal(fresh.maxAltitude, 700);
  releaseStale();
  await assert.rejects(
    staleResult,
    (error: unknown) => error instanceof StageError && error.code === "aborted",
  );
};

const checkChart = (fixture: Fixture): void => {
  const { preview } = fixture;
  const props = {
    abscissas: preview.abscissas,
    altitudes: preview.altitudes,
    startS: preview.startS,
    finishS: preview.finishS,
    onHover: () => undefined,
  };
  const idle = renderToStaticMarkup(
    createElement(ElevationChart, { ...props, cursorS: null }),
  );
  assert.match(idle, /role="img"/);
  assert.match(idle, /aria-label="Profil d&#x27;altitude de la spéciale"/);
  const describedBy = /aria-describedby="([^"]+)"/.exec(idle);
  assert.ok(describedBy);
  assert.ok(
    idle.includes(`id="${describedBy[1]}"`),
    "le résumé est relié au graphique",
  );
  assert.match(
    idle,
    new RegExp(
      `altitude de ${Math.round(preview.minAltitude)} à ${Math.round(preview.maxAltitude)} m`,
    ),
  );
  assert.match(idle, /Départ/);
  assert.match(idle, /Arrivée/);
  assert.equal(idle.match(/<rect/g)?.length, 2, "deux zones de dégagement");
  assert.doesNotMatch(idle, /NaN/);
  assert.doesNotMatch(idle, /elevation-cursor/);

  const moved = renderToStaticMarkup(
    createElement(ElevationChart, { ...props, cursorS: preview.startS }),
  );
  assert.match(moved, /elevation-cursor/);
  // Curseur retiré, le dessin de la courbe est identique au caractère près.
  assert.equal(
    moved.replace(/<div aria-hidden="true" data-testid.*?<\/div>/, ""),
    idle,
  );
};

export default async function traceStatsCheck(): Promise<void> {
  const mountain = checkFixture("mountain");
  const road = checkFixture("road");
  checkComparison(mountain, road);
  checkTurnRules();
  checkSpeed(mountain);
  await checkPreviewNetwork(mountain);
  checkChart(road);
}
