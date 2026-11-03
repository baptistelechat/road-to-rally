// Garde-fous de l'éditeur (story 3.3), sans réseau : le bon contrôle, à la bonne abscisse, et les fixtures passent.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  analyzeTrace,
  type TraceAnalysis,
  type TraceIssue,
  type TraceIssueCode,
} from "../../src/geo/analyzeTrace";
import { StageError } from "../../src/geo/errors";
import {
  parseGpx,
  project,
  traceFromGpx,
  type LatLon,
  type PlanePoint,
} from "../../src/geo/gpx";
import type { StageInputs } from "../../src/geo/pipeline";

const fixtures = join("fixtures", "stages");
const ORIGIN = { lat: 44.2, lon: -0.8 };
/** Tout écart d'abscisse au-delà est une erreur : le lissage déplace un peu les points, jamais de 40 m. */
const TOLERANCE = 40;

const SCALE =
  project({ lat: ORIGIN.lat, lon: ORIGIN.lon + 0.001 }, ORIGIN).x / 0.001;

/** GPX synthétique à partir de points en mètres, avec 250 m de vraie route de chaque côté des lignes. */
const toGpx = (points: PlanePoint[]): string => {
  const trkpts = points.map(
    (p) =>
      `<trkpt lat="${(ORIGIN.lat - p.z / 111320).toFixed(7)}" lon="${(ORIGIN.lon + p.x / SCALE).toFixed(7)}"></trkpt>`,
  );
  return `<gpx><metadata><desc>rally-runoff=250</desc></metadata><trk><trkseg>${trkpts.join("\n")}</trkseg></trk></gpx>`;
};

const line = (from: PlanePoint, to: PlanePoint, spacing = 25): PlanePoint[] => {
  const count = Math.max(
    1,
    Math.round(Math.hypot(to.x - from.x, to.z - from.z) / spacing),
  );
  return Array.from({ length: count + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / count,
    z: from.z + ((to.z - from.z) * i) / count,
  }));
};

const path = (...corners: PlanePoint[]): PlanePoint[] =>
  corners.flatMap((corner, i) =>
    i === 0 ? [corner] : line(corners[i - 1], corner).slice(1),
  );

/** Aller vers l'est, demi-tour, retour parallèle à `gap` mètres jusqu'à `backTo`, puis éloignement vers le sud. */
const uTurn = (length: number, gap: number, backTo: number): PlanePoint[] => {
  const arc = Array.from({ length: 7 }, (_, i) => {
    const angle = (i * Math.PI) / 6;
    return {
      x: length + (gap / 2) * Math.sin(angle),
      z: gap / 2 - (gap / 2) * Math.cos(angle),
    };
  });
  return [
    ...line({ x: 0, z: 0 }, { x: length, z: 0 }).slice(0, -1),
    ...arc,
    ...line({ x: length, z: gap }, { x: backTo, z: gap }).slice(1),
  ];
};

const issue = (analysis: TraceAnalysis, code: TraceIssueCode): TraceIssue => {
  const found = analysis.issues.find((candidate) => candidate.code === code);
  assert.ok(
    found,
    `${code} attendu, reçu : ${analysis.issues.map((i) => i.code).join(", ") || "rien"}`,
  );
  return found;
};

const assertNear = (actual: number, expected: number, label: string): void =>
  assert.ok(
    Math.abs(actual - expected) < TOLERANCE,
    `${label} : ${actual} au lieu de ${expected}`,
  );

const assertAt = (
  position: LatLon | null | undefined,
  expected: PlanePoint,
  label: string,
): void => {
  assert.ok(position, `${label} : pas de position`);
  const plane = project(position, ORIGIN);
  assert.ok(
    Math.hypot(plane.x - expected.x, plane.z - expected.z) < TOLERANCE,
    `${label} : (${plane.x}, ${plane.z}) au lieu de (${expected.x}, ${expected.z})`,
  );
};

