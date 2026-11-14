import type { ResultSector } from "@/game/hudStore";
import { label } from "../hudStyles";
import { deltaColor, formatLap, formatSignedLap } from "../formatTime";

interface StageResultTableProps {
  sectors: readonly ResultSector[];
  totalMs: number;
  /** Écart au record d'avant cette course, `null` sans record */
  deltaMs: number | null;
  penaltyMs: number;
}

const Delta = ({ ms }: { ms: number | null }) =>
  ms === null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className={deltaColor(ms)}>{formatSignedLap(ms)}</span>
  );

const cell = "py-1.5 text-right font-mono tabular-nums";

/**
 * Temps secteur par secteur, puis leur somme : le temps final et son écart au record. Les pénalités sont comprises
 * dans le secteur où elles sont tombées, comme sur la frise : la somme fait bien le temps final.
 */
export const StageResultTable = ({
  sectors,
  totalMs,
  deltaMs,
  penaltyMs,
}: StageResultTableProps) => (
  <table className="w-full border-collapse text-sm">
    <caption className="sr-only">Temps par secteur et écart au record</caption>
    <thead>
      <tr className="border-b border-border">
        <th scope="col" className={`${label} py-1.5 text-left font-normal`}>
          Secteur
        </th>
        <th scope="col" className={`${label} py-1.5 text-right font-normal`}>
          Temps
        </th>
        <th scope="col" className={`${label} py-1.5 text-right font-normal`}>
          Écart
        </th>
      </tr>
    </thead>
    <tbody className="text-lg">
      {sectors.map((sector, i) => (
        <tr key={i}>
          <th scope="row" className="py-1.5 text-left font-normal">
            <span className="inline-grid size-7 place-items-center bg-accent font-mono">
              {i + 1}
            </span>
          </th>
          <td className={cell}>{formatLap(sector.ms)}</td>
          <td className={cell}>
            <Delta ms={sector.deltaMs} />
          </td>
        </tr>
      ))}
    </tbody>
    <tfoot>
      <tr className="border-t border-foreground/30">
        <th scope="row" className="py-1.5 text-left text-base font-extrabold">
          Total
        </th>
        <td className={`${cell} text-xl`}>{formatLap(totalMs)}</td>
        <td className={`${cell} text-lg`}>
          <Delta ms={deltaMs} />
        </td>
      </tr>
      <tr>
        <th
          scope="row"
          className="py-1.5 text-left text-[0.8rem] font-semibold text-muted-foreground"
        >
          Dont pénalités
        </th>
        <td
          className={`${cell} text-base ${penaltyMs > 0 ? "text-destructive" : "text-muted-foreground"}`}
        >
          {penaltyMs > 0 ? formatSignedLap(penaltyMs) : "Aucune"}
        </td>
        <td />
      </tr>
    </tfoot>
  </table>
);
