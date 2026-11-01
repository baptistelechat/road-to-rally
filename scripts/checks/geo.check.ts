import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  IGN_BATCH_SIZE,
  MAX_SLOPE,
  MAX_WIDTH,
  MIN_RADIUS,
  MIN_VERTICAL_RADIUS,
  MIN_WIDTH,
  OVERPASS_RETRY_DELAY,
  STEP,
} from "../../src/geo/config";
import { StageError, type StageErrorCode } from "../../src/geo/errors";
import {
  minPlanRadius,
  parseGpx,
  project,
  traceFromGpx,
  type PlanePoint,
} from "../../src/geo/gpx";
import { assertCovered, fetchAltitudes } from "../../src/geo/ign";
import {
  deduceRoadAttributes,
  parseOverpass,
  parseWidthTag,
  widthFromTags,
  type OsmWay,
} from "../../src/geo/osm";
import {
  PIPELINE_VERSION,
  axisHash,
  buildStage,
  fetchStageInputs,
  type StageInputs,
  type StageStep,
} from "../../src/geo/pipeline";
import { buildProfile } from "../../src/geo/profile";
import { stageToJson } from "../../src/sim/track/stageCodec";
import type { StageData } from "../../src/sim/types";

const fixtures = join("fixtures", "stages");
const IDS = ["mountain", "road"] as const;

/** Seuil retenu sur la fixture de Turini : quelques pixels aberrants du relief brut montent à 3,35 m, le reste suit. */
const PROFILE_MAX_DEVIATION = 3.5;
const TRACE_MAX_DEVIATION = 3;

const distanceToPolyline = (p: PlanePoint, line: PlanePoint[]): number => {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t =
      len2 > 0
        ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2))
        : 0;
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
  }
  return best;
};

const maxDeviation = (from: PlanePoint[], to: PlanePoint[]): number =>
  Math.max(...from.map((p) => distanceToPolyline(p, to)));

const assertStep = (points: PlanePoint[], label: string): void => {
  for (let i = 1; i < points.length; i++) {
    const step = Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].z - points[i - 1].z,
    );
    assert.ok(
      Math.abs(step - STEP) < STEP * 0.05,
      `${label} : pas de ${step} m au point ${i}`,
    );
  }
};

/** Virages qui tournent de plus de 150° sur moins de 80 m. */
const countHairpins = (points: PlanePoint[]): number => {
  const heading = (i: number): number =>
    Math.atan2(points[i + 1].z - points[i].z, points[i + 1].x - points[i].x);
  let count = 0;
  for (let i = 0; i + 40 < points.length - 1; ) {
    let turn = 0;
    let end = i;
    for (; end < i + 40; end++) {
      let d = heading(end + 1) - heading(end);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      turn += d;
      if (Math.abs(turn) > (150 * Math.PI) / 180) break;
    }
    if (end < i + 40) {
      count++;
      i = end + 20;
    } else i++;
  }
  return count;
};

/** GPX synthétique à partir de points en mètres autour d'un point des Landes. */
const toGpx = (points: PlanePoint[]): string => {
  const origin = { lat: 44.2, lon: -0.8 };
  const scale = project({ lat: 44.2, lon: -0.799 }, origin).x / 0.001;
  const trkpts = points.map(
    (p) =>
      `<trkpt lat="${(origin.lat - p.z / 111320).toFixed(7)}" lon="${(origin.lon + p.x / scale).toFixed(7)}"><ele>12</ele></trkpt>`,
  );
  return `<gpx><trk><trkseg>${trkpts.join("\n")}</trkseg></trk></gpx>`;
};

const straight = (length: number, spacing = 25): PlanePoint[] =>
  Array.from({ length: Math.round(length / spacing) + 1 }, (_, i) => ({
    x: i * spacing,
    z: 0,
  }));

/** Aller, demi-tour, retour à `gap` mètres de l'aller. */
const uTurn = (length: number, gap: number): PlanePoint[] => {
  const out = straight(length);
  const arc = Array.from({ length: 7 }, (_, i) => {
    const angle = (i * Math.PI) / 6;
    return {
      x: length + 3 + (gap / 2) * Math.sin(angle),
      z: gap / 2 - (gap / 2) * Math.cos(angle),
    };
  });
  return [
    ...out,
    ...arc,
    ...[...out].reverse().map((p) => ({ x: p.x, z: gap })),
  ];
};

