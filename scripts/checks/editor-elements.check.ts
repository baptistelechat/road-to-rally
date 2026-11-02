// Aller-retour, chicanes et variantes dans l'éditeur (stories 3.7 à 3.10), sans réseau ni navigateur.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeAutoChicanes } from "../../src/editor/autoChicanes";
import {
  chicaneBand,
  chicaneRequests,
  listChicanes,
  settleChicanes,
  type ChicaneAxis,
  type ListedChicane,
} from "../../src/editor/chicanes";
import {
  readDraft,
  writeDraft,
  type DraftStorage,
} from "../../src/editor/draft";
import { nearestIndex } from "../../src/editor/hover";
import { RETURN_LOST, RETURN_REFUSED } from "../../src/editor/roundTrip";
import { createEditorStore, stageGpx } from "../../src/editor/store";
import { reverseTrace, stageLength } from "../../src/editor/trace";
import {
  EMPTY_TRACE,
  type EditorTrace,
  type Segment,
} from "../../src/editor/types";
import { findVariants, sameRoute } from "../../src/editor/variants";
import { analyzeTrace } from "../../src/geo/analyzeTrace";
import {
  parseBRouterRoute,
  RouteRefused,
  type BRouterRoute,
  type FetchRoute,
} from "../../src/geo/brouter";
import {
  CHICANE_LINE_CLEARANCE,
  EDITOR_CHICANE_MIN_GAP,
  STEP,
} from "../../src/geo/config";
import {
  closestOnPolyline,
  detectRoundTrip,
  parseGpx,
  project,
  traceFromGpx,
  unproject,
  type LatLon,
  type PlanePoint,
} from "../../src/geo/gpx";
import { syntheticLollipop } from "../prototypes/junction/geometry";

const ORIGIN: LatLon = { lat: 44.5, lon: 6 };
const toLatLon = (p: PlanePoint): LatLon => unproject(p, ORIGIN);
const reversed = <T>(values: T[]): T[] => [...values].reverse();

const routeOf = (points: LatLon[]): BRouterRoute => {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const { x, z } = project(points[i], points[i - 1]);
    length += Math.hypot(x, z);
  }
  return { points, ways: [{ fromIndex: 0 }], length };
};

const nearestOn = (line: LatLon[], target: LatLon): number =>
  nearestIndex(line, target);

/** Un tracé dont les points découpent `road` en segments aux index donnés. */
const traceOn = (road: LatLon[], cuts: number[]): EditorTrace => {
  const anchors = cuts.map((cut, i) => ({
    id: `a${i + 1}`,
    position: road[cut],
  }));
  const segments: Segment[] = cuts.slice(1).map((cut, i) => ({
    fromAnchorId: anchors[i].id,
    toAnchorId: anchors[i + 1].id,
    ...routeOf(road.slice(cuts[i], cut + 1)),
  }));
  return { ...EMPTY_TRACE, anchors, segments };
};

/** BRouter pour de faux : `road` à l'aller, `back` au départ de sa fin ; tout le reste suit `road`. */
const fakeRouter = (road: LatLon[], back: LatLon[]) => {
  const calls: { from: LatLon; to: LatLon; alternativeIdx?: number }[] = [];
  const fetchRoute: FetchRoute = (from, to, options = {}) => {
    calls.push({ from, to, alternativeIdx: options.alternativeIdx });
    const start = nearestOn(road, from);
    const end = nearestOn(road, to);
    if (start === road.length - 1 && end < start)
      return Promise.resolve(routeOf(back.slice(0, nearestOn(back, to) + 1)));
    return Promise.resolve(
      routeOf(
        start <= end
          ? road.slice(start, end + 1)
          : reversed(road.slice(end, start + 1)),
      ),
    );
  };
  return { calls, fetchRoute };
};

const noAnalysis = () => Promise.reject(new Error("analyse inattendue"));

const memoryStorage = (): DraftStorage => {
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
  };
};

// --- Tracés de référence ---

