// Du tracé de l'éditeur à la spéciale du jeu, sans réseau ni navigateur (stories 3.2 et 3.4).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clearDraft,
  parseTrace,
  readDraftStage,
  writeDraftStage,
  type DraftStorage,
} from "../../src/editor/draft";
import { nearestIndex, nearestOnTrace } from "../../src/editor/hover";
import {
  axisIndex,
  createEditorStore,
  rollBlocker,
  stageGpx,
} from "../../src/editor/store";
import { EMPTY_TRACE, type EditorTrace } from "../../src/editor/types";
import {
  CUSTOM_MAP_ID,
  customMap,
  customStageUrl,
  mapFromParam,
  mapSearch,
} from "../../src/game/maps";
import {
  deleteStoredStage,
  listStoredStages,
  readCachedStage,
  readCustomStage,
  stageCacheKey,
  storeCustomStage,
} from "../../src/game/stageCache";
import { loadStage } from "../../src/game/useStageImport";
import type { BRouterRoute, FetchRoute } from "../../src/geo/brouter";
import { STEP } from "../../src/geo/config";
import { parseGpx, traceFromGpx, type LatLon } from "../../src/geo/gpx";
import { buildStage, type StageInputs } from "../../src/geo/pipeline";
import { parsePlaceName } from "../../src/geo/placeName";
import { stageHash } from "../../src/geo/stageHash";
import type { StageData } from "../../src/sim/types";

const loadInputs = (id: string): StageInputs =>
  JSON.parse(
    readFileSync(join("fixtures", "stages", `${id}.inputs.json`), "utf8"),
  ) as StageInputs;

/** Un seul segment reprenant les points du GPX : ce que l'éditeur aurait tracé. */
const traceOf = (points: LatLon[]): EditorTrace => ({
  ...EMPTY_TRACE,
  anchors: [
    { id: "a1", position: points[0] },
    { id: "a2", position: points[points.length - 1] },
  ],
  segments: [
    {
      fromAnchorId: "a1",
      toAnchorId: "a2",
      points,
      ways: [{ fromIndex: 0 }],
      length: 0,
    },
  ],
});

// --- Même tracé, même empreinte que l'import du même GPX ---

const checkSameFingerprint = (id: string): StageInputs => {
  const inputs = loadInputs(id);
  const gpx = stageGpx(traceOf(parseGpx(inputs.gpx)));
  assert.deepEqual(
    traceFromGpx(gpx).points,
    traceFromGpx(inputs.gpx).points,
    `${id} : l'axe du GPX de l'éditeur diffère de celui du fichier`,
  );
  // Le terrain ne dépend que de l'axe et des altitudes, et il coûte l'essentiel du temps : testé une fois, sur `road`.
  const withTerrain = id === "road" ? inputs : { ...inputs, terrain: null };
  assert.equal(
    stageHash(buildStage({ ...withTerrain, gpx }, "Depuis l'éditeur")),
    stageHash(buildStage(withTerrain, "Import du GPX")),
    `${id} : l'empreinte dépend de la voie d'entrée`,
  );
  return inputs;
};

const checkNameOutOfKey = (points: LatLon[]): void => {
  const trace = traceOf(points);
  const named = { ...trace, name: "Col de Turini" };
  const renamed = { ...trace, name: "Autre nom" };
  assert.equal(
    stageCacheKey(stageGpx(named)),
    stageCacheKey(stageGpx(renamed)),
    "renommer une spéciale ne doit pas relancer la génération",
  );
};

// --- Cache : un IndexedDB minimal, en mémoire, qui recopie comme le vrai ---

