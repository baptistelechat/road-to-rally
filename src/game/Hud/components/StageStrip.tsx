interface StageStripProps {
  /** Intermédiaires, en fraction de la spéciale (0 = départ, 1 = arrivée), croissants */
  gates: readonly number[];
  /** Un par secteur (gates.length + 1). `undefined` : pas encore terminé ; `null` : terminé sans référence ; nombre : écart au record en ms, négatif = plus rapide */
  sectorDeltas: readonly (number | null | undefined)[];
  /** Position de la voiture, fraction 0..1 */
  carFraction: number;
  /** Position du fantôme, fraction 0..1, `null` sans fantôme */
  ghostFraction: number | null;
  /** Position horizontale, alignée sur le bord du HUD */
  leftClass: string;
}

const percent = (fraction: number): string =>
  `${Math.min(1, Math.max(0, fraction)) * 100}%`;

const sectorColor = (
  delta: number | null | undefined,
  current: boolean,
): string => {
  if (delta === undefined) return current ? "bg-foreground/60" : "bg-foreground/20";
  if (delta === null) return "bg-foreground/85";
  return delta <= 0 ? "bg-chart-4" : "bg-destructive";
};

/** Damier de l'arrivée, sans image */
const CHECKER = {
  background:
    "repeating-conic-gradient(var(--background) 0 25%, var(--foreground) 0 50%) 0 0 / 50% 50%",
};

/** Frise verticale façon WRC, départ en bas, arrivée en haut. Les positions changent à ~10 Hz : aucune transition CSS. */
export const StageStrip = ({
  gates,
  sectorDeltas,
  carFraction,
  ghostFraction,
  leftClass,
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
      className={`pointer-events-none absolute top-1/2 ${leftClass} h-80 w-[22px] -translate-y-1/2 drop-shadow-[0_1px_2px_var(--color-background)]`}
    >
      {bounds.slice(1).map((to, i) => (
        // Biseau en haut de chaque secteur : la facette de la DA.
        <div
          key={to}
          className={`absolute left-[7px] w-2 [clip-path:polygon(0_4%,100%_0,100%_100%,0_100%)] ${sectorColor(sectorDeltas[i], i === current)}`}
          style={{
            bottom: percent(bounds[i]),
            height: percent(to - bounds[i]),
          }}
        />
      ))}
      {gates.map((gate) => (
        <div
          key={gate}
          className="absolute left-px h-[3px] w-5 translate-y-1/2 bg-foreground"
          style={{ bottom: percent(gate) }}
        />
      ))}
      <div className="absolute -bottom-2 left-[3px] size-4 bg-chart-4 [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]" />
      <div
        className="absolute -top-[9px] left-0.5 size-[18px]"
        style={CHECKER}
      />
      {ghostFraction !== null && (
        <div
          className="absolute left-1 size-3.5 translate-y-1/2 rounded-full border border-foreground bg-foreground/40"
          style={{ bottom: percent(ghostFraction) }}
        />
      )}
      <div
        className="absolute left-0 h-4 w-[22px] translate-y-1/2 bg-brand [clip-path:polygon(50%_0,100%_100%,0_100%)]"
        style={{ bottom: percent(carFraction) }}
      />
    </div>
  );
};
