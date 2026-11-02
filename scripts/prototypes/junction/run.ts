// Prototype de la story 3.7 : `pnpm tsx scripts/prototypes/junction/run.ts <real|synth|naive> [filtre]`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CORRIDOR_CELL } from "../../../src/geo/config";
import { axisFromGpx, minPlanRadius, traceFromGpx, unproject, type PlanePoint } from "../../../src/geo/gpx";
import { buildTerrain } from "../../../src/geo/terrain";
import { findRoadContact } from "../../../src/sim/track/roadContact";
import type { Vec3 } from "../../../src/sim/types";
import {
  baseOf,
  prepareAxis,
  roadProfile,
  toPoints,
  type Disc,
  type LollipopAxis,
} from "./axis";
import {
  distanceTo,
  polylineLength,
  readRoute,
  splitLollipop,
  syntheticLollipop,
} from "./geometry";
import { buildScene, localNodes, type Mode } from "./mesh";
import { measure } from "./measure";
import { CASES } from "./record";

type AltitudeAt = (x: number, z: number) => number;

/** Altitude IGN enregistrée, bilinéaire sur la grille de 16 m. */
const ignSampler = (name: string): AltitudeAt => {
  const file = join("scripts/prototypes/junction/ign", `${name}.json`);
  if (!existsSync(file))
    throw new Error(`${file} absent : lancer record.ts ign`);
  const { nodes, altitudes } = JSON.parse(readFileSync(file, "utf8")) as {
    nodes: PlanePoint[];
    altitudes: number[];
  };
  const known = new Map<string, number>();
  nodes.forEach((n, i) => known.set(`${n.x},${n.z}`, altitudes[i]));
  const fallback = altitudes[0];
  return (x, z) => {
    const x0 = Math.floor(x / CORRIDOR_CELL) * CORRIDOR_CELL;
    const z0 = Math.floor(z / CORRIDOR_CELL) * CORRIDOR_CELL;
    const a = known.get(`${x0},${z0}`) ?? fallback;
    const b = known.get(`${x0 + CORRIDOR_CELL},${z0}`) ?? a;
    const c = known.get(`${x0},${z0 + CORRIDOR_CELL}`) ?? a;
    const d = known.get(`${x0 + CORRIDOR_CELL},${z0 + CORRIDOR_CELL}`) ?? a;
    const u = (x - x0) / CORRIDOR_CELL;
    const v = (z - z0) / CORRIDOR_CELL;
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
};

const slopeField =
  (gx: number, gz: number): AltitudeAt =>
  (x, z) =>
    500 + gx * x + gz * z + 2 * Math.sin(x / 37) * Math.cos(z / 53);

/** Plus petit disque qui contient la zone où les chaussées aller et retour se recouvrent. */
/** Le palier de C+ : la seule zone où les chaussées se recouvrent, sans les marges du contour de plateforme. */
const overlapDisc = (axis: LollipopAxis, width: number): Disc => {
  const disc = forkDisc(axis, width);
  return { ...disc, r: disc.r - (width / 2 + 2.5 + 1) + width / 2 };
};

const forkDisc = (axis: LollipopAxis, width: number): Disc => {
  const { plan, armEnd } = axis;
  const n = plan.length;
  const j = plan[armEnd];
  let last = 2;
  const half = Math.floor((n - armEnd) / 2);
  for (let k = 1; k < half; k++) {
    const go = plan[armEnd + k];
    const back = plan[n - 1 - k];
    // Au premier écart suffisant on s'arrête : plus loin, les deux abscisses se rejoignent de l'autre côté du tour.
    if (Math.hypot(go.x - back.x, go.z - back.z) >= width + 0.5) break;
    last = k;
  }
  const go = plan[armEnd + last];
  const back = plan[n - 1 - last];
  const x = (j.x + (go.x + back.x) / 2) / 2;
  const z = (j.z + (go.z + back.z) / 2) / 2;
  const far = Math.max(
    Math.hypot(x - j.x, z - j.z),
    Math.hypot(x - go.x, z - go.z),
    Math.hypot(x - back.x, z - back.z),
  );
  return { x, z, r: far + width / 2 + 2.5 + 1 };
};

/** Disque qui contient toute la boucle : itération de Bădoiu-Clarkson. */
const wholeDisc = (axis: LollipopAxis, width: number): Disc => {
  const loop = axis.plan.slice(axis.armEnd);
  let x = loop[0].x;
  let z = loop[0].z;
  for (let step = 1; step < 200; step++) {
    let far = loop[0];
    let best = 0;
    for (const p of loop) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > best) {
        best = d;
        far = p;
      }
    }
    x += (far.x - x) / (step + 1);
    z += (far.z - z) / (step + 1);
  }
  const r = loop.reduce((m, p) => Math.max(m, Math.hypot(p.x - x, p.z - z)), 0);
  return { x, z, r: r + width / 2 + 2.5 + 1 };
};

