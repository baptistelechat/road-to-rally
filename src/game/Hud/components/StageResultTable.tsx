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
    <span className="text-white/40">—</span>
  ) : (
    <span className={deltaColor(ms)}>{formatSignedLap(ms)}</span>
  );

const cell = "py-1 font-mono tabular-nums text-right";

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
  <table className="w-full border-t border-white/15 text-sm">
    <caption className="sr-only">Temps par secteur et écart au record</caption>
    <thead>
      <tr>
        <th scope="col" className={`${label} py-1 text-left font-normal`}>
          Secteur
        </th>
        <th scope="col" className={`${label} py-1 text-right font-normal`}>
          Temps
        </th>
        <th scope="col" className={`${label} py-1 text-right font-normal`}>
          Écart
        </th>
      </tr>
    </thead>
    <tbody>
      {sectors.map((sector, i) => (
        <tr key={i}>
          <th scope="row" className="py-1 text-left font-normal">
            {i + 1}
          </th>
          <td className={cell}>{formatLap(sector.ms)}</td>
          <td className={cell}>
            <Delta ms={sector.deltaMs} />
          </td>
        </tr>
      ))}
    </tbody>
    <tfoot className="border-t border-white/30">
      <tr className="text-base font-bold">
        <th scope="row" className="py-1 text-left">
          Total
        </th>
        <td className={cell}>{formatLap(totalMs)}</td>
        <td className={cell}>
          <Delta ms={deltaMs} />
        </td>
      </tr>
      <tr className="text-xs">
        <th scope="row" className="py-1 text-left font-normal text-white/70">
          Dont pénalités
        </th>
        <td className={`${cell} ${penaltyMs > 0 ? "text-red-500" : ""}`}>
          {penaltyMs > 0 ? formatSignedLap(penaltyMs) : "Aucune"}
        </td>
        <td />
      </tr>
    </tfoot>
  </table>
);