const assertRefused = (
  action: () => unknown,
  code: StageErrorCode,
  message?: RegExp,
): void =>
  assert.throws(action, (error: unknown) => {
    assert.ok(
      error instanceof StageError,
      `attendu StageError : ${String(error)}`,
    );
    assert.equal(error.code, code);
    assert.ok(error.message.length > 10);
    if (message) assert.match(error.message, message);
    return true;
  });

const assertRejected = async (
  action: () => Promise<unknown>,
  code: StageErrorCode,
): Promise<void> =>
  assert.rejects(action, (error: unknown) => {
    assert.ok(
      error instanceof StageError,
      `attendu StageError : ${String(error)}`,
    );
    assert.equal(error.code, code);
    return true;
  });

const ignResponse = (count: number, altitude = 100): Response =>
  new Response(JSON.stringify({ elevations: new Array(count).fill(altitude) }));

const pointCount = (init: RequestInit | undefined): number =>
  (JSON.parse(String(init?.body)) as { lon: string }).lon.split("|").length;

const instantSleep = async (): Promise<void> => {};

const checkFixtures = (): void => {
  for (const id of IDS) {
    const gpx = readFileSync(join(fixtures, `${id}.gpx`), "utf8");
    const inputs = JSON.parse(
      readFileSync(join(fixtures, `${id}.inputs.json`), "utf8"),
    ) as StageInputs;
    const committed = readFileSync(
      join("public", "stages", `${id}.json`),
      "utf8",
    );
    const baked = JSON.parse(committed) as StageData;

    // Axe.
    const trace = traceFromGpx(gpx);
    assertStep(trace.points, id);
    assert.ok(
      minPlanRadius(trace.points) >= MIN_RADIUS,
      `${id} : rayon trop petit`,
    );
    assert.ok(
      trace.length > 4500 && trace.length < 6000,
      `${id} : ${trace.length} m`,
    );
    // Le surplus au-delà des lignes est de la vraie route : il colle au GPX comme le reste.
    const axis = trace.points;
    const original = parseGpx(gpx).map((p) => project(p, trace.origin));
    const deviation = Math.max(
      maxDeviation(original, axis),
      maxDeviation(axis, original),
    );
    assert.ok(
      deviation < TRACE_MAX_DEVIATION,
      `${id} : écart de ${deviation} m`,
    );

    // Spéciale : `buildStage` retrouve exactement le JSON committé, deux fois de suite.
    // L'empreinte, ajoutée à la cuisson, se vérifie dans fingerprint.check.ts.
    const rebuilt = (): string =>
      JSON.stringify(
        stageToJson({ ...buildStage(inputs, baked.name), hash: baked.hash }),
      );
    assert.equal(rebuilt(), rebuilt());
    assert.equal(rebuilt(), committed, `${id} : public/stages à recuire`);

    const { points, widths, startS, finishS, baseAltitude } = baked;
    assert.equal(baked.pipelineVersion, PIPELINE_VERSION);
    assert.ok(baked.terrain);
    assert.equal(widths.length, points.length);
    assert.equal(inputs.altitudes.length, points.length);
    assert.equal(Math.min(...points.map((p) => p.y)), 0);

    // Les fixtures portent 250 m de vraie route au-delà des lignes, aux bonnes abscisses à la pente près.
    const run = trace.runoffPoints;
    assert.equal(trace.realRunoff, true);
    assert.equal(run * STEP, 250);
    assert.ok(startS >= 250 && startS < 257, `${id} : startS ${startS}`);
    assert.ok(
      Math.abs(finishS - startS - trace.length) < trace.length * 0.03,
      `${id} : finishS ${finishS}`,
    );
    // Sans ce marquage, le même GPX reçoit un prolongement en ligne droite.
    const plain = traceFromGpx(inputs.gpx.replace(/<desc>.*<\/desc>/, ""));
    assert.equal(plain.realRunoff, false);
    assert.ok(
      distanceToPolyline(plain.points[plain.runoffPoints - 5], [
        plain.points[0],
        plain.points[plain.runoffPoints],
      ]) < 0.01,
    );

    // Profil : limites respectées, et fidèle au relief hors ouvrages.
    const { structures } = deduceRoadAttributes(trace, inputs.ways);
    let worstDeviation = 0;
    for (let i = 0; i < points.length; i++) {
      assert.ok(points[i].y >= 0);
      // Le prolongement n'existe pas en vrai : seule la route réelle doit coller au relief.
      if (!structures[i] && i >= run && i < points.length - run)
        worstDeviation = Math.max(
          worstDeviation,
          Math.abs(points[i].y + baseAltitude - inputs.altitudes[i]),
        );
      if (i === 0) continue;
      const run3d = Math.hypot(
        points[i].x - points[i - 1].x,
        points[i].z - points[i - 1].z,
      );
      const rise = Math.abs(points[i].y - points[i - 1].y);
      assert.ok(
        rise / run3d <= MAX_SLOPE,
        `${id} : pente ${rise / run3d} au point ${i}`,
      );
      const step3d = Math.hypot(run3d, rise);
      assert.ok(Math.abs(step3d - STEP) < STEP * 0.05, `${id} : pas ${step3d}`);
      if (i + 1 < points.length) {
        const bend = points[i - 1].y - 2 * points[i].y + points[i + 1].y;
        assert.ok(
          Math.abs(bend) === 0 ||
            (STEP * STEP) / Math.abs(bend) >= MIN_VERTICAL_RADIUS,
          `${id} : rayon vertical ${(STEP * STEP) / Math.abs(bend)} au point ${i}`,
        );
      }
    }
    assert.ok(
      worstDeviation < PROFILE_MAX_DEVIATION,
      `${id} : ${worstDeviation} m du relief IGN`,
    );
    const net = points[points.length - 1].y - points[0].y;
    const rawNet =
      inputs.altitudes[inputs.altitudes.length - 1] - inputs.altitudes[0];
    assert.ok(
      Math.abs(net - rawNet) < 4,
      `${id} : dénivelé ${net} contre ${rawNet}`,
    );

    // Largeur : bornes respectées, sans marche.
    for (let i = 0; i < widths.length; i++) {
      assert.ok(widths[i] >= MIN_WIDTH && widths[i] <= MAX_WIDTH);
      if (i > 0) assert.ok(Math.abs(widths[i] - widths[i - 1]) < 0.3);
    }

    // Un axe modifié rend le cache caduc, sans échec silencieux.
    assert.throws(
      () => buildStage({ ...inputs, axisHash: "00000000" }, baked.name),
      /--refresh/,
    );
    assertRefused(
      () =>
        buildStage(
          {
            ...inputs,
            altitudes: inputs.altitudes.map((z, i) =>
              i === run + 80 ? -99999 : z,
            ),
          },
          baked.name,
        ),
      "outOfFrance",
      /km 0,16/,
    );
  }

  // Sur Turini, chaque épingle reste une épingle.
  const gpx = readFileSync(join(fixtures, "mountain.gpx"), "utf8");
  const trace = traceFromGpx(gpx);
  const hairpins = countHairpins(trace.points);
  assert.ok(hairpins >= 5, `seulement ${hairpins} épingles`);
};

