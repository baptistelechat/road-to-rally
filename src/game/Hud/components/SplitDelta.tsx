import { label } from "../hudStyles";
import { formatLap, formatSignedLap } from "../formatTime";

interface SplitDeltaProps {
  /** Rang de l'intermédiaire, à partir de 0. `null` : rien à afficher, la zone annoncée reste montée. */
  index: number | null;
  /** Temps de passage en ms */
  timeMs: number;
  /** Écart au record, négatif = plus rapide. `null` sans record. */
  deltaMs: number | null;
}

/** Temps de passage dans une plaque facettée, et l'écart au record sur fond vert (devant) ou rouge (derrière), façon WRC. */
export const SplitDelta = ({ index, timeMs, deltaMs }: SplitDeltaProps) => (
  // Sous les notes du copilote et le bandeau d'arrivée : position à régler au volant.
  <div aria-live="polite" className="absolute top-40 left-1/2 -translate-x-1/2">
    {index !== null && (
      <div className="w-[220px] bg-background/90 px-[18px] py-2.5 text-center [clip-path:polygon(8%_0,100%_0,92%_100%,0_100%)]">
        <div className={label}>Intermédiaire {index + 1}</div>
        <div className="font-mono text-2xl tabular-nums">
          {formatLap(timeMs)}
        </div>
        {deltaMs !== null ? (
          <div
            className={`mt-1 py-0.5 font-mono text-[26px] text-background tabular-nums ${deltaMs <= 0 ? "bg-chart-4" : "bg-destructive"}`}
          >
            {formatSignedLap(deltaMs)}
            {/* La couleur ne suffit pas : le lecteur d'écran entend le sens. */}
            <span className="sr-only">
              {deltaMs <= 0 ? " d'avance" : " de retard"}
            </span>
          </div>
        ) : (
          <div className="mt-1 text-xs text-muted-foreground">
            Pas encore de record
          </div>
        )}
      </div>
    )}
  </div>
);
