// Ponts low-poly sous le ruban de la route : tablier, garde-corps, piles ou arches jusqu'au sol (propositions du labo `decor-lab`, onglet Ponts).
// Pur : la route reste dessinée par le ruban, ce module n'ajoute que l'ouvrage dessous et sur les bords.
import type { BufferGeometry } from "three";
import type { Rgb } from "@/render/palette";
import type { BridgeStyle } from "@/sim/types";
import type { Vec3 } from "./buildingMath";
import {
  createBuffers,
  pushQuad,
  shade,
  toGeometry,
  UP,
  DOWN,
  type Buffers,
} from "./buildingMesh";

export const BRIDGE_STYLES: readonly BridgeStyle[] = [
  "stone",
  "concrete",
  "steel",
  "viaduct",
];

export interface BridgeSpan {
  /** Axe de la chaussée, au niveau de l'enrobé, un point tous les quelques mètres */
  points: { x: number; y: number; z: number }[];
  /** Demi-largeur du tablier, bas-côtés compris, en mètres */
  halfWidth: number;
  /** Demi-largeur de l'enrobé : au-delà, jusqu'au garde-corps, un trottoir recouvre le bas-côté */
  roadHalfWidth: number;
  /** Sol sous l'ouvrage (fond du lit dans l'eau) */
  groundAt: (x: number, z: number) => number;
}

interface StyleSpec {
  /** Épaisseur du tablier sous l'enrobé, en mètres */
  deck: number;
  body: Rgb;
  trim: Rgb;
}

const STYLE_SPECS: Record<BridgeStyle, StyleSpec> = {
  stone: { deck: 1.1, body: [0.66, 0.6, 0.5], trim: [0.74, 0.69, 0.6] },
  concrete: { deck: 0.9, body: [0.7, 0.7, 0.67], trim: [0.58, 0.6, 0.62] },
  steel: { deck: 0.6, body: [0.62, 0.62, 0.6], trim: [0.24, 0.4, 0.36] },
  viaduct: { deck: 1.4, body: [0.8, 0.79, 0.75], trim: [0.6, 0.62, 0.64] },
};

/** Un point de l'axe à l'abscisse `s`, et la direction de la route à cet endroit. */
interface Station {
  p: Vec3;
  /** Direction horizontale unitaire */
  dx: number;
  dz: number;
}

const sampler = (points: BridgeSpan["points"]) => {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++)
    cumulative.push(
      cumulative[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].z - points[i - 1].z,
        ),
    );
  const length = cumulative[cumulative.length - 1];
  const at = (s: number): Station => {
    const target = Math.max(0, Math.min(length, s));
    let i = 1;
    while (i < points.length - 1 && cumulative[i] < target) i++;
    const a = points[i - 1];
    const b = points[i];
    const span = cumulative[i] - cumulative[i - 1] || 1;
    const t = (target - cumulative[i - 1]) / span;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return {
      p: [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t],
      dx: (b.x - a.x) / len,
      dz: (b.z - a.z) / len,
    };
  };
  return { length, at };
};

/** Point à `lateral` mètres à droite de l'axe, à la hauteur `dy` sous ou sur l'enrobé. */
const offset = (st: Station, lateral: number, dy: number): Vec3 => [
  st.p[0] - st.dz * lateral,
  st.p[1] + dy,
  st.p[2] + st.dx * lateral,
];

/** Prisme de `sides` faces entre deux points, de rayon `radius` (4 : poutre carrée, 8 : pile ronde). */
const pushBeam = (
  out: Buffers,
  a: Vec3,
  b: Vec3,
  radius: number,
  color: Rgb,
  sides = 4,
): void => {
  const axis: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...axis) || 1;
  const n: Vec3 = [axis[0] / len, axis[1] / len, axis[2] / len];
  const ref: Vec3 = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cross = (u: Vec3, v: Vec3): Vec3 => [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const u = cross(n, ref);
  const ul = Math.hypot(...u) || 1;
  const e1: Vec3 = [u[0] / ul, u[1] / ul, u[2] / ul];
  const e2 = cross(n, e1);
  const ring = (c: Vec3, k: number): Vec3 => {
    const angle = (2 * Math.PI * k) / sides + Math.PI / sides;
    const ca = Math.cos(angle) * radius;
    const sa = Math.sin(angle) * radius;
    return [
      c[0] + e1[0] * ca + e2[0] * sa,
      c[1] + e1[1] * ca + e2[1] * sa,
      c[2] + e1[2] * ca + e2[2] * sa,
    ];
  };
  for (let k = 0; k < sides; k++) {
    const mid = (2 * Math.PI * (k + 0.5)) / sides + Math.PI / sides;
    const want: Vec3 = [
      e1[0] * Math.cos(mid) + e2[0] * Math.sin(mid),
      e1[1] * Math.cos(mid) + e2[1] * Math.sin(mid),
      e1[2] * Math.cos(mid) + e2[2] * Math.sin(mid),
    ];
    pushQuad(
      out,
      [ring(a, k), ring(a, k + 1), ring(b, k + 1), ring(b, k)],
      want,
      color,
    );
  }
};