const checkRefusals = (): void => {
  assertRefused(() => traceFromGpx(""), "empty");
  assertRefused(() => traceFromGpx("<gpx><trk></trk></gpx>"), "empty");
  assertRefused(() => traceFromGpx(toGpx([{ x: 0, z: 0 }])), "empty");
  assertRefused(() => traceFromGpx(toGpx(straight(1200))), "tooShort");
  assertRefused(() => traceFromGpx(toGpx(straight(1975))), "tooShort");
  assert.ok(traceFromGpx(toGpx(straight(2025))).length > 2000);
  assertRefused(() => traceFromGpx(toGpx(straight(15100))), "tooLong");
  assertRefused(() => traceFromGpx(toGpx(straight(120000, 100))), "tooLong");

  // Un huit : le tracé se recoupe à angle droit.
  const eight: PlanePoint[] = [
    ...straight(3000),
    { x: 3050, z: -60 },
    { x: 3000, z: -120 },
    { x: 2950, z: -60 },
    { x: 2950, z: 0 },
    { x: 2950, z: 60 },
    { x: 2950, z: 500 },
  ];
  assertRefused(
    () => traceFromGpx(toGpx(eight)),
    "selfCrossing",
    /km 2,\d+.*km 3,\d+/,
  );
  // Aller-retour sur la même route.
  assertRefused(() => traceFromGpx(toGpx(uTurn(2000, 0))), "selfCrossing");
};

