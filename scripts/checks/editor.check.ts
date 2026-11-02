import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clearDraft,
  readDraft,
  writeDraft,
  type DraftStorage,
} from "../../src/editor/draft";
import { traceToGpx } from "../../src/editor/gpxExport";
import {
  createHistory,
  pushHistory,
  redo,
  undo,
} from "../../src/editor/history";
import {
  createRouteController,
  type RouteStatus,
} from "../../src/editor/routeController";
import {
  addAnchor,
  anchorDistances,
  applyRoutes,
  assembleRoad,
  assembleTrace,
  distance,
  insertAnchor,
  moveAnchor,
  removeAnchor,
  reverseTrace,
  stageLength,
  traceLength,
  type TraceEdit,
} from "../../src/editor/trace";
import { EMPTY_TRACE, type EditorTrace } from "../../src/editor/types";
import {
  fetchRoute,
  parseBRouterRoute,
  RouteRefused,
  type BRouterRoute,
  type FetchRoute,
} from "../../src/geo/brouter";
import { EDITOR_RUNOFF, STEP } from "../../src/geo/config";
import { StageError } from "../../src/geo/errors";
import {
  parseGpx,
  project,
  traceFromGpx,
  type LatLon,
  type PlanePoint,
} from "../../src/geo/gpx";

const read = (name: string): string =>
  readFileSync(join("fixtures", "brouter", name), "utf8");

const FULL = parseBRouterRoute(read("turini-a-b.geojson"));
const A_M = parseBRouterRoute(read("turini-a-m.geojson"));
const M_B = parseBRouterRoute(read("turini-m-b.geojson"));
const SAME = parseBRouterRoute(read("same-point.geojson"));

const A = FULL.points[0];
const B = FULL.points[FULL.points.length - 1];
const at = (ratio: number): LatLon =>
  FULL.points[Math.floor((FULL.points.length - 1) * ratio)];

const nearestIndex = (point: LatLon): number => {
  let best = 0;
  FULL.points.forEach((candidate, i) => {
    if (distance(point, candidate) < distance(point, FULL.points[best]))
      best = i;
  });
  return best;
};

/** Le vrai trajet enregistré, découpé : de quoi rejouer n'importe quelle paire de points posés sur cette route. */
const sliceFull = (from: LatLon, to: LatLon): BRouterRoute => {
  const [i, j] = [nearestIndex(from), nearestIndex(to)];
  const points =
    i <= j
      ? FULL.points.slice(i, j + 1)
      : FULL.points.slice(j, i + 1).reverse();
  let length = 0;
  for (let k = 1; k < points.length; k++)
    length += distance(points[k - 1], points[k]);
  return { points, ways: [{ fromIndex: 0, highway: "tertiary" }], length };
};

const replay: FetchRoute = async (from, to) => sliceFull(from, to);

const rig = (fetcher: FetchRoute, start: EditorTrace = EMPTY_TRACE) => {
  const calls: [LatLon, LatLon][] = [];
  const statuses: RouteStatus[] = [];
  let trace = start;
  let commits = 0;
  const controller = createRouteController({
    fetchRoute: (from, to, options) => {
      calls.push([from, to]);
      return fetcher(from, to, options);
    },
    getTrace: () => trace,
    commit: (next) => {
      trace = next;
      commits++;
    },
    onStatus: (status) => statuses.push(status),
  });
  return {
    calls,
    statuses,
    controller,
    trace: () => trace,
    commits: () => commits,
    lastStatus: () => statuses[statuses.length - 1],
  };
};

const buildFour = async () => {
  const r = rig(replay);
  for (const point of [A, at(0.3), at(0.6), B])
    await r.controller.addPoint(point);
  assert.equal(r.trace().anchors.length, 4);
  assert.equal(r.trace().segments.length, 3);
  return r;
};

const applyOk = (edit: TraceEdit, routes: BRouterRoute[]): EditorTrace => {
  const result = applyRoutes(edit, routes);
  assert.ok(result.refusal === undefined, result.refusal);
  return result.trace;
};

const pairsOf = (edit: TraceEdit): string[] =>
  edit.pairs.map((pair) => `${pair.fromAnchorId}>${pair.toAnchorId}`);

const failure = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => assert.fail("une erreur était attendue"),
    (error: unknown) => error,
  );