interface Variant {
  label: string;
  mode: Mode;
  disc: (axis: LollipopAxis, width: number) => Disc | null;
  flat: (axis: LollipopAxis, width: number) => Disc | null;
  /** Marge du palier au-delà du disque, en mètres : par défaut, de quoi aplatir aussi le contour de la plateforme */
  reach?: number;
  /** Aller et retour ramenés à la même altitude à même distance de la jonction, sans mise à plat */
  symmetric?: boolean;
}

/** Nombre de points après la jonction où les chaussées aller et retour se recouvrent encore. */
const overlapPoints = (axis: LollipopAxis, width: number): number => {
  const { plan, armEnd } = axis;
  const n = plan.length;
  let last = 2;
  for (let k = 1; k < (n - armEnd) / 2; k++) {
    const go = plan[armEnd + k];
    const back = plan[n - 1 - k];
    if (Math.hypot(go.x - back.x, go.z - back.z) >= width + 0.5) break;
    last = k;
  }
  return last;
};

const symmetrize = (y: number[], armEnd: number, reach: number): number[] => {
  const result = [...y];
  const n = y.length;
  const fade = 15;
  for (let k = 1; k <= reach + fade && armEnd + k < n - 1 - k; k++) {
    const mean = (y[armEnd + k] + y[n - 1 - k]) / 2;
    const t = Math.max(0, (k - reach) / fade);
    const w = 1 - t * t * (3 - 2 * t);
    result[armEnd + k] = y[armEnd + k] + (mean - y[armEnd + k]) * w;
    result[n - 1 - k] = y[n - 1 - k] + (mean - y[n - 1 - k]) * w;
  }
  return result;
};

const VARIANTS: Variant[] = [
  {
    label: "A plateforme fourche",
    mode: "platform",
    disc: forkDisc,
    flat: forkDisc,
  },
  {
    label: "B plateforme entière",
    mode: "platform",
    disc: wholeDisc,
    flat: wholeDisc,
  },
  {
    label: "C contour d'union   ",
    mode: "union",
    disc: () => null,
    flat: () => null,
  },
  {
    label: "C+ union, fourche à plat",
    mode: "union",
    disc: () => null,
    flat: overlapDisc,
    reach: 0,
  },
  {
    label: "S union, fourche symétrique",
    mode: "union",
    disc: () => null,
    flat: () => null,
    symmetric: true,
  },
  {
    label: "D sans contraintes  ",
    mode: "unconstrained",
    disc: forkDisc,
    flat: forkDisc,
  },
];

const f = (v: number, d = 2): string => v.toFixed(d);