/** Un bras droit et un rond-point au bout. `road` : jusqu'au fond du rond-point. `back` : la suite, jusqu'au début. */
const lollipop = (armLength: number, radius = 25) => {
  const { arm, loop } = syntheticLollipop(armLength, radius, 8);
  const middle = Math.floor(loop.length / 2);
  const road = [...arm, ...loop.slice(1, middle + 1)].map(toLatLon);
  const back = [...loop.slice(middle), ...reversed(arm).slice(1)].map(toLatLon);
  return { road, back };
};

/** Une vraie réponse enregistrée, avec une ligne droite devant : un tracé fait au moins 2 km. */
const realRoundabout = (name: string, ring: LatLon, trim: [number, number]) => {
  const { points } = parseBRouterRoute(
    readFileSync(
      join("fixtures", "brouter", "roundabouts", `${name}.geojson`),
      "utf8",
    ),
  );
  const coords = points.slice(trim[0], points.length - trim[1]);
  const via = nearestOn(coords, ring);
  const origin = coords[0];
  const target = project(coords[via], origin);
  const norm = Math.hypot(target.x, target.z) || 1;
  const lead: LatLon[] = [];
  for (let d = 1300; d > 0; d -= 50)
    lead.push(
      unproject(
        { x: (-target.x / norm) * d, z: (-target.z / norm) * d },
        origin,
      ),
    );
  return {
    road: [...lead, ...coords.slice(0, via + 1)],
    back: [...coords.slice(via), ...reversed(lead)],
  };
};

// --- Aller-retour (3.7) ---

const checkRoundabouts = async (): Promise<void> => {
  const CASES = [
    {
      name: "a-5.75",
      ring: { lat: 45.147165, lon: 5.755222 },
      trim: [0, 0] as [number, number],
    },
    {
      name: "b-0.90",
      ring: { lat: 44.213054, lon: -0.900878 },
      trim: [0, 0] as [number, number],
    },
    {
      name: "c-6.07",
      ring: { lat: 44.563734, lon: 6.078623 },
      trim: [3, 2] as [number, number],
    },
  ];
  for (const { name, ring, trim } of CASES) {
    const { road, back } = realRoundabout(name, ring, trim);
    const { fetchRoute, calls } = fakeRouter(road, back);
    const store = createEditorStore(
      fetchRoute,
      traceOn(road, [0, road.length - 1]),
      noAnalysis,
    );
    await store.getState().returnByRoad();
    const trace = store.getState().history.present;
    assert.equal(calls.length, 1, `${name} : une seule requête, pour le tour`);
    assert.ok(trace.returnRoute, `${name} : retour refusé`);
    assert.equal(trace.returnFromAnchorIndex, 1, name);

    // Le GPX est le signal : sa fin recopie son début, `rally-runoff` compris.
    const gpx = stageGpx(trace);
    assert.equal(detectRoundTrip(parseGpx(gpx))?.kind, "loop", name);
    const analysis = analyzeTrace(gpx, {
      widthsByHighway: trace.segments,
      realReturn: trace.returnRoute.realReturn,
    });
    assert.deepEqual(
      analysis.issues.filter((issue) => issue.blocking).map((i) => i.message),
      [],
      name,
    );
    const axis = analysis.axis;
    assert.ok(axis?.roundTrip, `${name} : pas lu comme un aller-retour`);
    assert.ok(
      Math.abs(axis.length - stageLength(trace)) < axis.length * 0.05,
      `${name} : longueur ${axis.length} pour ${stageLength(trace)} annoncés`,
    );
    const gap = analysis.issues.find((i) => i.code === "returnDeviation");
    if (name === "b-0.90") assert.equal(gap, undefined, name);
    if (name === "c-6.07") assert.equal(gap?.blocking, false, name);

    // Les chicanes automatiques restent sur le bras, loin de la jonction, jamais sur le retour.
    for (const { position } of computeAutoChicanes(axis, trace.segments)
      .chicanes) {
      const index = nearestIndex(axis.latLon, position);
      assert.ok(
        index * STEP <= axis.roundTrip.armEnd * STEP - CHICANE_LINE_CLEARANCE,
        `${name} : chicane dans la jonction`,
      );
    }
  }
};