const checkNoisyTraces = (): void => {
  const road = (x: number): PlanePoint => ({
    x,
    z: 120 * Math.sin(x / 300) + 40 * Math.sin(x / 70),
  });
  const clean = Array.from({ length: 1601 }, (_, i) => road(i * 2.5));

  // Montre bruitée : un point tous les 5 m, à 1,5 m près environ. Générateur à graine, jamais `Math.random`.
  let seed = 12345;
  const noise = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 2 ** 32 - 0.5) * 3;
  };
  const noisy = Array.from({ length: 801 }, (_, i) => {
    const p = road(i * 5);
    return { x: p.x + noise(), z: p.z + noise() };
  });
  const gpx = toGpx(noisy);
  const trace = traceFromGpx(gpx);
  assertStep(trace.points, "GPX bruité");
  assert.ok(minPlanRadius(trace.points) >= MIN_RADIUS);
  assert.ok(
    maxDeviation(
      trace.points.slice(trace.runoffPoints, -trace.runoffPoints),
      clean,
    ) < 6,
  );
  assert.equal(
    JSON.stringify(trace),
    JSON.stringify(traceFromGpx(gpx)),
    "même fichier, même axe",
  );

  // Espacement très variable, comme un GPX issu d'OSM : Catmull-Rom ne déborde pas.
  const sparse = clean.filter((_, i) => i % 60 < 3 || i % 240 === 100);
  const fromSparse = traceFromGpx(toGpx(sparse));
  assertStep(fromSparse.points, "GPX irrégulier");
  assert.ok(minPlanRadius(fromSparse.points) >= MIN_RADIUS);
  assert.ok(
    maxDeviation(
      fromSparse.points.slice(
        fromSparse.runoffPoints,
        -fromSparse.runoffPoints,
      ),
      sparse,
    ) < 3,
  );

  // Le rayon minimal se paramètre.
  const mountain = readFileSync(join(fixtures, "mountain.gpx"), "utf8");
  assert.ok(minPlanRadius(traceFromGpx(mountain, 10).points) >= 10);
};

const checkProfile = (): void => {
  const flat = new Array<boolean>(400).fill(false);

  // Une valeur aberrante isolée disparaît.
  const spike = new Array<number>(400).fill(100);
  spike[200] = 180;
  assert.ok(Math.max(...buildProfile(spike, flat)) < 100.01);

  // Une falaise reste sous les deux limites.
  const cliff = buildProfile(
    Array.from({ length: 400 }, (_, i) => (i < 200 ? 100 : 160)),
    flat,
  );
  for (let i = 1; i < cliff.length; i++)
    assert.ok(Math.abs(cliff[i] - cliff[i - 1]) / STEP <= MAX_SLOPE);
  for (let i = 1; i + 1 < cliff.length; i++)
    assert.ok(
      Math.abs(cliff[i - 1] - 2 * cliff[i] + cliff[i + 1]) <=
        (STEP * STEP) / MIN_VERTICAL_RADIUS,
    );

  // Un pont franchit le ravin à l'altitude de ses extrémités, dans le terrain en dessous.
  const ravine = Array.from({ length: 400 }, (_, i) =>
    i >= 180 && i < 220 ? 70 : 100,
  );
  const structures = ravine.map((z) => z === 70);
  const bridged = buildProfile(ravine, structures);
  assert.ok(Math.min(...bridged) > 99.9);
  assert.ok(Math.min(...buildProfile(ravine, flat)) < 80);

  assert.doesNotThrow(() => assertCovered([100, 200], 0));
  assertRefused(() => assertCovered([100, -99999], 0), "outOfFrance");
};

const way = (
  id: number,
  tags: Record<string, string>,
  points: PlanePoint[],
): OsmWay => {
  const origin = { lat: 44.2, lon: -0.8 };
  const scale = project({ lat: 44.2, lon: -0.799 }, origin).x / 0.001;
  return {
    id,
    tags,
    geometry: points.map((p) => ({
      lat: origin.lat - p.z / 111320,
      lon: origin.lon + p.x / scale,
    })),
  };
};

