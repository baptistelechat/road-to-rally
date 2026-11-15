"use client";

import {
  FAR_BUDGET,
  NEAR_SHARE,
  VILLAGE_SIZE,
  type VillageStats,
  formatCount,
} from "./stats";

interface TrianglesTableProps {
  stats: VillageStats;
}

/** Triangles par bâtiment, en proche et en lointain, et ce que coûte un village entier. */
export const TrianglesTable = ({ stats }: TrianglesTableProps) => {
  const mixed =
    NEAR_SHARE * stats.averageNear + (1 - NEAR_SHARE) * stats.averageFar;
  const withinBudget = stats.averageFar <= FAR_BUDGET;
  return (
    <section aria-labelledby="triangles-title" className="space-y-2">
      <h2 id="triangles-title" className="text-sm font-semibold">
        Triangles par bâtiment
      </h2>
      <table className="w-full text-left text-xs">
        <caption className="sr-only">
          Triangles par bâtiment pour chaque variante, et coût de {VILLAGE_SIZE}{" "}
          bâtiments en lointain
        </caption>
        <thead className="text-neutral-400">
          <tr>
            <th scope="col" className="py-1 font-normal">
              Variante
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              Proche
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              Lointain
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              ×{VILLAGE_SIZE} loin.
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.rows.map(({ typology, variants }) =>
            variants.map((v, i) => (
              <tr
                key={v.variant.id}
                className={i === 0 ? "border-t border-neutral-700" : ""}
              >
                <th scope="row" className="py-0.5 pr-2 font-normal">
                  {i === 0 && (
                    <span className="block text-neutral-400">
                      {typology.label}
                    </span>
                  )}
                  {i === 0 ? "A" : "B"} · {v.variant.label}
                </th>
                <td className="text-right tabular-nums">
                  {formatCount(v.near)}
                </td>
                <td
                  className={`text-right tabular-nums ${v.far > FAR_BUDGET ? "text-amber-400" : ""}`}
                >
                  {formatCount(v.far)}
                </td>
                <td className="text-right tabular-nums text-neutral-400">
                  {formatCount(v.far * VILLAGE_SIZE)}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 rounded bg-neutral-800 p-2 text-xs">
        <dt>Moyenne pondérée, lointain</dt>
        <dd
          className={`text-right tabular-nums ${withinBudget ? "text-emerald-400" : "text-amber-400"}`}
        >
          {formatCount(stats.averageFar)} (budget {FAR_BUDGET})
        </dd>
        <dt>Moyenne pondérée, proche</dt>
        <dd className="text-right tabular-nums">
          {formatCount(stats.averageNear)}
        </dd>
        <dt>Village de {VILLAGE_SIZE}, tout en lointain</dt>
        <dd className="text-right tabular-nums">
          {formatCount(stats.averageFar * VILLAGE_SIZE)}
        </dd>
        <dt>Village de {VILLAGE_SIZE}, tout en proche</dt>
        <dd className="text-right tabular-nums">
          {formatCount(stats.averageNear * VILLAGE_SIZE)}
        </dd>
        <dt>Mixte ({Math.round(NEAR_SHARE * 100)} % en proche)</dt>
        <dd className="text-right tabular-nums">
          {formatCount(mixed * VILLAGE_SIZE)}
        </dd>
      </dl>
      <p className="text-[11px] text-neutral-400">
        Parts d&apos;un village type : pavillons 40 %, bourg 20 %, annexes 12,5
        %, longères 10 %, granges 8 %, activité 4 %, immeubles 2 %, église 1 %,
        silos 1 %, serres 1 %, monuments 0,5 %. Les emprises de repli ne
        comptent pas.
      </p>
    </section>
  );
};