const checkRoundTripGestures = async (): Promise<void> => {
  const { road, back } = lollipop(1500);
  const middle = Math.floor(road.length / 2);
  const base = traceOn(road, [0, middle, road.length - 1]);
  const { fetchRoute, calls } = fakeRouter(road, back);
  const store = createEditorStore(fetchRoute, base, noAnalysis);
  const state = () => store.getState();
  const present = () => state().history.present;

  // Le retour se pose et s'annule comme un autre geste. Les limites comptent les deux passages.
  await state().returnByRoad();
  const withReturn = present();
  assert.ok(withReturn.returnRoute);
  assert.equal(withReturn.returnFromAnchorIndex, 2);
  assert.ok(stageLength(withReturn) > 2 * 1500 - 2 * 250);
  state().undo();
  assert.equal(present(), base);
  state().redo();
  assert.equal(present(), withReturn);

  // Inverser n'a aucun effet : l'action est coupée, le rond-point ne se fait pas à contresens.
  assert.equal(reverseTrace(withReturn), withReturn);
  await state().reverse();
  assert.equal(present(), withReturn);

  // Modifier le tracé recalcule le retour.
  const before = calls.length;
  await state().removePoint("a2");
  assert.equal(calls.length, before + 2, "le segment recousu, puis le retour");
  assert.equal(present().anchors.length, 2);
  assert.equal(present().returnFromAnchorIndex, 1, "index suivi");
  assert.ok(present().returnRoute);
  assert.equal(detectRoundTrip(parseGpx(stageGpx(present())))?.kind, "loop");
  state().undo();

  // Le dernier point retiré : plus de boucle au bout, le retour tombe, en le disant, et Ctrl+Z le rend.
  await state().removePoint("a3");
  assert.equal(present().returnRoute, null);
  assert.equal(present().returnFromAnchorIndex, null);
  assert.equal(state().notice, RETURN_LOST);
  state().undo();
  assert.equal(present(), withReturn);

  // Retirer le retour.
  await state().cancelReturn();
  assert.equal(present().returnRoute, null);
  assert.equal(present().returnFromAnchorIndex, null);
  assert.equal(present().segments, withReturn.segments);

  // Le brouillon garde le retour ; une entrée invalide redonne un brouillon vide ; un ancien brouillon se relit.
  const storage = memoryStorage();
  assert.equal(writeDraft(withReturn, storage), true);
  assert.deepEqual(readDraft(storage), JSON.parse(JSON.stringify(withReturn)));
  const save = (value: unknown) =>
    storage.setItem("rally-editor-draft", JSON.stringify(value));
  save({ ...withReturn, returnFromAnchorIndex: null });
  assert.deepEqual(readDraft(storage), EMPTY_TRACE);
  save({ ...withReturn, returnRoute: { path: [], realReturn: [] } });
  assert.deepEqual(readDraft(storage), EMPTY_TRACE);
  const { returnRoute, chicanesEnabled, ...old } = base;
  assert.equal(returnRoute, null);
  assert.equal(chicanesEnabled, true);
  save(old);
  assert.deepEqual(
    readDraft(storage).segments.length,
    base.segments.length,
    "brouillon d'avant ces champs",
  );

  // Pas d'aire de demi-tour : un cul-de-sac est refusé, sans rien changer, et le GPX qui le simulerait reste refusé.
  const straight = road.slice(0, Math.floor(road.length * 0.9));
  const deadEnd = fakeRouter(straight, reversed(straight));
  const refused = createEditorStore(
    deadEnd.fetchRoute,
    traceOn(straight, [0, straight.length - 1]),
    noAnalysis,
  );
  const untouched = refused.getState().history.present;
  await refused.getState().returnByRoad();
  assert.equal(refused.getState().history.present, untouched);
  assert.equal(refused.getState().status.error, RETURN_REFUSED);
  assert.equal(refused.getState().status.canRetry, false);

  // Une panne se réessaie, sans perdre le tracé.
  let broken = true;
  const flaky: FetchRoute = (from, to, options) => {
    if (broken) return Promise.reject(new Error("réseau"));
    return fakeRouter(road, back).fetchRoute(from, to, options);
  };
  const retried = createEditorStore(flaky, base, noAnalysis);
  await retried.getState().returnByRoad();
  assert.equal(retried.getState().history.present, base);
  assert.equal(retried.getState().status.canRetry, true);
  broken = false;
  await retried.getState().retry();
  assert.ok(retried.getState().history.present.returnRoute);

  // Les limites comptent les deux passages : 8 km de bras dépassent les 15 km.
  const long = lollipop(8000);
  const longStore = createEditorStore(
    fakeRouter(long.road, long.back).fetchRoute,
    traceOn(long.road, [0, long.road.length - 1]),
    noAnalysis,
  );
  await longStore.getState().returnByRoad();
  const issues = analyzeTrace(
    stageGpx(longStore.getState().history.present),
  ).issues;
  assert.ok(
    issues.some((issue) => issue.code === "tooLong" && issue.blocking),
    "aller-retour de 16 km accepté",
  );
};