/** Le pipeline refuse ce que l'éditeur bloque pour la longueur ou un croisement : ils ne se contredisent pas. */
const assertPipelineRefuses = (gpx: string, code: string): void => {
  assert.throws(
    () => traceFromGpx(gpx),
    (error: unknown) => error instanceof StageError && error.code === code,
    code,
  );
};

const checkLength = (): void => {
  const short = toGpx(path({ x: 0, z: 0 }, { x: 2400, z: 0 }));
  const tooShort = issue(analyzeTrace(short), "tooShort");
  assert.equal(tooShort.blocking, true);
  assertNear(tooShort.s, 1900, "trop court");
  assertAt(tooShort.position, { x: 2150, z: 0 }, "trop court");
  assert.match(tooShort.message, /1,9\d km.*au moins 2/);
  assertPipelineRefuses(short, "tooShort");

  const long = toGpx(path({ x: 0, z: 0 }, { x: 15600, z: 0 }));
  const tooLong = issue(analyzeTrace(long), "tooLong");
  assert.equal(tooLong.s, 15000);
  assertAt(tooLong.position, { x: 15250, z: 0 }, "trop long");
  assertPipelineRefuses(long, "tooLong");

  // Sans espoir : pas d'axe, mais toujours un endroit.
  const hopelessShort = analyzeTrace(
    toGpx(line({ x: 0, z: 0 }, { x: 900, z: 0 })),
  );
  assert.equal(hopelessShort.axis, null);
  const stub = issue(hopelessShort, "tooShort");
  assertNear(stub.s, 400, "très court");
  assertAt(stub.position, { x: 900, z: 0 }, "très court");
  assert.match(stub.message, /0,40 km/);

  const hopelessLong = analyzeTrace(
    toGpx(line({ x: 0, z: 0 }, { x: 40000, z: 0 }, 100)),
  );
  assert.equal(hopelessLong.axis, null);
  const far = issue(hopelessLong, "tooLong");
  assert.equal(far.s, 15000);
  assertAt(far.position, { x: 15250, z: 0 }, "très long");

  const empty = analyzeTrace("<gpx></gpx>");
  assert.equal(empty.axis, null);
  assert.equal(empty.issues[0]?.code, "tooShort");
  assert.equal(empty.issues[0]?.position, null);
};

const checkSelfCrossing = (): void => {
  // Un huit : le tracé se recoupe à angle droit vers x = 2950, soit 2700 m après la ligne de départ.
  const eight = toGpx([
    ...path({ x: 0, z: 0 }, { x: 3000, z: 0 }),
    { x: 3050, z: -60 },
    { x: 3000, z: -120 },
    { x: 2950, z: -60 },
    { x: 2950, z: 0 },
    { x: 2950, z: 60 },
    ...path({ x: 2950, z: 100 }, { x: 2950, z: 500 }),
  ]);
  const crossing = issue(analyzeTrace(eight), "selfCrossing");
  assert.equal(crossing.blocking, true);
  assertNear(crossing.s, 2700, "croisement");
  assert.ok(crossing.otherS, "deux abscisses pour la story 3.7");
  assert.ok(crossing.otherS > crossing.s + 100, `${crossing.otherS}`);
  assertAt(crossing.position, { x: 2950, z: 0 }, "croisement");
  assertAt(crossing.otherPosition, { x: 2950, z: 0 }, "croisement, autre");

  // Le bug corrigé : marqué `rally-runoff`, le pipeline refuse aussi, avec son abscisse.
  assert.throws(
    () => traceFromGpx(eight),
    (error: unknown) =>
      error instanceof StageError &&
      error.code === "selfCrossing" &&
      /km 2,[67]\d.*km 3,\d+/.test(error.message),
  );
};

