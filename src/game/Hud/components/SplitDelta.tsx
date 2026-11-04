import { label, panel } from "../hudStyles";
import { formatLap, formatSignedLap } from "../formatTime";

interface SplitDeltaProps {
  /** Rang de l'intermédiaire, à partir de 0. `null` : rien à afficher, la zone annoncée reste montée. */
  index: number | null;
  /** Temps de passage en ms */
  timeMs: number;
  /** Écart au record, négatif = plus rapide. `null` sans record. */
  deltaMs: number | null;
}

/** Temps de passage, et l'écart au record en vert (devant) ou rouge (derrière), façon WRC. */
export const SplitDelta = ({ index, timeMs, deltaMs }: SplitDeltaProps) => (
  // Sous les icônes de virage (`top-14`) et le bandeau d'arrivée (`top-16`) : position à régler au volant.
  <div aria-live="polite" className="absolute top-40 left-1/2 -translate-x-1/2">
    {index !== null && (
      <div className={`${panel} px-5 py-2 text-center`}>
        <div className={label}>Intermédiaire {index + 1}</div>
        <div className="font-mono text-xl font-semibold tabular-nums">
          {formatLap(timeMs)}
        </div>
        {deltaMs !== null && (
          <div
            className={`font-mono text-2xl font-bold tabular-nums ${deltaMs <= 0 ? "text-emerald-400" : "text-red-500"}`}
          >
            {formatSignedLap(deltaMs)}
            {/* La couleur ne suffit pas : le lecteur d'écran entend le sens. */}
            <span className="sr-only">
              {deltaMs <= 0 ? " d'avance" : " de retard"}
            </span>
          </div>
        )}
      </div>
    )}
  </div>
);