// --- Chicanes automatiques (3.8) ---

const checkAutoChicanes = (): void => {
  const gpx = readFileSync(join("fixtures", "stages", "road.gpx"), "utf8");
  const { axis } = analyzeTrace(gpx);
  assert.ok(axis, "road sans axe");
  const first = computeAutoChicanes(axis);
  assert.ok(first.chicanes.length > 0, "road sans chicane");
  assert.deepEqual(
    computeAutoChicanes(axis),
    first,
    "même axe, mêmes chicanes",
  );
  const { from, to } = chicaneBand(axis);
  for (const { position } of first.chicanes) {
    const index = nearestIndex(axis.latLon, position);
    assert.ok(index >= from && index <= to, "chicane sur une ligne");
  }
};

// --- Édition des chicanes (3.9) ---

const checkChicaneEdits = (): void => {
  // 6 km tout droit, trois points : assez de chicanes automatiques, et de quoi toucher un segment sans l'autre.
  const road: LatLon[] = [];
  for (let x = 0; x <= 6000; x += 20) road.push(toLatLon({ x, z: 0 }));
  const mid = Math.floor(road.length / 2);
  const base = traceOn(road, [0, mid, road.length - 1]);
  const { fetchRoute } = fakeRouter(road, reversed(road));
  const store = createEditorStore(fetchRoute, base, noAnalysis);
  const state = () => store.getState();
  const present = () => state().history.present;
  const { axis, issues } = analyzeTrace(stageGpx(base), {
    widthsByHighway: base.segments,
  });
  assert.deepEqual(
    issues.filter((i) => i.blocking),
    [],
  );
  assert.ok(axis);
  const autoChicanes = computeAutoChicanes(axis, base.segments);
  store.setState({
    analysis: { axis, issues: [] },
    autoChicanes,
  });
  const context = () => ({
    trace: present(),
    auto: autoChicanes.chicanes,
    axis: axis as ChicaneAxis,
  });
  const list = (): ListedChicane[] => listChicanes(context());
  const initial = list();
  assert.ok(initial.length >= 3, `${initial.length} chicanes automatiques`);
  assert.ok(initial.every((c) => c.origin === "auto"));
  assert.equal(
    present().chicanes.length,
    0,
    "les automatiques hors du document",
  );

  // Supprimer, annuler, rétablir.
  const victim = initial[0];
  state().removeChicaneById(victim.id);
  assert.equal(list().length, initial.length - 1);
  assert.ok(!list().some((c) => c.id === victim.id));
  state().undo();
  assert.equal(list().length, initial.length);
  state().redo();
  assert.equal(list().length, initial.length - 1);
  state().undo();

  // Déplacer une automatique : elle devient celle du joueur, sa place ne reçoit plus d'automatique.
  const moved = initial[1];
  const target = axis.latLon[moved.index + 100];
  state().moveChicaneTo(moved.id, target);
  const player = list().find((c) => c.origin === "player");
  assert.ok(player, "chicane du joueur");
  assert.equal(player.index, moved.index + 100);
  assert.equal(list().length, initial.length);
  assert.equal(present().removedChicanes.length, 1);

  // Elle tombe au bon endroit dans le jeu : à moins de 2 m de sa position sur l'axe final.
  const final = traceFromGpx(stageGpx(present()));
  const { distance: offset } = closestOnPolyline(
    project(player.position, final.origin),
    final.points,
  );
  assert.ok(offset < 2, `${offset} m de l'axe du jeu`);

  // Hors de la route : recalée sur l'axe, jamais à côté.
  const aside = { lat: target.lat + 0.001, lon: target.lon };
  state().moveChicaneTo(player.id, aside);
  const again = list().find((c) => c.id === player.id);
  assert.ok(again);
  assert.equal(again.position, axis.latLon[again.index]);

  // Au clavier : un cran, et le refus trop près d'une autre, qui ne change rien.
  const beforeNudge = again.index;
  state().nudgeChicaneBy(player.id, 1);
  assert.equal(list().find((c) => c.id === player.id)?.index, beforeNudge + 10);
  const neighbour = list().find((c) => c.id !== player.id);
  assert.ok(neighbour);
  const snapshot = present();
  state().moveChicaneTo(player.id, axis.latLon[neighbour.index + 5]);
  assert.equal(present(), snapshot, "trop près : rien ne bouge");
  assert.match(state().notice ?? "", new RegExp(`${EDITOR_CHICANE_MIN_GAP} m`));

  // Changer de côté : marque la chicane comme celle du joueur.
  const auto = list().find((c) => c.origin === "auto");
  assert.ok(auto);
  const side = auto.side;
  state().flipChicaneSide(auto.id);
  const flipped = present().chicanes[present().chicanes.length - 1];
  assert.equal(flipped.origin, "player");
  assert.notEqual(flipped.side, side);

  // Ajouter : le plus grand espace libre, ou l'endroit visé ; le plafond automatique ne compte pas.
  const count = list().length;
  state().addChicaneAt();
  assert.equal(list().length, count + 1);
  const added = list().filter((c) => c.origin === "player");
  const indices = list().map((c) => c.index);
  indices
    .slice(1)
    .forEach((index, i) =>
      assert.ok(
        (index - indices[i]) * STEP >= EDITOR_CHICANE_MIN_GAP,
        "deux chicanes trop proches",
      ),
    );
  assert.ok(added.length >= 3);

  // Ce que « Rouler » envoie : des positions géographiques et des côtés, rien de plus.
  const requests = chicaneRequests(list());
  assert.equal(requests.length, list().length);
  assert.deepEqual(Object.keys(requests[0]).sort(), ["position", "side"]);

  // L'interrupteur retire tout et ne perd rien.
  const chosen = present().chicanes;
  state().setChicanesEnabled(false);
  assert.deepEqual(list(), []);
  assert.deepEqual(chicaneRequests(list()), []);
  state().setChicanesEnabled(true);
  assert.equal(present().chicanes, chosen);

  // Rétablir remet à zéro, et s'annule.
  const touched = present();
  state().resetAutoChicanes();
  assert.equal(list().length, initial.length);
  assert.equal(present().removedChicanes.length, 0);
  state().undo();
  assert.equal(present(), touched);

  // Le brouillon et l'historique portent ces choix.
  const storage = memoryStorage();
  writeDraft(present(), storage);
  assert.deepEqual(readDraft(storage).chicanes, present().chicanes);
  assert.deepEqual(
    readDraft(storage).removedChicanes,
    present().removedChicanes,
  );
};