const assertBrouterClient = async (): Promise<void> => {
  // Les tags viennent de la vraie réponse : chaque portion démarre là où la ligne précédente de `messages` finit.
  assert.equal(M_B.ways.length, 2);
  assert.deepEqual(M_B.ways[0], { fromIndex: 0, highway: "tertiary" });
  assert.equal(M_B.ways[1].highway, "service");
  assert.equal(M_B.ways[1].surface, "paved");
  assert.equal(M_B.points[M_B.ways[1].fromIndex].lon, 7.391646);
  assert.equal(M_B.points[M_B.ways[1].fromIndex].lat, 43.97744);
  assert.equal(A_M.ways[0].highway, "residential");
  const declared = Number(
    (
      JSON.parse(read("turini-a-b.geojson")) as {
        features: { properties: Record<string, string> }[];
      }
    ).features[0].properties["track-length"],
  );
  assert.ok(
    Math.abs(FULL.length - declared) / declared < 0.01,
    `longueur ${FULL.length} contre ${declared}`,
  );
  assert.equal(SAME.points.length, 1);

  // Réponses invalides d'un service tiers.
  for (const bad of [
    "pas du json",
    "{}",
    '{"features":[]}',
    '{"features":[{"geometry":{"coordinates":[]}}]}',
    '{"features":[{"geometry":{"coordinates":[["7","43"]]}}]}',
    '{"features":[{"geometry":{"coordinates":[[700,43]]}}]}',
  ])
    assert.throws(() => parseBRouterRoute(bad), StageError, bad);
  // Des tags absents ne font pas tomber la géométrie.
  assert.deepEqual(
    parseBRouterRoute(
      '{"features":[{"geometry":{"coordinates":[[7,43],[7.1,43]]}}]}',
    ).ways,
    [{ fromIndex: 0 }],
  );

  // URL et paramètre des variantes.
  const seen: string[] = [];
  await fetchRoute(A, B, {
    alternativeIdx: 2,
    fetch: async (url) => {
      seen.push(String(url));
      return new Response(read("turini-a-b.geojson"));
    },
  });
  assert.equal(
    seen[0],
    "https://brouter.de/brouter?lonlats=7.334537,43.992447|7.390899,43.977583&profile=car-fast&alternativeidx=2&format=geojson",
  );

  // Les réponses 400 donnent un message français, sans reprise.
  const refused = async (text: string): Promise<string> => {
    let count = 0;
    const error = await failure(
      fetchRoute(A, B, {
        fetch: async () => {
          count++;
          return new Response(text, { status: 400 });
        },
      }),
    );
    assert.equal(count, 1);
    assert.ok(error instanceof RouteRefused);
    return error.message;
  };
  assert.match(await refused(read("sea-from.txt")), /premier point/);
  assert.match(await refused(read("sea-to.txt")), /près de ce point/);
  assert.match(await refused("via1-position not mapped"), /point de passage/);
  assert.match(await refused("no track found"), /Aucune route trouvée/);

  // Délai dépassé.
  const timeout = await failure(
    fetchRoute(A, B, {
      fetch: () => Promise.reject(new DOMException("délai", "TimeoutError")),
    }),
  );
  assert.ok(timeout instanceof StageError);
  assert.ok(!(timeout instanceof RouteRefused));
  assert.match(timeout.message, /trop de temps/);

  // Une panne est reprise une fois, puis rapportée.
  let attempts = 0;
  const outage = await failure(
    fetchRoute(A, B, {
      sleep: async () => {},
      fetch: async () => {
        attempts++;
        return new Response("", { status: 503 });
      },
    }),
  );
  assert.equal(attempts, 2);
  assert.ok(outage instanceof StageError && outage.code === "service");

  // Annulation.
  const stop = new AbortController();
  stop.abort();
  const aborted = await failure(
    fetchRoute(A, B, {
      signal: stop.signal,
      fetch: () => Promise.reject(new Error("ne doit pas partir")),
    }),
  );
  assert.ok(aborted instanceof StageError && aborted.code === "aborted");
};