/** Bande le long de l'axe entre deux décalages latéraux et deux hauteurs, face vers `side` (1 droite, -1 gauche). */
const pushSide = (
  out: Buffers,
  a: Station,
  b: Station,
  lateral: number,
  topA: number,
  topB: number,
  bottomA: number,
  bottomB: number,
  side: 1 | -1,
  color: Rgb,
): void => {
  const want: Vec3 = [-a.dz * side, 0, a.dx * side];
  pushQuad(
    out,
    [
      offset(a, lateral, bottomA),
      offset(b, lateral, bottomB),
      offset(b, lateral, topB),
      offset(a, lateral, topA),
    ],
    want,
    color,
  );
};

/** Dessous horizontal entre -w et +w, à la hauteur relative `dyA` puis `dyB`. */
const pushSoffit = (
  out: Buffers,
  a: Station,
  b: Station,
  w: number,
  dyA: number,
  dyB: number,
  color: Rgb,
): void =>
  pushQuad(
    out,
    [
      offset(a, -w, dyA),
      offset(b, -w, dyB),
      offset(b, w, dyB),
      offset(a, w, dyA),
    ],
    DOWN,
    color,
  );

/** Pile pleine en travers de la route, du sol (enterrée d'un mètre) jusqu'à `top` sous l'enrobé. */
const pushPier = (
  out: Buffers,
  span: BridgeSpan,
  st: Station,
  thickness: number,
  half: number,
  top: number,
  color: Rgb,
): void => {
  const corners = [-1, 1].flatMap((su) =>
    [-1, 1].map((sv) => {
      const x = st.p[0] + st.dx * thickness * su - st.dz * half * sv;
      const z = st.p[2] + st.dz * thickness * su + st.dx * half * sv;
      return { x, z, su, sv };
    }),
  );
  const ground = Math.min(...corners.map((c) => span.groundAt(c.x, c.z))) - 1;
  const y1 = st.p[1] + top;
  if (y1 <= ground) return;
  const order = [corners[0], corners[1], corners[3], corners[2]];
  for (let k = 0; k < 4; k++) {
    const c0 = order[k];
    const c1 = order[(k + 1) % 4];
    const want: Vec3 = [
      (c0.x + c1.x) / 2 - st.p[0],
      0,
      (c0.z + c1.z) / 2 - st.p[2],
    ];
    pushQuad(
      out,
      [
        [c0.x, ground, c0.z],
        [c1.x, ground, c1.z],
        [c1.x, y1, c1.z],
        [c0.x, y1, c0.z],
      ],
      want,
      color,
    );
  }
};

/** Pas d'échantillonnage le long de l'ouvrage, en mètres : assez fin pour l'arrondi des arches */
const STEP = 1;

/** Trottoir juste au-dessus de l'enrobé, en mètres : il couvre le bas-côté sans gêner la voiture qui y roule */
const SIDEWALK_LIFT = 0.03;

const pushDeck = (
  out: Buffers,
  span: BridgeSpan,
  style: BridgeStyle,
  spec: StyleSpec,
  length: number,
  at: (s: number) => Station,
): void => {
  const w = span.halfWidth + 0.3;
  for (let s = 0; s < length; s += STEP) {
    const a = at(s);
    const b = at(Math.min(length, s + STEP));
    for (const side of [-1, 1] as const)
      pushSide(
        out,
        a,
        b,
        w * side,
        -0.02,
        -0.02,
        -spec.deck,
        -spec.deck,
        side,
        shade(spec.body, 0.92),
      );
    pushSoffit(out, a, b, w, -spec.deck, -spec.deck, shade(spec.body, 0.7));
    // Trottoir sur le bas-côté : sans lui, l'herbe du bas-côté faisait croire à un mur posé à côté de la route.
    const inner = w - (style === "stone" ? 0.45 : 0.35);
    if (inner > span.roadHalfWidth)
      for (const side of [-1, 1] as const)
        pushQuad(
          out,
          [
            offset(a, span.roadHalfWidth * side, SIDEWALK_LIFT),
            offset(b, span.roadHalfWidth * side, SIDEWALK_LIFT),
            offset(b, inner * side, SIDEWALK_LIFT),
            offset(a, inner * side, SIDEWALK_LIFT),
          ],
          UP,
          spec.trim,
        );
  }
};