const checkDeadEnd = (): void => {
  // Cul-de-sac à x = 1500 : 300 m aller, 300 m retour, sur la même route.
  const deadEnd = toGpx(
    path(
      { x: 0, z: 0 },
      { x: 1500, z: 0 },
      { x: 1500, z: 300 },
      { x: 1500, z: 0 },
      { x: 3000, z: 0 },
    ),
  );
  const crossing = issue(analyzeTrace(deadEnd), "selfCrossing");
  assertNear(crossing.s, 1250, "cul-de-sac");
  assert.ok(crossing.otherS !== undefined);
  assertNear(crossing.otherS, 1850, "cul-de-sac, retour");
  assertPipelineRefuses(deadEnd, "selfCrossing");
};

const checkRoadContact = (): void => {
  // Retour à 4 m de l'aller, de x = 2600 à x = 2000 : la première rencontre est vers x = 2000.
  const pinched = toGpx([
    ...uTurn(2600, 4, 2000),
    ...path({ x: 1950, z: 30 }, { x: 1900, z: 80 }, { x: 1900, z: 700 }),
  ]);
  const analysis = analyzeTrace(pinched);
  assert.equal(
    analysis.issues.some((i) => i.code === "selfCrossing"),
    false,
    "aucun croisement : les axes ne se rejoignent pas",
  );
  const contact = issue(analysis, "roadContact");
  assert.equal(contact.blocking, true);
  assertNear(contact.s, 1750, "chaussées");
  assert.ok(contact.otherS !== undefined);
  assertNear(contact.otherS, 2950, "chaussées, autre");

  // La largeur vient du tag `highway` : à 6 m, 5 m de large passe, 7 m de large se touche.
  const close = toGpx([
    ...uTurn(2600, 6, 2000),
    ...path({ x: 1950, z: 30 }, { x: 1900, z: 80 }, { x: 1900, z: 700 }),
  ]);
  assert.equal(
    analyzeTrace(close).issues.some((i) => i.code === "roadContact"),
    false,
    "largeur par défaut",
  );
  const segments = [
    { points: parseGpx(close), ways: [{ fromIndex: 0, highway: "primary" }] },
  ];
  issue(analyzeTrace(close, { widthsByHighway: segments }), "roadContact");
};