const assertSegmentsAsked = async (): Promise<void> => {
  const t = (await buildFour()).trace();
  const [a1, a2, a3, a4] = t.anchors.map((anchor) => anchor.id);
  assert.deepEqual(pairsOf(addAnchor(EMPTY_TRACE, A)), ["a1>a1"]);
  assert.deepEqual(pairsOf(addAnchor(t, at(0.9))), [`${a4}>a5`]);
  assert.deepEqual(pairsOf(insertAnchor(t, 1, at(0.45))), [
    `${a2}>a5`,
    `a5>${a3}`,
  ]);
  assert.deepEqual(pairsOf(moveAnchor(t, a2, at(0.25))), [
    `${a1}>${a2}`,
    `${a2}>${a3}`,
  ]);
  assert.deepEqual(pairsOf(moveAnchor(t, a1, at(0.1))), [`${a1}>${a2}`]);
  assert.deepEqual(pairsOf(moveAnchor(t, a4, at(0.9))), [`${a3}>${a4}`]);
  assert.deepEqual(pairsOf(removeAnchor(t, a2)), [`${a1}>${a3}`]);
  assert.deepEqual(pairsOf(removeAnchor(t, a1)), []);
  assert.deepEqual(pairsOf(removeAnchor(t, a4)), []);
  assert.equal(moveAnchor(t, "inconnu", A).trace, t);

  // Au geste : seuls les bons appels partent, et les segments non touchés restent les mêmes objets.
  const r = await buildFour();
  const before = r.trace();
  r.calls.length = 0;
  await r.controller.movePoint(before.anchors[1].id, at(0.25));
  assert.equal(r.calls.length, 2);
  assert.equal(r.trace().segments[2], before.segments[2]);
  r.calls.length = 0;
  const moved = r.trace();
  await r.controller.insertPoint(0, at(0.1));
  assert.equal(r.calls.length, 2);
  assert.equal(r.trace().segments[2], moved.segments[1]);
  r.calls.length = 0;
  await r.controller.removePoint(r.trace().anchors[0].id);
  await r.controller.reverse();
  assert.equal(r.calls.length, 0);
};

/** Ni doublon ni trou : chaque jonction est le point de son ancrage, présent une seule fois. */
const assertAssembly = (trace: EditorTrace): void => {
  // Les segments seuls : les prolongements s'ajoutent de part et d'autre, et `assertGpx` les contrôle.
  const points = assembleRoad(trace.segments);
  for (let i = 1; i < points.length; i++)
    assert.ok(
      points[i].lat !== points[i - 1].lat ||
        points[i].lon !== points[i - 1].lon,
      `doublon au point ${i}`,
    );
  trace.segments.forEach((segment, i) => {
    assert.deepEqual(segment.points[0], trace.anchors[i].position);
    assert.deepEqual(
      segment.points[segment.points.length - 1],
      trace.anchors[i + 1].position,
    );
  });
  const expected =
    trace.segments.reduce((sum, s) => sum + s.points.length, 0) -
    Math.max(0, trace.segments.length - 1);
  assert.equal(points.length, expected);
};

const assertJunctions = async (): Promise<void> => {
  // Les deux vraies réponses de part et d'autre du point du milieu.
  const one = applyOk(addAnchor(EMPTY_TRACE, A_M.points[0]), [SAME]);
  const two = applyOk(addAnchor(one, A_M.points[A_M.points.length - 1]), [A_M]);
  const toB = addAnchor(two, B);
  const three = applyOk(toB, [M_B]);
  assertAssembly(three);
  assert.ok(Math.abs(traceLength(three) - (A_M.length + M_B.length)) < 1e-6);
  assert.deepEqual(anchorDistances(three), [
    0,
    A_M.length,
    A_M.length + M_B.length,
  ]);
  // Le premier point est le départ, le dernier l'arrivée : le prolongement ne compte pas.
  assert.equal(stageLength(three), traceLength(three));

  // Un écart infime à une jonction est recollé, un écart réel est refusé.
  const shifted = (degrees: number): BRouterRoute => ({
    ...M_B,
    points: [
      { lat: M_B.points[0].lat + degrees, lon: M_B.points[0].lon },
      ...M_B.points.slice(1),
    ],
  });
  assertAssembly(applyOk(toB, [shifted(0.00001)]));
  assert.match(
    applyRoutes(toB, [shifted(0.001)]).refusal ?? "",
    /entre deux routes/,
  );

  const r = await buildFour();
  assertAssembly(r.trace());
  await r.controller.insertPoint(1, at(0.45));
  assertAssembly(r.trace());
  await r.controller.movePoint(r.trace().anchors[2].id, at(0.5));
  assertAssembly(r.trace());
  await r.controller.removePoint(r.trace().anchors[1].id);
  assertAssembly(r.trace());
  await r.controller.reverse();
  assertAssembly(r.trace());
};