/** Face de bout entre deux décalages latéraux, tournée vers l'avant (+1) ou l'arrière (-1) de la route. */
const pushEndCap = (
  out: Buffers,
  st: Station,
  from: number,
  to: number,
  top: number,
  bottom: number,
  forward: 1 | -1,
  color: Rgb,
): void =>
  pushQuad(
    out,
    [
      offset(st, from, bottom),
      offset(st, to, bottom),
      offset(st, to, top),
      offset(st, from, top),
    ],
    [st.dx * forward, 0, st.dz * forward],
    color,
  );

/** Garde-corps maçonné (pierre) ou longrine basse avec lisses sur poteaux (béton, viaduc). */
const pushParapets = (
  out: Buffers,
  span: BridgeSpan,
  style: BridgeStyle,
  spec: StyleSpec,
  length: number,
  at: (s: number) => Station,
): void => {
  const w = span.halfWidth + 0.3;
  // Bouts fermés : sans eux, on voyait l'intérieur creux du mur et du tablier en arrivant sur le pont.
  const wall = style === "stone" ? 0.45 : 0.35;
  const top = style === "stone" ? 0.95 : style === "viaduct" ? 0.35 : 0.25;
  for (const [s, forward] of [
    [0, -1],
    [length, 1],
  ] as const) {
    const st = at(s);
    for (const side of [-1, 1])
      pushEndCap(
        out,
        st,
        (w - wall) * side,
        w * side,
        top,
        -0.02,
        forward,
        spec.trim,
      );
    pushEndCap(
      out,
      st,
      -w,
      w,
      -0.02,
      -spec.deck,
      forward,
      shade(spec.body, 0.85),
    );
  }
  for (const side of [-1, 1] as const) {
    if (style === "stone") {
      for (let s = 0; s < length; s += STEP) {
        const a = at(s);
        const b = at(Math.min(length, s + STEP));
        pushSide(
          out,
          a,
          b,
          (w - 0.45) * side,
          0.95,
          0.95,
          -0.02,
          -0.02,
          -side as 1 | -1,
          spec.trim,
        );
        pushSide(
          out,
          a,
          b,
          w * side,
          0.95,
          0.95,
          -0.02,
          -0.02,
          side,
          spec.body,
        );
        pushQuad(
          out,
          [
            offset(a, (w - 0.45) * side, 0.95),
            offset(b, (w - 0.45) * side, 0.95),
            offset(b, w * side, 0.95),
            offset(a, w * side, 0.95),
          ],
          UP,
          spec.trim,
        );
      }
      continue;
    }
    const curb = style === "viaduct" ? 0.35 : 0.25;
    for (let s = 0; s < length; s += STEP) {
      const a = at(s);
      const b = at(Math.min(length, s + STEP));
      pushSide(
        out,
        a,
        b,
        (w - 0.35) * side,
        curb,
        curb,
        -0.02,
        -0.02,
        -side as 1 | -1,
        spec.body,
      );
      pushQuad(
        out,
        [
          offset(a, (w - 0.35) * side, curb),
          offset(b, (w - 0.35) * side, curb),
          offset(b, w * side, curb),
          offset(a, w * side, curb),
        ],
        UP,
        spec.body,
      );
    }
    if (style === "steel") continue;
    // Lisses et poteaux métalliques
    const rail = (w - 0.18) * side;
    for (let s = 0; s <= length; s += 2.5)
      pushBeam(
        out,
        offset(at(s), rail, curb),
        offset(at(s), rail, 1.05),
        0.05,
        spec.trim,
      );
    // Une lisse par intervalle entre deux poteaux : elle suit la courbe du tablier au lieu de couper la route.
    for (const h of [0.65, 1.05])
      for (let s = 0; s < length; s += 2.5)
        pushBeam(
          out,
          offset(at(s), rail, h),
          offset(at(Math.min(s + 2.5, length)), rail, h),
          0.05,
          spec.trim,
        );
  }
};

/** Piles régulières (béton, viaduc, métal) et culées aux deux bouts. */
const pushPiers = (
  out: Buffers,
  span: BridgeSpan,
  style: BridgeStyle,
  spec: StyleSpec,
  length: number,
  at: (s: number) => Station,
): void => {
  const w = span.halfWidth + 0.3;
  const spacing = style === "viaduct" ? 30 : style === "steel" ? 45 : 18;
  const count = Math.max(0, Math.round(length / spacing) - 1);
  for (let k = 1; k <= count; k++) {
    const st = at((length * k) / (count + 1));
    if (style === "viaduct") {
      // Deux fûts ronds sous un chevêtre
      const top = st.p[1] - spec.deck;
      for (const side of [-1, 1]) {
        const base = offset(st, side * w * 0.45, 0);
        const ground = span.groundAt(base[0], base[2]) - 1;
        pushBeam(
          out,
          [base[0], ground, base[2]],
          [base[0], top - 0.8, base[2]],
          0.9,
          shade(spec.body, 0.95),
          8,
        );
      }
      pushPier(out, span, st, 0.7, w * 0.85, -spec.deck, spec.body);
    } else
      pushPier(
        out,
        span,
        st,
        style === "steel" ? 0.6 : 0.8,
        w * 0.75,
        -spec.deck,
        shade(spec.body, 0.95),
      );
  }
  for (const s of [0.6, length - 0.6])
    pushPier(out, span, at(s), 0.6, w, -spec.deck, shade(spec.body, 0.85));
};