const checkLines = (): void => {
  // L'arrivée tombe sur le retour, à 18 m de l'aller : 2400 m après le départ, sur l'autre branche.
  const route = uTurn(3000, 18, 2400);
  const finish = analyzeTrace(toGpx(route));
  const atFinish = issue(finish, "lineTooClose");
  assert.equal(atFinish.blocking, true);
  assert.ok(finish.axis);
  assert.equal(atFinish.s, finish.axis.length);
  assert.ok(atFinish.otherS !== undefined);
  assertNear(atFinish.otherS, 2400, "arrivée, branche");
  assertAt(atFinish.position, { x: 2650, z: 18 }, "arrivée");
  assert.match(atFinish.message, /ligne d'arrivée.*18 m/);

  // Dans l'autre sens, c'est le départ.
  const start = analyzeTrace(toGpx([...route].reverse()));
  const atStart = issue(start, "lineTooClose");
  assert.equal(atStart.s, 0);
  assert.match(atStart.message, /ligne de départ/);

  // Un virage juste après la ligne reste la même branche, à angle droit comme en épingle large.
  const corner = analyzeTrace(
    toGpx(path({ x: 0, z: 0 }, { x: 265, z: 0 }, { x: 265, z: 3000 })),
  );
  assert.deepEqual(
    corner.issues.filter((i) => i.blocking).map((i) => i.code),
    [],
    "angle droit après le départ",
  );
};

const checkWidened = (): void => {
  // Angle de 40° à x = 1500 : le rayon minimal écarte l'axe de bien plus de 5 m de la pointe.
  const corner = analyzeTrace(
    toGpx(
      path(
        { x: 0, z: 0 },
        { x: 1500, z: 0 },
        {
          x: 1500 - 1500 * Math.cos((40 * Math.PI) / 180),
          z: 1500 * Math.sin((40 * Math.PI) / 180),
        },
      ),
    ),
  );
  const widened = issue(corner, "widened");
  assert.equal(widened.blocking, false, "signalé, sans bloquer");
  assertNear(widened.s, 1250, "écart");
  assertAt(widened.otherPosition, { x: 1500, z: 0 }, "pointe d'origine");
  assert.match(widened.message, /s'écarte de \d+ m/);
  assert.equal(
    corner.issues.filter((i) => i.code === "widened").length,
    1,
    "une seule portion",
  );
  assert.deepEqual(
    corner.issues.filter((i) => i.blocking),
    [],
    "pas de refus sur ce virage",
  );
};

const checkFixtures = (): void => {
  for (const id of ["mountain", "road"]) {
    const gpx = readFileSync(join(fixtures, `${id}.gpx`), "utf8");
    const inputs = JSON.parse(
      readFileSync(join(fixtures, `${id}.inputs.json`), "utf8"),
    ) as StageInputs;
    const analysis = analyzeTrace(gpx);
    assert.deepEqual(analysis.issues, [], `${id}, largeur par défaut`);

    // Avec les vraies voies voisines réduites à leur tag `highway`, comme l'éditeur les estimera.
    const estimated = analyzeTrace(gpx, {
      widthsByHighway: (inputs.ways ?? []).map((way) => ({
        points: way.geometry,
        ways: [{ fromIndex: 0, highway: way.tags.highway }],
      })),
    });
    assert.deepEqual(estimated.issues, [], `${id}, largeur estimée`);

    // L'axe analysé est bien celui que le pipeline roulera, et il a ses lat/lon.
    const trace = traceFromGpx(gpx);
    assert.ok(analysis.axis);
    assert.deepEqual(analysis.axis.points, trace.points);
    assert.equal(analysis.axis.runoffPoints, trace.runoffPoints);
    assert.equal(analysis.axis.latLon.length, trace.points.length);
    const back = project(analysis.axis.latLon[200], trace.origin);
    assert.ok(
      Math.hypot(back.x - trace.points[200].x, back.z - trace.points[200].z) <
        0.01,
    );
  }
};

/** Le pire cas réel : 15 km de lacets aux angles vifs, que l'élargissement doit reprendre un par un. */
const measureCost = (): void => {
  const rows = 40;
  const row = 340;
  const serpentine: PlanePoint[] = [];
  for (let i = 0; i < rows; i++) {
    const z = i * 40;
    const [from, to] = i % 2 === 0 ? [0, row] : [row, 0];
    serpentine.push(...line({ x: from, z }, { x: to, z }));
  }
  const gpx = toGpx(serpentine);

  const timed = (run: () => void): number => {
    const start = performance.now();
    run();
    return performance.now() - start;
  };
  // Une première passe pour écarter le coût de compilation à la volée.
  analyzeTrace(gpx);
  let result: TraceAnalysis | null = null;
  const analyzeMs = timed(() => {
    result = analyzeTrace(gpx);
  });
  const analysis = result as unknown as TraceAnalysis;
  assert.ok(analysis.axis, "un axe sur le tracé de mesure");
  const cloneMs = timed(() => structuredClone(analysis));
  const segments = [
    { points: parseGpx(gpx), ways: [{ fromIndex: 0, highway: "tertiary" }] },
  ];
  const estimatedMs = timed(() => {
    analyzeTrace(gpx, { widthsByHighway: segments });
  });
  console.log(
    `     analyse de ${(analysis.axis.length / 1000).toFixed(1)} km : ${analyzeMs.toFixed(0)} ms dans le Worker, ${estimatedMs.toFixed(0)} ms avec les tags highway, ${cloneMs.toFixed(0)} ms pour copier le résultat aller et retour`,
  );
};

export default async function guardsCheck(): Promise<void> {
  checkLength();
  checkSelfCrossing();
  checkDeadEnd();
  checkRoadContact();
  checkLines();
  checkWidened();
  checkFixtures();
  measureCost();
}