const checkWidths = (): void => {
  // Valeurs de `width` : tout ce qui n'est pas lisible est ignoré.
  assert.equal(parseWidthTag("5"), 5);
  assert.equal(parseWidthTag("5 m"), 5);
  assert.equal(parseWidthTag("5m"), 5);
  assert.equal(parseWidthTag("3,5"), 3.5);
  assert.equal(parseWidthTag("3.5"), 3.5);
  for (const bad of ["narrow", "", "0", "5;6", "12 ft", "2'", "-3", "abc 4"])
    assert.equal(parseWidthTag(bad), null, bad);

  // Ordre : width, lanes, highway, défaut. Bornes.
  assert.equal(
    widthFromTags({ width: "4.2", lanes: "2", highway: "primary" }),
    4.2,
  );
  assert.equal(
    widthFromTags({ width: "narrow", lanes: "2", highway: "primary" }),
    6,
  );
  assert.equal(widthFromTags({ lanes: "x", highway: "primary" }), 7);
  // Une grande route n'est pas réduite à une voie, une petite route peut l'être.
  assert.equal(widthFromTags({ lanes: "1", highway: "primary" }), 7);
  assert.equal(widthFromTags({ lanes: "1", highway: "tertiary" }), 6);
  // À sens unique, le tag dit vrai : une seule voie.
  assert.equal(
    widthFromTags({ lanes: "1", highway: "primary", oneway: "yes" }),
    MIN_WIDTH,
  );
  assert.equal(
    widthFromTags({ lanes: "1", highway: "primary", oneway: "no" }),
    7,
  );
  assert.equal(
    widthFromTags({ lanes: "1", highway: "residential" }),
    MIN_WIDTH,
  );
  assert.equal(widthFromTags({ lanes: "1" }), MIN_WIDTH);
  assert.equal(widthFromTags({ highway: "inconnu" }), 5);
  assert.equal(widthFromTags({}), 5);
  assert.equal(widthFromTags({ width: "1" }), MIN_WIDTH);
  assert.equal(widthFromTags({ lanes: "6" }), MAX_WIDTH);

  const trace = traceFromGpx(toGpx(straight(3000)));
  const all = (widths: number[], value: number): boolean =>
    widths.every((w) => w === value);

  // Sans donnée, ou trop loin : 5 m partout.
  assert.ok(all(deduceRoadAttributes(trace, null).widths, 5));
  assert.ok(all(deduceRoadAttributes(trace, []).widths, 5));
  const far = way(1, { highway: "primary" }, [
    { x: -50, z: 20 },
    { x: 3100, z: 20 },
  ]);
  assert.ok(all(deduceRoadAttributes(trace, [far]).widths, 5));

  // Une voie sans tag ne bloque rien.
  const bare = way(2, {}, [
    { x: -50, z: 1 },
    { x: 3100, z: 1 },
  ]);
  assert.ok(all(deduceRoadAttributes(trace, [bare]).widths, 5));

  // La voie bien orientée passe devant une voie perpendiculaire plus proche.
  const parallel = way(3, { highway: "primary" }, [
    { x: -50, z: 8 },
    { x: 3100, z: 8 },
  ]);
  const side = way(4, { highway: "track", bridge: "yes" }, [
    { x: 1500, z: -500 },
    { x: 1500, z: 500 },
  ]);
  const crossed = deduceRoadAttributes(trace, [parallel, side]);
  assert.ok(all(crossed.widths, 7));
  assert.ok(!crossed.structures.some(Boolean));

  // La largeur s'étale sur des dizaines de mètres, jamais d'un coup.
  const narrow = way(5, { width: "3.5" }, [
    { x: -50, z: 0 },
    { x: 1500, z: 0 },
  ]);
  const wide = way(6, { width: "9" }, [
    { x: 1500, z: 0 },
    { x: 3100, z: 0 },
  ]);
  const { widths } = deduceRoadAttributes(trace, [narrow, wide]);
  assert.equal(widths[100], 3.5);
  assert.equal(widths[widths.length - 100], 9);
  let moving = 0;
  for (let i = 1; i < widths.length; i++) {
    const delta = Math.abs(widths[i] - widths[i - 1]);
    assert.ok(delta < 0.3);
    if (delta > 0) moving++;
  }
  assert.ok(moving * STEP >= 40, `transition sur ${moving * STEP} m`);

  // Pont : marqué sur toute sa longueur. Valeur `no` ignorée.
  const deck = way(7, { bridge: "yes" }, [
    { x: 1000, z: 0 },
    { x: 1100, z: 0 },
  ]);
  const notDeck = way(8, { bridge: "no" }, [
    { x: 2000, z: 0 },
    { x: 2100, z: 0 },
  ]);
  const flagged = deduceRoadAttributes(trace, [deck, notDeck]).structures;
  assert.ok(flagged[trace.runoffPoints + Math.round(1050 / STEP)]);
  assert.ok(!flagged[trace.runoffPoints + Math.round(2050 / STEP)]);

  // Réponse d'Overpass : forme inattendue écartée, réponse partielle refusée.
  assert.equal(parseOverpass("<html>"), null);
  assert.equal(parseOverpass('{"elements":[],"remark":"runtime error"}'), null);
  assert.deepEqual(
    parseOverpass(
      '{"elements":[{"type":"way"},{"id":1,"tags":{"highway":"service","name":"x"},"geometry":[{"lat":44,"lon":1},{"lat":44.1,"lon":1}]}]}',
    ),
    [
      {
        id: 1,
        tags: { highway: "service" },
        geometry: [
          { lat: 44, lon: 1 },
          { lat: 44.1, lon: 1 },
        ],
      },
    ],
  );

  // Deux chaussées qui se touchent sont refusées : branches à 8 m, route de 9 m.
  const gpx = toGpx(uTurn(2000, 8));
  const hairpin = traceFromGpx(gpx);
  const broad = way(9, { width: "9" }, [
    { x: -50, z: 0 },
    { x: 2100, z: 0 },
  ]);
  const broadBack = way(10, { width: "9" }, [
    { x: -50, z: 8 },
    { x: 2100, z: 8 },
  ]);
  const inputs: StageInputs = {
    gpx,
    axisHash: axisHash(hairpin),
    altitudes: hairpin.points.map(() => 50),
    ways: [broad, broadBack],
    terrain: null,
    generatedAt: "2026-11-01T00:00:00.000Z",
  };
  assertRefused(() => buildStage(inputs, "Test"), "roadContact", /km/);
  assert.doesNotThrow(() => buildStage({ ...inputs, ways: null }, "Test"));
};