const installFakeIndexedDb = (): Map<IDBValidKey, unknown> => {
  const data = new Map<IDBValidKey, unknown>();
  const objectStore = {
    get: (key: IDBValidKey) => {
      const request = {
        result: structuredClone(data.get(key)),
        onsuccess: null as (() => void) | null,
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
    put: (value: unknown, key: IDBValidKey) => {
      data.set(key, structuredClone(value));
    },
    delete: (key: IDBValidKey) => {
      data.delete(key);
    },
    getAllKeys: () => {
      const request = {
        result: [...data.keys()],
        onsuccess: null as (() => void) | null,
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  const db = {
    transaction: () => {
      const transaction = {
        objectStore: () => objectStore,
        oncomplete: null as (() => void) | null,
      };
      queueMicrotask(() => transaction.oncomplete?.());
      return transaction;
    },
    close: () => {},
  };
  (globalThis as { indexedDB?: unknown }).indexedDB = {
    open: () => {
      const request = {
        result: db,
        onsuccess: null as (() => void) | null,
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  return data;
};

const quietly = async <T>(run: () => Promise<T>): Promise<T> => {
  const { warn, info } = console;
  console.warn = () => {};
  console.info = () => {};
  try {
    return await run();
  } finally {
    console.warn = warn;
    console.info = info;
  }
};

const checkCache = async (inputs: StageInputs): Promise<void> => {
  const stage = buildStage({ ...inputs, terrain: null }, "Spéciale");
  stage.hash = stageHash(stage);
  const gpx = inputs.gpx;
  const key = stageCacheKey(gpx);

  // Aucun IndexedDB, puis une clé absente ou illisible : `null`, jamais une erreur.
  assert.equal(await quietly(() => readCustomStage(key)), null);
  const data = installFakeIndexedDb();
  assert.equal(await readCustomStage("absente"), null);
  data.set("texte", "pas une spéciale");
  assert.equal(await readCustomStage("texte"), null);
  data.set("cassée", { ...stage, points: "rien" });
  assert.equal(await quietly(() => readCustomStage("cassée")), null);
  data.set("périmée", { ...stage, pipelineVersion: -1 });
  // Une ancienne version se rejoue sur demande, sans jamais resservir pour une nouvelle génération.
  assert.equal((await readCustomStage("périmée"))?.stage.hash, stage.hash);
  assert.equal(await readCachedStage("périmée"), null);

  // La liste montre les spéciales, la plus récente d'abord, et la suppression n'en retire qu'une.
  data.set("récente", { ...stage, generatedAt: "2099-01-01T00:00:00.000Z" });
  const listed = await listStoredStages();
  assert.deepEqual(
    listed?.map(({ key, outdated }) => [key, outdated]),
    [
      ["récente", false],
      ["cassée", false],
      ["périmée", true],
    ],
  );
  assert.equal(listed?.[0].length, stage.finishS - stage.startS);
  assert.equal(await deleteStoredStage("récente"), true);
  assert.equal(data.has("récente"), false);
  assert.equal(data.has("périmée"), true);

  // Une spéciale complète se reprend pour le même tracé.
  const fullKey = await storeCustomStage(gpx, { stage, warnings: [] });
  assert.equal(fullKey, key);
  const full = await readCustomStage(key);
  assert.equal(full?.stage.hash, stage.hash);
  assert.deepEqual(full?.warnings, []);
  data.clear();

  // Une spéciale dégradée se rejoue depuis son URL, avec son avertissement, mais n'est pas reprise pour une nouvelle génération (2.7).
  const warnings = ["Les données de routes sont indisponibles."];
  const degradedKey = await storeCustomStage(gpx, { stage, warnings });
  assert.ok(degradedKey);
  assert.notEqual(degradedKey, key);
  assert.equal(await readCachedStage(key), null);
  const degraded = await readCustomStage(degradedKey);
  assert.equal(degraded?.stage.hash, stage.hash);
  assert.deepEqual(degraded?.warnings, warnings);

  // Le tracé voyage avec la spéciale : c'est lui que « Modifier » rouvre.
  const edited = traceOf(parseGpx(gpx));
  const editedKey = await storeCustomStage(
    gpx,
    { stage, warnings: [] },
    edited,
  );
  const stored = (await listStoredStages())?.find(
    (found) => found.key === editedKey,
  );
  assert.deepEqual(parseTrace(stored?.trace), edited);
  assert.equal(parseTrace({ anchors: "rien" }), null);
  assert.equal((await readCustomStage(key))?.stage.hash, stage.hash);

  // Le lien entre le brouillon et sa spéciale, effacé avec le brouillon.
  const values = new Map<string, string>();
  const storage: DraftStorage = {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
  };
  assert.equal(readDraftStage(storage), null);
  writeDraftStage("clé", storage);
  assert.equal(readDraftStage(storage), "clé");
  clearDraft(storage);
  assert.equal(readDraftStage(storage), null);

  // Rouvrir un tracé déjà généré ne démarre aucun Worker, et le nom suit la demande.
  await storeCustomStage(gpx, { stage, warnings: [] });
  const reopened = await quietly(() =>
    loadStage(
      { name: "Nouveau nom", read: () => Promise.resolve(gpx) },
      new AbortController().signal,
      () => assert.fail("rouvrir ne doit lancer aucune génération"),
    ),
  );
  assert.equal(reopened.stage.name, "Nouveau nom");
  assert.equal(reopened.stage.hash, stage.hash);
  assert.equal(reopened.gpx, gpx);

  delete (globalThis as { indexedDB?: unknown }).indexedDB;
};

// --- Cartes du jeu ---

const checkCustomMap = (stage: StageData): void => {
  assert.equal(mapFromParam(CUSTOM_MAP_ID).id, "track", "sans spéciale relue");
  const map = customMap({ stage, warnings: ["Dégradée"] });
  assert.equal(map.id, CUSTOM_MAP_ID);
  assert.equal(map.label, stage.name);
  assert.equal(map.bestLapKey, `rally:best-lap-ms:${stage.hash}`);
  assert.deepEqual(map.custom?.warnings, ["Dégradée"]);
  // Le circuit et les cartes livrées ne changent pas.
  assert.equal(mapFromParam("road").stageUrl, "/stages/road.json");
  assert.equal(
    mapFromParam("mountain").bestLapKey,
    "rally:best-lap-ms:mountain",
  );
  assert.equal(mapFromParam(null).bestLapKey, "rally:best-lap-ms");

  const url = new URL(customStageUrl("ab12:3:degraded"), "http://localhost");
  assert.equal(url.searchParams.get("map"), CUSTOM_MAP_ID);
  assert.equal(url.searchParams.get("stage"), "ab12:3:degraded");

  const scope = globalThis as { window?: unknown };
  scope.window = { location: { search: "?map=custom&stage=x&debug" } };
  assert.equal(mapSearch("road"), "?map=road&debug=");
  delete scope.window;
};

// --- Le store : gestes, historique, brouillon ---

const ROUTE: BRouterRoute = {
  points: [
    { lat: 44, lon: 7 },
    { lat: 44.01, lon: 7 },
  ],
  ways: [{ fromIndex: 0 }],
  length: 1000,
};

const checkStore = async (): Promise<void> => {
  const storage = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  };

  const release: (() => void)[] = [];
  let calls = 0;
  const fetchRoute: FetchRoute = (from, to) => {
    calls++;
    return new Promise((resolve) =>
      release.push(() =>
        resolve({
          ...ROUTE,
          points:
            from.lat === to.lat && from.lon === to.lon ? [from] : [from, to],
        }),
      ),
    );
  };
  const store = createEditorStore(fetchRoute, { ...EMPTY_TRACE });
  const state = () => store.getState();
  const flush = async (): Promise<void> => {
    while (release.length) release.shift()?.();
    await new Promise((resolve) => setImmediate(resolve));
  };

  // Deux clics rapides : le second est refusé et le dit, le premier point n'est pas perdu.
  const first = state().addPoint({ lat: 44, lon: 7 });
  await state().addPoint({ lat: 44.01, lon: 7 });
  assert.equal(calls, 1, "le second clic ne part pas au réseau");
  assert.ok(state().notice, "le clic refusé est signalé");
  await flush();
  await first;
  assert.equal(state().history.present.anchors.length, 1);
  assert.equal(state().notice, null);

  const second = state().addPoint({ lat: 44.01, lon: 7 });
  await flush();
  await second;
  assert.equal(state().history.present.segments.length, 1);
  const saved = JSON.parse(
    storage.get("rally-editor-draft") ?? "{}",
  ) as EditorTrace;
  assert.equal(
    saved.anchors.length,
    2,
    "le brouillon suit chaque geste validé",
  );

  // Le nom reste à part : annuler ne le change pas, le brouillon le garde.
  state().setName("Turini");
  const withTwo = state().history.present;
  state().undo();
  assert.equal(state().history.present.anchors.length, 1);
  assert.equal(state().name, "Turini");
  assert.equal(
    (JSON.parse(storage.get("rally-editor-draft") ?? "{}") as EditorTrace).name,
    "Turini",
  );
  state().redo();
  assert.equal(state().history.present, withTwo);

  // Annuler pendant un calcul coupe la requête : sa réponse n'écrase rien.
  const late = state().addPoint({ lat: 44.02, lon: 7 });
  assert.ok(state().status.pending);
  state().undo();
  assert.equal(state().status.pending, false);
  await flush();
  await late;
  assert.equal(state().history.present.anchors.length, 1);
  state().redo();

  // Tout vider efface le brouillon, Ctrl+Z rend le tracé.
  state().clear();
  assert.equal(state().history.present.anchors.length, 0);
  assert.equal(storage.has("rally-editor-draft"), false);
  state().undo();
  assert.equal(state().history.present, withTwo);

  // Pourquoi « Rouler » est désactivé.
  assert.equal(
    rollBlocker({ ...state(), analysis: { axis: null, issues: [] } }),
    null,
  );
  store.setState({ analyzing: true });
  assert.match(rollBlocker(state()) ?? "", /Vérification/);
  store.setState({
    analyzing: false,
    issues: [
      {
        code: "outOfFrance",
        message: "Hors de France",
        s: 0,
        position: null,
        blocking: true,
      },
    ],
  });
  assert.equal(rollBlocker(state()), "Hors de France");
  store.setState({
    issues: [
      {
        code: "widened",
        message: "Écart",
        s: 0,
        position: null,
        blocking: false,
      },
    ],
    analysis: { axis: null, issues: [] },
  });
  assert.equal(
    rollBlocker(state()),
    null,
    "un écart signalé n'empêche pas de rouler",
  );
  store.setState({
    history: { past: [], present: { ...EMPTY_TRACE }, future: [] },
  });
  assert.match(rollBlocker(state()) ?? "", /deux points/);

  delete (globalThis as { localStorage?: unknown }).localStorage;
};

// --- Survol ---

const checkHover = (): void => {
  const a = { lat: 0, lon: 0 };
  const b = { lat: 0, lon: 100 };
  const c = { lat: 100, lon: 100 };
  const segments = [
    { fromAnchorId: "a", toAnchorId: "b", points: [a, b], ways: [], length: 0 },
    { fromAnchorId: "b", toAnchorId: "c", points: [b, c], ways: [], length: 0 },
  ];
  const toScreen = ({ lat, lon }: LatLon) => ({ x: lon, y: lat });
  const onFirst = nearestOnTrace(segments, { x: 50, y: 3 }, toScreen, 10);
  assert.equal(onFirst?.segmentIndex, 0);
  assert.deepEqual(onFirst?.position, { lat: 0, lon: 50 });
  assert.equal(onFirst?.pixels, 3);
  assert.equal(
    nearestOnTrace(segments, { x: 98, y: 50 }, toScreen, 10)?.segmentIndex,
    1,
  );
  assert.equal(nearestOnTrace(segments, { x: 50, y: 50 }, toScreen, 10), null);

  assert.equal(nearestIndex([a, b, c], { lat: 90, lon: 100 }), 2);
  assert.equal(axisIndex(-5, 10), 0);
  assert.equal(axisIndex(5 * STEP, 10), 5);
  assert.equal(axisIndex(1000 * STEP, 10), 9);
};

const checkPlaceName = (): void => {
  assert.equal(
    parsePlaceName(
      '{"features":[{"properties":{"city":"La Bollène-Vésubie"}}]}',
    ),
    "La Bollène-Vésubie",
  );
  assert.equal(parsePlaceName('{"features":[]}'), null);
  assert.equal(parsePlaceName("pas du json"), null);
};

export default async function check(): Promise<void> {
  const road = checkSameFingerprint("road");
  checkSameFingerprint("mountain");
  checkNameOutOfKey(parseGpx(road.gpx));
  await checkCache(road);

  const stage = buildStage({ ...road, terrain: null }, "Spéciale");
  stage.hash = stageHash(stage);
  checkCustomMap(stage);

  await checkStore();
  checkHover();
  checkPlaceName();
}
