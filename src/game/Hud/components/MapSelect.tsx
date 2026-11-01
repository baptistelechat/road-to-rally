"use client";

import { useState } from "react";
import { IMPORT_OPTION, IMPORTED_MAP_ID, MAPS, mapSearch } from "@/game/maps";
import type { ImportedStage } from "@/game/useStageImport";
import { label } from "../hudStyles";
import { StageImportPanel } from "./StageImportPanel";

interface MapSelectProps {
  map: string;
  /** Libellé de la carte en cours : le nom de la spéciale si elle est importée */
  mapLabel: string;
  onImported: (stage: ImportedStage) => void;
}

/**
 * Changer de carte recharge la page : l'ancien monde Rapier et l'audio sont libérés sans code de plus.
 * Seule une spéciale importée remplace la carte sur place : son tracé n'a pas d'URL.
 */
export const MapSelect = ({ map, mapLabel, onImported }: MapSelectProps) => {
  const [importing, setImporting] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="map-select" className={label}>
          Carte
        </label>
        <select
          id="map-select"
          value={map}
          className="max-w-40 truncate rounded border border-white/25 bg-neutral-900 px-1 py-0.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-amber-400"
          onChange={(event) => {
            const { value } = event.currentTarget;
            // Les touches doivent revenir à la voiture : le contrôleur ignore celles reçues par un `select`.
            // ponytail: re-choisir la même carte ne déclenche aucun événement, le focus reste jusqu'au prochain clic.
            event.currentTarget.blur();
            if (value === IMPORT_OPTION) setImporting(true);
            else window.location.search = mapSearch(value);
          }}
        >
          {MAPS.map(({ id, label: name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
          {map === IMPORTED_MAP_ID && (
            <option value={IMPORTED_MAP_ID}>{mapLabel}</option>
          )}
          <option value={IMPORT_OPTION}>Import GPX</option>
        </select>
      </div>
      {importing && (
        <StageImportPanel
          onClose={() => setImporting(false)}
          onReady={onImported}
        />
      )}
    </>
  );
};