/** Arches de pierre : tympans pleins sur les côtés, voûte en dessous, piles entre deux arches. */
const pushArches = (
  out: Buffers,
  span: BridgeSpan,
  spec: StyleSpec,
  length: number,
  at: (s: number) => Station,
): void => {
  const w = span.halfWidth + 0.3;
  const count = Math.max(1, Math.round(length / 14));
  const pier = 1.4;
  const arch = (length - pier * (count - 1)) / count;
  for (let k = 0; k < count; k++) {
    const from = k * (arch + pier);
    const to = from + arch;
    const mid = (from + to) / 2;
    // Hauteur libre sous la clé : jamais sous le sol au milieu de l'arche
    const crown = -spec.deck - 0.3;
    const clearance =
      at(mid).p[1] + crown - span.groundAt(at(mid).p[0], at(mid).p[2]);
    const rise = Math.max(0.5, Math.min(arch / 2, clearance - 0.3));
    const curve = (s: number): number =>
      crown -
      rise * (1 - Math.sqrt(Math.max(0, 1 - ((s - mid) / (arch / 2)) ** 2)));
    for (let s = from; s < to; s += STEP / 2) {
      const e = Math.min(to, s + STEP / 2);
      const a = at(s);
      const b = at(e);
      for (const side of [-1, 1] as const)
        pushSide(
          out,
          a,
          b,
          w * side,
          -spec.deck,
          -spec.deck,
          curve(s),
          curve(e),
          side,
          spec.body,
        );
      pushSoffit(out, a, b, w, curve(s), curve(e), shade(spec.body, 0.6));
    }
    if (k < count - 1)
      pushPier(
        out,
        span,
        at(to + pier / 2),
        pier / 2,
        w,
        // Jusqu'au tablier : arrêtée à la naissance de l'arche, elle laissait un trou entre deux voûtes.
        -spec.deck,
        shade(spec.body, 0.9),
      );
  }
  for (const s of [0.6, length - 0.6])
    pushPier(out, span, at(s), 0.6, w, -spec.deck, shade(spec.body, 0.85));
};

/** Treillis peint de part et d'autre, du tablier jusqu'à 3,5 m au-dessus de la chaussée. */
const pushTruss = (
  out: Buffers,
  span: BridgeSpan,
  spec: StyleSpec,
  length: number,
  at: (s: number) => Station,
): void => {
  const w = span.halfWidth + 0.45;
  const height = 3.5;
  const panel = Math.max(3, length / Math.max(1, Math.round(length / 4.5)));
  for (const side of [-1, 1]) {
    const low = (s: number): Vec3 => offset(at(s), w * side, 0.2);
    const high = (s: number): Vec3 => offset(at(s), w * side, height);
    pushBeam(out, low(0), low(length), 0.18, spec.trim);
    pushBeam(out, high(panel), high(length - panel), 0.18, spec.trim);
    pushBeam(out, low(0), high(panel), 0.14, spec.trim);
    pushBeam(out, low(length), high(length - panel), 0.14, spec.trim);
    for (let s = panel, k = 0; s < length - panel / 2; s += panel, k++) {
      pushBeam(out, low(s), high(s), 0.1, spec.trim);
      const next = Math.min(length - panel, s + panel);
      if (next > s)
        pushBeam(
          out,
          k % 2 ? low(s) : high(s),
          k % 2 ? high(next) : low(next),
          0.08,
          spec.trim,
        );
    }
  }
  // Entretoises hautes entre les deux poutres
  for (let s = panel; s < length - panel / 2; s += panel)
    pushBeam(
      out,
      offset(at(s), -w, height),
      offset(at(s), w, height),
      0.08,
      spec.trim,
    );
};

/** Tout l'ouvrage d'un pont, sans la chaussée. `null` si l'axe est trop court. */
export const bridgeGeometry = (
  span: BridgeSpan,
  style: BridgeStyle,
): BufferGeometry | null => {
  const { length, at } = sampler(span.points);
  if (length < 2) return null;
  const spec = STYLE_SPECS[style];
  const out = createBuffers();
  pushDeck(out, span, style, spec, length, at);
  pushParapets(out, span, style, spec, length, at);
  if (style === "stone") pushArches(out, span, spec, length, at);
  else pushPiers(out, span, style, spec, length, at);
  if (style === "steel") pushTruss(out, span, spec, length, at);
  return out.positions.length > 0 ? toGeometry(out) : null;
};
