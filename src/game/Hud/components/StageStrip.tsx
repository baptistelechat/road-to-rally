interface StageStripProps {
  /** Intermédiaires, en fraction de la spéciale (0 = départ, 1 = arrivée), croissants */
  gates: readonly number[];
  /** Un par secteur (gates.length + 1). `undefined` : pas encore terminé ; `null` : terminé sans référence ; nombre : écart au record en ms, négatif = plus rapide */
  sectorDeltas: readonly (number | null | undefined)[];
  /** Position de la voiture, fraction 0..1 */
  carFraction: number;
  /** Position du fantôme, fraction 0..1, `null` sans fantôme */
  ghostFraction: number | null;
}

const percent = (fraction: number): string =>
  `${Math.min(1, Math.max(0, fraction)) * 100}%`;

const sectorColor = (
  delta: number | null | undefined,
  current: boolean,
): string => {
  if (delta === undefined) return current ? "bg-white/60" : "bg-white/20";
  if (delta === null) return "bg-white/85";
  return delta <= 0 ? "bg-emerald-500" : "bg-red-500";
};

/** Damier de l'arrivée, sans image */
const CHECKER = {
  background: "repeating-conic-gradient(#000 0 25%, #fff 0 50%) 0 0 / 50% 50%",
};

/** Frise verticale façon WRC, départ en bas, arrivée en haut. Les positions changent à ~10 Hz : aucune transition CSS. */
export const StageStrip = ({
  gates,
  sectorDeltas,
  carFraction,
  ghostFraction,
}: StageStripProps) => {
  const bounds = [0, ...gates, 1];
  const current = sectorDeltas.findIndex((delta) => delta === undefined);
  const done = sectorDeltas.filter((delta) => delta !== undefined);
  const ahead = done.filter((delta) => delta !== null && delta <= 0).length;
  const behind = done.filter((delta) => delta !== null && delta > 0).length;
  // Ne dépend que des secteurs terminés : il change à chaque intermédiaire, pas à chaque image.
  const summary = `Spéciale en ${bounds.length - 1} secteurs : ${done.length} terminés, ${ahead} en avance, ${behind} en retard sur le record`;

  return (
    <div
      role="img"
      aria-label={summary}
      className="pointer-events-none absolute top-1/2 left-4 h-72 w-5 -translate-y-1/2 drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]"
    >
      {bounds.slice(1).map((to, i) => (
        <div
          key={to}
          className={`absolute left-1/2 w-1 -translate-x-1/2 ${sectorColor(sectorDeltas[i], i === current)}`}
          style={{
            bottom: percent(bounds[i]),
            height: percent(to - bounds[i]),
          }}
        />
      ))}
      {gates.map((gate) => (
        <div
          key={gate}
          className="absolute left-1/2 h-0.5 w-3 -translate-x-1/2 translate-y-1/2 bg-white"
          style={{ bottom: percent(gate) }}
        />
      ))}
      <div className="absolute bottom-0 left-1/2 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border border-black bg-green-500" />
      <div
        className="absolute top-0 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 border border-black"
        style={CHECKER}
      />
      {ghostFraction !== null && (
        <div
          className="absolute left-1/2 size-3 -translate-x-1/2 translate-y-1/2 rounded-full border border-white/70 bg-white/40"
          style={{ bottom: percent(ghostFraction) }}
        />
      )}
      <div
        className="absolute left-1/2 size-3 -translate-x-1/2 translate-y-1/2 rounded-full border border-black bg-amber-400"
        style={{ bottom: percent(carFraction) }}
      />
    </div>
  );
};
