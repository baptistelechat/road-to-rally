// Géométrie du prototype : lecture des réponses BRouter, repérage de la jonction, tracés synthétiques.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { project, type LatLon, type PlanePoint } from "../../../src/geo/gpx";

export interface RawRoute {
  name: string;
  origin: LatLon;
  points: PlanePoint[];
  via: number;
}

interface GeoJson {
  features: { geometry: { coordinates: number[][] } }[];
}

export const readRoute = (name: string, ring: readonly number[]): RawRoute => {
  const json = JSON.parse(
    readFileSync(
      join("fixtures/brouter/roundabouts", `${name}.geojson`),
      "utf8",
    ),
  ) as GeoJson;
  const coords = json.features[0].geometry.coordinates;
  const origin = { lat: coords[0][1], lon: coords[0][0] };
  const points = coords.map(([lon, lat]) => project({ lat, lon }, origin));
  const target = project({ lat: ring[1], lon: ring[0] }, origin);
  let via = 0;
  points.forEach((p, i) => {
    if (
      Math.hypot(p.x - target.x, p.z - target.z) <
      Math.hypot(points[via].x - target.x, points[via].z - target.z)
    )
      via = i;
  });
  return { name, origin, points, via };
};

export const polylineLength = (points: PlanePoint[]): number => {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].z - points[i - 1].z,
    );
  return length;
};

/** Points tous les `step` mètres le long de la polyligne, extrémités conservées. */
export const resampleBy = (
  points: PlanePoint[],
  step: number,
): PlanePoint[] => {
  const length = polylineLength(points);
  const count = Math.max(1, Math.round(length / step));
  const spacing = length / count;
  const result: PlanePoint[] = [points[0]];
  let segment = 1;
  let walked = 0;
  for (let i = 1; i < count; i++) {
    const target = i * spacing;
    let len = Math.hypot(
      points[segment].x - points[segment - 1].x,
      points[segment].z - points[segment - 1].z,
    );
    while (walked + len < target && segment < points.length - 1) {
      walked += len;
      segment++;
      len = Math.hypot(
        points[segment].x - points[segment - 1].x,
        points[segment].z - points[segment - 1].z,
      );
    }
    const t = len > 0 ? (target - walked) / len : 0;
    const a = points[segment - 1];
    const b = points[segment];
    result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  result.push(points[points.length - 1]);
  return result;
};

/** Distance d'un point à une polyligne. */
export const distanceTo = (p: PlanePoint, line: PlanePoint[]): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
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

export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** Cercle de moindres carrés (Kåsa) : le rayon réel du rond-point. */
export const fitCircle = (points: PlanePoint[]): Circle => {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const mz = points.reduce((s, p) => s + p.z, 0) / n;
  let suu = 0;
  let svv = 0;
  let suv = 0;
  let c1 = 0;
  let c2 = 0;
  for (const p of points) {
    const u = p.x - mx;
    const v = p.z - mz;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    c1 += (u * u * u + u * v * v) / 2;
    c2 += (v * v * v + v * u * u) / 2;
  }
  const det = suu * svv - suv * suv;
  const uc = (c1 * svv - c2 * suv) / det;
  const vc = (c2 * suu - c1 * suv) / det;
  return {
    x: uc + mx,
    z: vc + mz,
    r: Math.sqrt(uc * uc + vc * vc + (suu + svv) / n),
  };
};

export interface Split {
  /** Aller seul, jusqu'au point de séparation compris */
  arm: PlanePoint[];
  /** De la séparation à la séparation, le tour compris */
  loop: PlanePoint[];
  /** Le long de l'aller : abscisse depuis le départ, écart au retour réel */
  gaps: { s: number; gap: number }[];
  /** Dernière abscisse où l'écart reste sous le seuil */
  forkS: number;
  /** Le tour : cercle ajusté autour du point de passage */
  ring: Circle;
}

/**
 * Coupe une réponse brute en bras et boucle. Aller et retour réels sont comparés tous les mètres :
 * la jonction se place juste avant le premier écart au-dessus de `tolerance`.
 */
export const splitLollipop = (route: RawRoute, tolerance: number): Split => {
  const go = resampleBy(route.points.slice(0, route.via + 1), 1);
  const back = resampleBy(route.points.slice(route.via), 1);
  const gaps = go.map((p, i) => ({ s: i, gap: distanceTo(p, back) }));
  // Depuis le point de passage, où l'écart est forcément nul, on remonte jusqu'au tour puis jusqu'au bras commun.
  let fork = gaps.length - 1;
  while (fork > 0 && gaps[fork].gap <= tolerance) fork--;
  while (fork > 0 && gaps[fork].gap > tolerance) fork--;
  const j = go[fork];
  let exit = back.length - 1;
  let best = Infinity;
  back.forEach((p, i) => {
    const d = Math.hypot(p.x - j.x, p.z - j.z);
    if (d < best) {
      best = d;
      exit = i;
    }
  });
  // Le retour réel arrive à côté de la jonction : on le rabat sur 30 m plutôt que d'y faire un saut latéral.
  const dx = j.x - back[exit].x;
  const dz = j.z - back[exit].z;
  const tail = back.slice(1, exit).map((p, i, all) => {
    const w = Math.max(0, 1 - (all.length - i) / 30);
    return { x: p.x + dx * w, z: p.z + dz * w };
  });
  return {
    arm: go.slice(0, fork + 1),
    loop: [...go.slice(fork), ...tail, j],
    gaps,
    forkS: fork,
    ring: fitCircle([...go.slice(fork), ...back.slice(1, exit)]),
  };
};

/**
 * Tracé synthétique : bras droit vers +x jusqu'en (0, 0), raccord de rayon `fillet`, tour de rayon `radius`, raccord.
 * Le sens est celui d'un vrai giratoire français, l'îlot à gauche. Droite = (-tz, tx) : +z pour un bras vers +x.
 */
export const syntheticLollipop = (
  armLength: number,
  radius: number,
  fillet: number,
  step = 1,
): { arm: PlanePoint[]; loop: PlanePoint[]; ring: Circle } => {
  const arm: PlanePoint[] = [];
  const count = Math.round(armLength / step);
  for (let i = 0; i <= count; i++)
    arm.push({ x: -armLength + (i * armLength) / count, z: 0 });
  const cx = Math.sqrt((fillet + radius) ** 2 - fillet ** 2);
  const alpha = Math.atan2(cx, fillet);
  const fillets = Math.max(2, Math.round((alpha * fillet) / step));
  const loop: PlanePoint[] = [{ x: 0, z: 0 }];
  for (let i = 1; i <= fillets; i++) {
    const a = (alpha * i) / fillets;
    loop.push({
      x: fillet * Math.sin(a),
      z: fillet - fillet * Math.cos(a),
    });
  }
  const t = loop[loop.length - 1];
  const theta = Math.atan2(t.z, t.x - cx);
  const steps = Math.max(4, Math.round((2 * theta * radius) / step));
  for (let i = 1; i <= steps; i++) {
    const a = theta - (2 * theta * i) / steps;
    loop.push({ x: cx + radius * Math.cos(a), z: radius * Math.sin(a) });
  }
  for (let i = fillets - 1; i >= 0; i--) {
    const a = (alpha * i) / fillets;
    loop.push({
      x: fillet * Math.sin(a),
      z: -fillet + fillet * Math.cos(a),
    });
  }
  return { arm, loop, ring: { x: cx, z: 0, r: radius } };
};