const evaluate = async (
  name: string,
  axis: LollipopAxis,
  width: number,
  altitudeAt: AltitudeAt,
  only: string | undefined,
): Promise<void> => {
  const widths = axis.plan.map(() => width);
  const nodes = localNodes(axis.plan, 150);
  for (const variant of VARIANTS) {
    if (only && !variant.label.startsWith(only)) continue;
    const started = performance.now();
    const flat = variant.flat(axis, width);
    const disc = variant.disc(axis, width);
    const { y: profiled, report } = roadProfile(axis, altitudeAt, flat, variant.reach ?? width / 2 + 2.5 + 2);
    const y = variant.symmetric
      ? symmetrize(profiled, axis.armEnd, overlapPoints(axis, width))
      : profiled;
    const points: Vec3[] = toPoints(axis, y);
    const base = baseOf(y);
    const head = `${name} | ${variant.label} | R disque ${disc ? f(disc.r, 1) : flat ? f(flat.r, 1) : "-"} | fermeture ${f(report.closure)} m, mise à plat ${f(report.flatten)} m sur ${report.transition} m, pente ${f(report.maxSlope * 100, 1)} %, rayon V ${f(Math.min(report.minVerticalRadius, 9999), 0)} m`;
    try {
      const scene = buildScene(
        points,
        axis.armEnd,
        widths,
        nodes,
        nodes.map((p) => altitudeAt(p.x, p.z)),
        altitudeAt,
        base,
        variant.mode,
        disc,
      );
      const m = await measure(scene, points, axis.armEnd);
      console.log(
        `${head}\n   OK ${m.triangles} tri, mauvais ${m.bad} (aire mini ${f(m.minArea, 4)}), >60° ${m.steep}, >80° ${m.walls}, trous ${m.holes}/${m.grid}, rayons ${m.rays} (rien ${m.rayMiss}, écart ${m.rayOff}), roue saut max ${f(m.wheelStep, 3)} m (${m.wheelSteps} > 3 cm) écart axe ${f(m.wheelOff, 3)}, chaussée saut 20 cm ${f(m.roadStep, 3)}, aller/retour ${f(m.ribbonGap, 3)} sur ${m.overlap} pts, terrain au-dessus ${f(m.poke, 3)} (${m.pokes}), ruban-plateforme ${f(m.platformGap, 3)}, bas-côté mini ${f(scene.minShoulder)}, ${f(performance.now() - started, 0)} ms`,
      );
    } catch (error) {
      console.log(`${head}\n   ÉCHEC ${(error as Error).message}`);
    }
  }
};

const WIDTHS: Record<string, number> = {
  "a-5.75": 6.5,
  "b-0.90": 6.5,
  "c-6.07": 6.5,
};
const TOLERANCE: Record<string, number> = {
  "a-5.75": 1.5,
  "b-0.90": 1.5,
  "c-6.07": 5,
};

const runReal = async (only?: string): Promise<void> => {
  for (const c of CASES) {
    const route = readRoute(c.name, c.ring);
    const split = splitLollipop(route, TOLERANCE[c.name]);
    const axis = prepareAxis(split.arm, split.loop);
    const w = axis.widen;
    console.log(
      `\n=== ${c.name} : bras ${f(polylineLength(split.arm), 0)} m, boucle ${f(polylineLength(split.loop), 0)} m, rayon ajusté ${f(split.ring.r, 1)} m, largeur ${WIDTHS[c.name]} ; élargissement : rayon ${f(w.before, 1)} -> ${f(w.after, 1)} m en ${w.iterations} itérations, déplacement ${f(w.moved, 1)} m, boucle ${f(w.loopBefore, 0)} -> ${f(w.loopAfter, 0)} m`,
    );
    await evaluate(c.name, axis, WIDTHS[c.name], ignSampler(c.name), only);
  }
};

const runSynth = async (filter?: string, only?: string): Promise<void> => {
  const scenarios = [6, 8, 12, 25].flatMap((radius) =>
    [
      [0, 0],
      [0.08, 0],
      [0.15, 0],
      [0, 0.15],
    ].map(([gx, gz]) => ({ radius, gx, gz, width: 5 })),
  );
  scenarios.push(
    { radius: 8, gx: 0, gz: 0, width: 9 },
    { radius: 8, gx: 0.15, gz: 0, width: 9 },
  );
  for (const s of scenarios) {
    const name = `R${s.radius} l${s.width} pente ${s.gx}/${s.gz}`;
    if (filter && !name.startsWith(filter)) continue;
    const { arm, loop } = syntheticLollipop(150, s.radius, 8);
    const axis = prepareAxis(arm, loop);
    if (s.gx === 0 && s.gz === 0)
      console.log(
        `\n=== R${s.radius} : rayon ${f(axis.widen.before, 1)} -> ${f(axis.widen.after, 1)} m, ${axis.widen.iterations} itérations, déplacement ${f(axis.widen.moved, 1)} m, boucle ${f(axis.widen.loopBefore, 0)} -> ${f(axis.widen.loopAfter, 0)} m`,
      );
    await evaluate(name, axis, s.width, slopeField(s.gx, s.gz), only);
  }
};

/**
 * Sans rien changer au jeu : l'aller-retour complet passe dans `traceFromGpx`, `findRoadContact` et `buildTerrain`.
 * Long prolongement droit : le jeu refuse moins de 2 km. La marque `rally-runoff` évite le test de croisement.
 */