const checkNetwork = async (): Promise<void> => {
  // Découpage à 5000 points, une requête à la fois, ordre conservé.
  const manyPoints = Array.from({ length: 7520 }, (_, i) => ({
    lat: 44,
    lon: 1 + i / 1e6,
  }));
  const sizes: number[] = [];
  let inFlight = 0;
  const altitudes = await fetchAltitudes(manyPoints, {
    fetch: async (_url, init) => {
      inFlight++;
      assert.equal(inFlight, 1, "requêtes en parallèle");
      const body = JSON.parse(String(init?.body)) as {
        zonly: unknown;
        resource: unknown;
      };
      assert.equal(body.zonly, "true");
      assert.equal(body.resource, "ign_rge_alti_wld");
      const count = pointCount(init);
      sizes.push(count);
      await instantSleep();
      inFlight--;
      return new Response(
        JSON.stringify({
          elevations: Array.from(
            { length: count },
            (_, i) => (sizes.length - 1) * IGN_BATCH_SIZE + i,
          ),
        }),
      );
    },
  });
  assert.deepEqual(sizes, [5000, 2520]);
  assert.deepEqual(
    altitudes,
    Array.from({ length: 7520 }, (_, i) => i),
  );

  // Reprise après 429, erreur serveur ou réseau, avec une attente croissante.
  const delays: number[] = [];
  const answers: (() => Response)[] = [
    () => new Response("", { status: 429 }),
    () => {
      throw new TypeError("fetch failed");
    },
    () => new Response("", { status: 503 }),
    () => ignResponse(2),
  ];
  const resumed = await fetchAltitudes(manyPoints.slice(0, 2), {
    fetch: async () => {
      const answer = answers.shift();
      assert.ok(answer, "trop de requêtes");
      return answer();
    },
    sleep: async (ms) => {
      delays.push(ms);
    },
  });
  assert.deepEqual(resumed, [100, 100]);
  assert.deepEqual(delays, [1000, 2000, 4000]);

  // Échec définitif : le code dit de quoi il s'agit.
  await assertRejected(
    () =>
      fetchAltitudes(manyPoints.slice(0, 2), {
        fetch: async () => new Response("", { status: 429 }),
        sleep: instantSleep,
      }),
    "service",
  );
  await assertRejected(
    () =>
      fetchAltitudes(manyPoints.slice(0, 2), {
        fetch: async () => {
          throw new TypeError("fetch failed");
        },
        sleep: instantSleep,
      }),
    "network",
  );
  let attempts = 0;
  await assertRejected(
    () =>
      fetchAltitudes(manyPoints.slice(0, 2), {
        fetch: async () => {
          attempts++;
          return new Response("", { status: 400 });
        },
        sleep: instantSleep,
      }),
    "service",
  );
  assert.equal(attempts, 1, "une erreur 400 ne se reprend pas");
  await assertRejected(
    () =>
      fetchAltitudes(manyPoints.slice(0, 2), {
        fetch: async () => new Response('{"elevations":[1]}'),
      }),
    "service",
  );

  // Enchaînement complet, tout en mémoire.
  const gpx = toGpx(straight(3000));
  const steps: StageStep[] = [];
  const overpassCalls: number[] = [];
  const offlineFetch: typeof fetch = async (url, init) => {
    if (String(url).includes("overpass")) {
      overpassCalls.push(1);
      return new Response("", { status: 406 });
    }
    return ignResponse(pointCount(init), 40);
  };
  const waits: number[] = [];
  const { inputs, warnings } = await fetchStageInputs(gpx, {
    fetch: offlineFetch,
    sleep: async (ms) => {
      waits.push(ms);
    },
    onProgress: (step) => steps.push(step),
  });
  assert.deepEqual(steps, [
    "lecture",
    "relief",
    "routes",
    "terrain",
    "finalisation",
  ]);
  // Overpass indisponible : attente de 30 s, une seule reprise, puis on continue avec 5 m et un avertissement.
  assert.equal(overpassCalls.length, 2);
  assert.deepEqual(waits, [OVERPASS_RETRY_DELAY]);
  assert.equal(inputs.ways, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /5 m/);
  const stage = buildStage(inputs, "Test");
  assert.ok(stage.widths.every((w) => w === 5));
  assert.ok(stage.points.every((p) => p.y === 0));
  assert.equal(stage.baseAltitude, 40);

  // Hors de France : arrêt avant d'interroger Overpass.
  let overpassAfterRefusal = 0;
  await assertRejected(
    () =>
      fetchStageInputs(gpx, {
        fetch: async (url, init) => {
          if (String(url).includes("overpass")) overpassAfterRefusal++;
          return ignResponse(pointCount(init), -99999);
        },
      }),
    "outOfFrance",
  );
  assert.equal(overpassAfterRefusal, 0);

  // Annulation : avant le départ, et pendant une attente de reprise.
  await assertRejected(
    () =>
      fetchStageInputs(gpx, {
        signal: AbortSignal.abort(),
        fetch: offlineFetch,
      }),
    "aborted",
  );
  const controller = new AbortController();
  await assertRejected(
    () =>
      fetchStageInputs(gpx, {
        signal: controller.signal,
        fetch: async () => {
          controller.abort();
          throw new DOMException("Aborted", "AbortError");
        },
      }),
    "aborted",
  );
  // Une annulation pendant Overpass ne se déguise pas en simple avertissement.
  const late = new AbortController();
  await assertRejected(
    () =>
      fetchStageInputs(gpx, {
        signal: late.signal,
        fetch: async (url, init) => {
          if (!String(url).includes("overpass"))
            return ignResponse(pointCount(init), 40);
          late.abort();
          throw new DOMException("Aborted", "AbortError");
        },
      }),
    "aborted",
  );
};

const checkPortability = (): void => {
  for (const file of readdirSync(join("src", "geo"))) {
    const source = readFileSync(join("src", "geo", file), "utf8");
    assert.doesNotMatch(
      source,
      /\bDOMParser\b|from "(node:)?fs"|\bwindow\.|Math\.random|Date\.now/,
      `${file} doit tourner dans un Web Worker comme dans Node`,
    );
  }
};

// Aucun appel réseau : les fixtures contiennent les réponses brutes, et les erreurs passent par un `fetch` simulé.
export default async function check(): Promise<void> {
  checkFixtures();
  checkRefusals();
  checkNoisyTraces();
  checkProfile();
  checkWidths();
  await checkNetwork();
  checkPortability();
}