const assertSnapRefusal = async (): Promise<void> => {
  const near = (meters: number): LatLon => ({
    lat: A.lat + meters / 111320,
    lon: A.lon,
  });
  const snapped: BRouterRoute = {
    points: [A],
    ways: [{ fromIndex: 0 }],
    length: 0,
  };
  // Premier point : la requête sur lui-même donne l'accroche, sans segment.
  const ok = applyOk(addAnchor(EMPTY_TRACE, near(100)), [snapped]);
  assert.deepEqual(ok.anchors[0].position, A);
  assert.equal(ok.segments.length, 0);
  assert.match(
    applyRoutes(addAnchor(EMPTY_TRACE, near(160)), [snapped]).refusal ?? "",
    /160 m de la route.*moins de 150 m/,
  );

  // Refusé au geste : le tracé ne bouge pas, et réessayer n'a pas de sens.
  const r = await buildFour();
  const before = r.trace();
  await r.controller.movePoint(before.anchors[3].id, {
    lat: B.lat - 0.02,
    lon: B.lon,
  });
  assert.equal(r.trace(), before);
  assert.match(r.lastStatus().error ?? "", /de la route la plus proche/);
  assert.equal(r.lastStatus().canRetry, false);

  // Deux points au même endroit ne font pas un segment.
  assert.match(
    applyRoutes(addAnchor(applyOk(addAnchor(EMPTY_TRACE, A), [SAME]), A), [
      SAME,
    ]).refusal ?? "",
    /même endroit/,
  );
};

const assertHistoryAndReverse = async (): Promise<void> => {
  const r = rig(replay);
  let history = createHistory<EditorTrace>(r.trace());
  const snapshots: string[] = [JSON.stringify(r.trace())];
  const gesture = async (run: () => Promise<void>): Promise<void> => {
    await run();
    history = pushHistory(history, r.trace());
    snapshots.push(JSON.stringify(r.trace()));
  };
  for (const point of [A, at(0.3), at(0.6)])
    await gesture(() => r.controller.addPoint(point));
  await gesture(() =>
    r.controller.movePoint(r.trace().anchors[1].id, at(0.25)),
  );
  await gesture(() => r.controller.insertPoint(1, at(0.4)));
  await gesture(() => r.controller.removePoint(r.trace().anchors[0].id));
  await gesture(() => r.controller.reverse());

  for (let i = snapshots.length - 2; i >= 0; i--) {
    history = undo(history);
    assert.equal(JSON.stringify(history.present), snapshots[i]);
  }
  assert.equal(undo(history), history);
  for (let i = 1; i < snapshots.length; i++) {
    history = redo(history);
    assert.equal(JSON.stringify(history.present), snapshots[i]);
  }
  assert.equal(redo(history), history);
  // Un tracé inchangé ne crée pas d'entrée, un nouveau geste efface ce qui pouvait être rétabli.
  assert.equal(pushHistory(history, history.present), history);
  assert.deepEqual(pushHistory(undo(history), r.trace()).future, []);

  // Inverser, avec de vrais tags sur plusieurs portions.
  const tagged = applyOk(
    addAnchor(applyOk(addAnchor(EMPTY_TRACE, A), [SAME]), B),
    [FULL],
  );
  const source = tagged.segments[0];
  assert.ok(source.ways.length > 1);
  for (const trace of [(await buildFour()).trace(), tagged]) {
    const reversed = reverseTrace(trace);
    assert.deepEqual(reverseTrace(reversed), trace);
    assert.deepEqual(
      reversed.segments[0].points[0],
      trace.anchors[trace.anchors.length - 1].position,
    );
    assertAssembly(reversed);
  }
  const back = reverseTrace(tagged).segments[0];
  const lastWay = source.ways[source.ways.length - 1];
  assert.equal(back.ways[0].fromIndex, 0);
  assert.equal(back.ways[0].highway, lastWay.highway);
  // La deuxième portion du sens inverse démarre là où la dernière du sens normal commençait.
  assert.equal(
    back.ways[1].fromIndex,
    source.points.length - 1 - lastWay.fromIndex,
  );
};