const runNaive = async (): Promise<void> => {
  const routes: { name: string; arm: PlanePoint[]; loop: PlanePoint[]; width: number; alt: AltitudeAt }[] = [];
  for (const radius of [6, 8, 12, 25]) {
    const { arm, loop } = syntheticLollipop(150, radius, 8);
    routes.push({ name: `synth R${radius}`, arm, loop, width: 5, alt: slopeField(0, 0) });
  }
  for (const c of CASES) {
    const split = splitLollipop(readRoute(c.name, c.ring), TOLERANCE[c.name]);
    routes.push({ name: c.name, arm: split.arm, loop: split.loop, width: WIDTHS[c.name], alt: ignSampler(c.name) });
  }
  const origin = { lat: 45, lon: 5 };
  for (const r of routes) {
    const dx = r.arm[1].x - r.arm[0].x;
    const dz = r.arm[1].z - r.arm[0].z;
    const len = Math.hypot(dx, dz) || 1;
    const lead: PlanePoint[] = [];
    for (let d = 2300; d > 0; d -= 50)
      lead.push({ x: r.arm[0].x - (dx / len) * d, z: r.arm[0].z - (dz / len) * d });
    const full = [...lead, ...r.arm, ...r.loop.slice(1), ...[...r.arm].reverse().slice(1), ...[...lead].reverse()];
    const gpx = `<gpx><trk><desc>rally-runoff=250</desc><trkseg>${full
      .map((p) => {
        const q = unproject(p, origin);
        return `<trkpt lat="${q.lat}" lon="${q.lon}"></trkpt>`;
      })
      .join("")}</trkseg></trk></gpx>`;
    const started = performance.now();
    let refused = "accepté";
    try {
      traceFromGpx(gpx);
    } catch (error) {
      refused = `refusé (${(error as Error).message})`;
    }
    const trace = axisFromGpx(gpx);
    const pts = trace.points;
    const halfway = Math.floor(pts.length / 2);
    const armPoints = Math.round(polylineLength(r.arm) / 2);
    const leadPoints = Math.round(2300 / 2);
    // Aller et retour du bras après passage dans le jeu : se recouvrent-ils encore ?
    const backward = pts.slice(halfway);
    let maxGap = 0;
    let atGap = 0;
    for (let i = leadPoints; i < leadPoints + armPoints; i += 2) {
      const gap = distanceTo(pts[i], backward);
      if (gap > maxGap) {
        maxGap = gap;
        atGap = i - leadPoints;
      }
    }
    const pointsY: Vec3[] = pts.map((p) => ({ x: p.x, y: 1, z: p.z }));
    const widths = pts.map(() => r.width);
    const contact = findRoadContact(pointsY, widths);
    const nodes = localNodes(pts.slice(leadPoints - 60, -(leadPoints - 60)), 40);
    let terrain = "réussi";
    try {
      buildTerrain(pointsY, widths, nodes, nodes.map(() => 1), 0, trace.runoffPoints);
    } catch (error) {
      terrain = `ÉCHEC : ${(error as Error).message}`;
    }
    let single = "réussi";
    const unique = pts.slice(0, leadPoints + armPoints + Math.round(polylineLength(r.loop) / 2));
    try {
      buildTerrain(
        unique.map((p) => ({ x: p.x, y: 1, z: p.z })),
        unique.map(() => r.width),
        nodes,
        nodes.map(() => 1),
        0,
        trace.runoffPoints,
      );
    } catch (error) {
      single = `ÉCHEC : ${(error as Error).message}`;
    }
    console.log(
      `${r.name} : traceFromGpx ${refused} ; rayon mini après élargissement ${f(minPlanRadius(pts), 2)} m, boucle ${f(polylineLength(r.loop), 0)} m, écart aller/retour sur le bras ${f(maxGap, 2)} m (à ${atGap * 2} m du départ), contact chaussées ${contact ? `à ${f(contact.sA - leadPoints * 2, 0)} et ${f(contact.sB - leadPoints * 2, 0)} m` : "aucun"}, terrain aller-retour : ${terrain} ; terrain bras + boucle : ${single}, ${f(performance.now() - started, 0)} ms`,
    );
  }
};

const [command, a, b] = process.argv.slice(2);
if (command === "real") void runReal(a);
else if (command === "synth") void runSynth(a, b);
else if (command === "naive") void runNaive();
else console.log("real [variante] | synth [scénario] [variante] | naive");