const checkSettle = async (): Promise<void> => {
  const road: LatLon[] = [];
  for (let x = 0; x <= 6000; x += 20) road.push(toLatLon({ x, z: 0 }));
  const mid = Math.floor(road.length / 2);
  const trace = traceOn(road, [0, mid, road.length - 1]);
  const element = (id: string, index: number, zOffset = 0) => ({
    id,
    position: toLatLon({ x: index * 20, z: zOffset }),
    side: "left" as const,
    origin: "player" as const,
  });

  // Sur la route, à l'écart modeste, ou sur une route disparue. Une branche à 30 m ne récupère rien.
  const withThree: EditorTrace = {
    ...trace,
    chicanes: [
      element("c1", 50),
      element("c2", 200, 8),
      element("c3", 250, 30),
    ],
  };
  const settled = settleChicanes(withThree);
  assert.equal(settled.lost, 1, "la chicane à 30 m est retirée");
  assert.deepEqual(
    settled.trace.chicanes.map(({ id }) => id),
    ["c1", "c2"],
  );
  assert.equal(settled.trace.chicanes[0], withThree.chicanes[0]);
  const snapped = project(settled.trace.chicanes[1].position, ORIGIN);
  assert.ok(Math.abs(snapped.z) < 0.01, "recalée sur la route");

  // Sans chicane, ou sans rien à changer : le même objet, l'historique ne bouge pas.
  assert.equal(settleChicanes(trace).trace, trace);
  const stable = { ...trace, chicanes: [element("c1", 50)] };
  assert.equal(settleChicanes(stable).trace, stable);

  // Modifier un autre segment garde les choix du joueur ; un segment retiré emporte la sienne, avec un message.
  const { fetchRoute } = fakeRouter(road, reversed(road));
  const store = createEditorStore(
    fetchRoute,
    {
      ...trace,
      chicanes: [element("c1", 50), element("c2", 250)],
      removedChicanes: [toLatLon({ x: 1500, z: 0 })],
    },
    noAnalysis,
  );
  const state = () => store.getState();
  await state().insertPoint(0, road[40]);
  assert.equal(state().history.present.chicanes.length, 2);
  assert.equal(state().notice, null);

  const { axis } = analyzeTrace(stageGpx(state().history.present));
  assert.ok(axis);
  const auto = computeAutoChicanes(axis).chicanes;
  const near = auto.filter(
    ({ position }) => Math.abs(project(position, ORIGIN).x - 1500) < 100,
  );
  const shown = listChicanes({
    trace: state().history.present,
    auto: [...auto, { position: toLatLon({ x: 1500, z: 0 }), side: "left" }],
    axis,
  });
  assert.ok(
    !shown.some(
      ({ position, origin }) =>
        origin === "auto" && Math.abs(project(position, ORIGIN).x - 1500) < 100,
    ),
    `chicane supprimée revenue (${near.length} calculées à cet endroit)`,
  );

  // Le dernier segment retiré : la chicane n'a plus de route, et le message le dit.
  await state().removePoint("a3");
  assert.deepEqual(
    state().history.present.chicanes.map(({ id }) => id),
    ["c1"],
  );
  assert.match(state().notice ?? "", /n'est plus sur le tracé/);
  state().undo();
  assert.equal(state().history.present.chicanes.length, 2);

  // Inverser le tracé garde chaque bloc au même endroit : le premier bloc change de côté.
  const flipped = reverseTrace({ ...trace, chicanes: [element("c1", 50)] });
  assert.equal(flipped.chicanes[0].side, "right");
};

// --- Variantes (3.10) ---

const wave = (
  amplitude: number,
  wavelength: number,
  length = 3000,
): LatLon[] => {
  const points: LatLon[] = [];
  for (let x = 0; x <= length; x += 10)
    points.push(
      toLatLon({ x, z: amplitude * Math.sin((2 * Math.PI * x) / wavelength) }),
    );
  return points;
};

const checkVariants = async (): Promise<void> => {
  const current = wave(0, 1000);
  const trace = traceOn(current, [0, current.length - 1]);
  const analyze = (gpx: string, options: Parameters<typeof analyzeTrace>[1]) =>
    Promise.resolve(analyzeTrace(gpx, options));

  const signal = new AbortController().signal;
  const search = (routes: (LatLon[] | null)[]) => {
    let active = 0;
    let most = 0;
    let requests = 0;
    const fetchRoute: FetchRoute = async (_from, _to, options = {}) => {
      requests++;
      active++;
      most = Math.max(most, active);
      await new Promise((resolve) => setImmediate(resolve));
      active--;
      const points = routes[options.alternativeIdx ?? 0];
      if (!points) throw new RouteRefused("Pas d'itinéraire.");
      return routeOf(points);
    };
    return findVariants(trace, 0, fetchRoute, analyze, signal).then(
      (found) => ({ ...found, requests, most }),
    );
  };

  // Doublons retirés, la plus sinueuse d'abord, une requête après l'autre, quatre au plus.
  const winding = wave(60, 375);
  const gentle = wave(60, 1500);
  const found = await search([current, wave(5, 1500), gentle, winding]);
  assert.equal(found.requests, 4);
  assert.equal(found.most, 1, "requêtes en parallèle");
  assert.deepEqual(
    found.variants.map(({ alternativeIdx }) => alternativeIdx),
    [3, 2],
  );
  assert.ok(found.variants[0].turnsPerKm > found.variants[1].turnsPerKm);
  assert.ok(sameRoute(current, wave(5, 1500)));
  assert.ok(!sameRoute(current, gentle));

  // À égalité, l'ordre de BRouter, à chaque fois.
  const tie = await search([wave(60, 1500), wave(-60, 1500), null, null]);
  assert.deepEqual(
    tie.variants.map(({ alternativeIdx }) => alternativeIdx),
    [0, 1],
  );

  // « Aucune autre route » : doublons et index sans itinéraire ne comptent pas pour écartées.
  const none = await search([current, current, null, null]);
  assert.deepEqual(none.variants, []);
  assert.equal(none.rejected, 0);
  assert.equal(none.failure, null);

  // Trop longue ou qui se croise : jamais proposée.
  const tooLong = wave(0, 1000, 16000);
  const crossing: PlanePoint[] = [];
  for (let x = 0; x <= 1500; x += 10) crossing.push({ x, z: 0 });
  for (let a = 0; a <= 360; a += 5) {
    const t = (a * Math.PI) / 180;
    crossing.push({ x: 1500 + 40 * Math.sin(t), z: 40 - 40 * Math.cos(t) });
  }
  for (let x = 1400; x <= 3000; x += 10) crossing.push({ x, z: 0 });
  const refused = await search([tooLong, crossing.map(toLatLon), null, null]);
  assert.deepEqual(refused.variants, []);
  assert.equal(refused.rejected, 2);

  // Une panne garde ce qui a été trouvé, et le dit.
  const failing: FetchRoute = (_from, _to, options = {}) =>
    options.alternativeIdx === 1
      ? Promise.reject(new Error("réseau"))
      : Promise.resolve(routeOf(gentle));
  const partial = await findVariants(trace, 0, failing, analyze, signal);
  assert.equal(partial.variants.length, 1);
  assert.ok(partial.failure);

  // Choisir puis annuler redonne exactement le tracé d'avant ; le tracé ne change qu'au choix.
  const store = createEditorStore(
    (_from, _to, options = {}) =>
      Promise.resolve(
        routeOf(options.alternativeIdx === 2 ? winding : current),
      ),
    trace,
    (gpx, options) => analyze(gpx, options),
  );
  await store.getState().searchVariants(0);
  const result = store.getState().variants;
  assert.equal(result?.kind, "done");
  if (result?.kind !== "done") return;
  assert.equal(result.variants.length, 1);
  assert.equal(store.getState().history.present, trace, "changé tout seul");
  store.getState().chooseVariant(result.variants[0]);
  assert.notEqual(store.getState().history.present, trace);
  assert.equal(store.getState().variants, null);
  assert.deepEqual(
    store.getState().history.present.segments[0].points,
    winding,
  );
  store.getState().undo();
  assert.equal(store.getState().history.present, trace);

  // Sur un aller-retour : refus clair, sans requête.
  const { road, back } = lollipop(1500);
  const router = fakeRouter(road, back);
  const roundTrip = createEditorStore(
    router.fetchRoute,
    traceOn(road, [0, road.length - 1]),
    (gpx, options) => analyze(gpx, options),
  );
  await roundTrip.getState().returnByRoad();
  const before = router.calls.length;
  await roundTrip.getState().searchVariants(0);
  assert.equal(router.calls.length, before);
  assert.equal(roundTrip.getState().variants, null);
  assert.match(roundTrip.getState().notice ?? "", /Retire d'abord le retour/);
};

export default async function editorElementsCheck(): Promise<void> {
  await checkRoundabouts();
  await checkRoundTripGestures();
  checkAutoChicanes();
  checkChicaneEdits();
  await checkSettle();
  await checkVariants();
}