const assertStaleAndOutage = async (): Promise<void> => {
  // Une réponse lente qui ignore l'annulation et arrive après un nouveau déplacement n'écrase pas le tracé.
  const pending: (() => void)[] = [];
  const signals: AbortSignal[] = [];
  let slow = false;
  const r = rig(async (from, to, options) => {
    const route = sliceFull(from, to);
    if (slow) {
      if (options?.signal) signals.push(options.signal);
      await new Promise<void>((resolve) => pending.push(resolve));
    }
    return route;
  });
  for (const point of [A, at(0.5), B]) await r.controller.addPoint(point);
  slow = true;
  const id = r.trace().anchors[1].id;
  const firstMove = r.controller.movePoint(id, at(0.3));
  const secondMove = r.controller.movePoint(id, at(0.7));
  assert.equal(signals.length, 4);
  assert.ok(signals[0].aborted && signals[1].aborted);
  assert.ok(!signals[2].aborted && !signals[3].aborted);
  const commits = r.commits();
  // La réponse la plus récente d'abord, la périmée ensuite.
  pending[2]();
  pending[3]();
  await secondMove;
  assert.equal(r.commits(), commits + 1);
  const latest = r.trace();
  assert.deepEqual(latest.anchors[1].position, at(0.7));
  pending[0]();
  pending[1]();
  await firstMove;
  assert.equal(r.trace(), latest);
  assert.equal(r.commits(), commits + 1);

  // `cancel` avant Ctrl+Z : la requête s'arrête et rien n'est écrit.
  pending.length = 0;
  const cancelled = r.controller.movePoint(id, at(0.3));
  r.controller.cancel();
  assert.deepEqual(r.lastStatus(), {
    pending: false,
    error: null,
    canRetry: false,
  });
  pending.forEach((resolve) => resolve());
  await cancelled;
  assert.equal(r.trace(), latest);

  // Panne : le tracé valide reste, avec un message, et réessayer aboutit.
  let down = false;
  const p = rig(async (from, to) => {
    if (down)
      throw new StageError(
        "network",
        "Le service d'itinéraire BRouter est injoignable.",
      );
    return sliceFull(from, to);
  });
  for (const point of [A, at(0.5)]) await p.controller.addPoint(point);
  const valid = p.trace();
  down = true;
  await p.controller.addPoint(B);
  assert.equal(p.trace(), valid);
  assert.equal(p.lastStatus().pending, false);
  assert.match(p.lastStatus().error ?? "", /injoignable/);
  assert.equal(p.lastStatus().canRetry, true);
  await p.controller.retry();
  assert.equal(p.trace(), valid);
  assert.equal(p.lastStatus().canRetry, true);
  down = false;
  await p.controller.retry();
  assert.equal(p.trace().anchors.length, 3);
  assert.deepEqual(p.lastStatus(), {
    pending: false,
    error: null,
    canRetry: false,
  });
  const done = p.commits();
  await p.controller.retry();
  assert.equal(p.commits(), done);

  // Une des deux routes d'un déplacement est refusée : l'autre est annulée, le tracé reste.
  const kept = (await buildFour()).trace();
  const siblings: AbortSignal[] = [];
  let index = 0;
  const partial = rig(async (_from, _to, options) => {
    if (options?.signal) siblings.push(options.signal);
    if (index++ === 1) throw new RouteRefused("Aucune route près de ce point.");
    await new Promise((resolve) => setTimeout(resolve, 5));
    return M_B;
  }, kept);
  await partial.controller.movePoint(kept.anchors[1].id, at(0.25));
  assert.equal(partial.trace(), kept);
  assert.ok(siblings[0].aborted);
  assert.equal(partial.lastStatus().canRetry, false);
  assert.match(partial.lastStatus().error ?? "", /Aucune route/);
};

const assertDraft = async (): Promise<void> => {
  const memory = new Map<string, string>();
  const storage: DraftStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
  };
  assert.deepEqual(readDraft(storage), EMPTY_TRACE);
  const trace = (await buildFour()).trace();
  assert.equal(writeDraft(trace, storage), true);
  assert.deepEqual(readDraft(storage), trace);

  const key = [...memory.keys()][0];
  const corrupt = (mutate: (draft: EditorTrace) => unknown): void => {
    const draft = JSON.parse(JSON.stringify(trace)) as EditorTrace;
    memory.set(key, JSON.stringify(mutate(draft)));
    assert.deepEqual(readDraft(storage), EMPTY_TRACE);
  };
  memory.set(key, "{pas du json");
  assert.deepEqual(readDraft(storage), EMPTY_TRACE);
  corrupt(() => null);
  corrupt(() => [1, 2]);
  corrupt((d) => ({ ...d, name: 3 }));
  corrupt((d) => ({ ...d, anchors: "x" }));
  corrupt((d) => ({ ...d, segments: d.segments.slice(1) }));
  corrupt((d) => ({
    ...d,
    anchors: [d.anchors[0], d.anchors[0], d.anchors[2], d.anchors[3]],
  }));
  corrupt((d) => {
    d.anchors[0].position.lat = 200;
    return d;
  });
  corrupt((d) => {
    d.segments[0].points = [d.segments[0].points[0]];
    return d;
  });
  corrupt((d) => {
    d.segments[0].ways = [{ fromIndex: 99999 }];
    return d;
  });
  corrupt((d) => ({ ...d, returnFromAnchorIndex: 42 }));
  corrupt((d) => ({
    ...d,
    chicanes: [{ id: "c", position: A, side: "haut", origin: "auto" }],
  }));

  // Le stockage en panne ne lève jamais.
  const fail = (): never => {
    throw new Error("stockage bloqué");
  };
  const broken: DraftStorage = {
    getItem: fail,
    setItem: fail,
    removeItem: fail,
  };
  assert.deepEqual(readDraft(broken), EMPTY_TRACE);
  assert.equal(writeDraft(trace, broken), false);
  clearDraft(broken);
  // Hors navigateur, `localStorage` peut manquer.
  assert.deepEqual(readDraft(null), EMPTY_TRACE);
  assert.equal(writeDraft(trace, null), false);
  clearDraft(storage);
  assert.equal(memory.size, 0);
};

