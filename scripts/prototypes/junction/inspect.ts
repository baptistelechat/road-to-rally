// Ce que BRouter renvoie vraiment : écart entre aller et retour, longueur du tour, rayon réel.
import { CASES } from "./record";
import { polylineLength, readRoute, splitLollipop } from "./geometry";

for (const c of CASES) {
  const r = readRoute(c.name, c.ring);
  const total = polylineLength(r.points);
  for (const tol of [1, 3, 5]) {
    const s = splitLollipop(r, tol);
    console.log(
      `${c.name} seuil ${tol} m : total ${total.toFixed(0)} m, séparation à ${s.forkS} m, boucle ${polylineLength(s.loop).toFixed(0)} m, rayon ajusté ${s.ring.r.toFixed(1)} m`,
    );
  }
  const s = splitLollipop(r, 1);
  const maxGap = s.gaps.reduce((m, g) => Math.max(m, g.gap), 0);
  const every = s.gaps
    .filter((g) => g.s % 10 === 0)
    .map((g) => `${g.s}:${g.gap.toFixed(1)}`);
  console.log(
    `  écart max ${maxGap.toFixed(1)} m ; abscisse:écart`,
    every.join(" "),
  );
}