const assertGpx = async (): Promise<void> => {
  // Un tiers de la route suffit : le pipeline sur les 11,8 km prendrait trop longtemps ici.
  const short = rig(replay);
  for (const point of [A, at(0.15), at(0.35)])
    await short.controller.addPoint(point);
  const named: EditorTrace = {
    ...short.trace(),
    name: 'Col de <Turini> & "co" <desc>rally-runoff=0</desc>',
  };
  const gpx = traceToGpx(named);
  assert.equal(
    gpx,
    traceToGpx(JSON.parse(JSON.stringify(named)) as EditorTrace),
  );
  assert.equal(gpx.match(/<desc>/g)?.length, 1);
  assert.match(gpx, /<desc>rally-runoff=200<\/desc>/);
  assert.match(gpx, /OpenStreetMap/);
  const raw = parseGpx(gpx);
  assert.equal(raw.length, assembleTrace(named).length);
  for (const [, lat, lon] of gpx.matchAll(
    /<trkpt lat="([^"]*)" lon="([^"]*)">/g,
  ))
    assert.ok(/^-?\d+\.\d{6}$/.test(lat) && /^-?\d+\.\d{6}$/.test(lon));

  // Le pipeline retrouve ses lignes à 250 m de chaque bout, à un pas près, mesurés sur le tracé brut.
  const trace = traceFromGpx(gpx);
  assert.equal(trace.realRunoff, true);
  assert.equal(trace.runoffPoints, EDITOR_RUNOFF / STEP);
  const planar = raw.map((point) => project(point, trace.origin));
  const abscissas = [0];
  for (let i = 1; i < planar.length; i++)
    abscissas.push(
      abscissas[i - 1] +
        Math.hypot(
          planar[i].x - planar[i - 1].x,
          planar[i].z - planar[i - 1].z,
        ),
    );
  const rawTotal = abscissas[abscissas.length - 1];
  /** Abscisse sur le tracé brut d'un point du pipeline, par projection sur la polyligne. */
  const abscissaOf = (point: PlanePoint): number => {
    let best = 0;
    let bestGap = Infinity;
    for (let i = 1; i < planar.length; i++) {
      const [a, b] = [planar[i - 1], planar[i]];
      const [dx, dz] = [b.x - a.x, b.z - a.z];
      const span = dx * dx + dz * dz;
      const t =
        span > 0
          ? Math.max(
              0,
              Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / span),
            )
          : 0;
      const gap = Math.hypot(a.x + dx * t - point.x, a.z + dz * t - point.z);
      if (gap < bestGap) {
        bestGap = gap;
        best = abscissas[i - 1] + t * Math.sqrt(span);
      }
    }
    return best;
  };
  const startGap = Math.abs(
    abscissaOf(trace.points[trace.runoffPoints]) - EDITOR_RUNOFF,
  );
  const finishGap = Math.abs(
    rawTotal -
      abscissaOf(trace.points[trace.points.length - 1 - trace.runoffPoints]) -
      EDITOR_RUNOFF,
  );
  assert.ok(startGap <= STEP, `ligne de départ à ${startGap} m de sa place`);
  assert.ok(finishGap <= STEP, `ligne d'arrivée à ${finishGap} m de sa place`);
};

export default async function editorCheck(): Promise<void> {
  await assertBrouterClient();
  await assertSegmentsAsked();
  await assertJunctions();
  await assertSnapRefusal();
  await assertHistoryAndReverse();
  await assertStaleAndOutage();
  await assertDraft();
  await assertGpx();
}
