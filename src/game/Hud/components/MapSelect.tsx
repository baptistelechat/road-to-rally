"use client";

import { useState } from "react";
import { IMPORT_OPTION, IMPORTED_MAP_ID, MAPS, mapSearch } from "@/game/maps";
import type { ImportedStage } from "@/game/useStageImport";
import { MenuSelect } from "./MenuSelect";
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

  const options = [
    ...MAPS.map(({ id, label: name }) => ({ id, name })),
    ...(map === IMPORTED_MAP_ID ? [{ id: map, name: mapLabel }] : []),
    { id: IMPORT_OPTION, name: "Import GPX" },
  ];

  return (
    <>
      <MenuSelect
        title="Carte"
        groupLabel="Choix de la carte"
        value={map}
        options={options}
        onChoose={(id, close) => {
          if (id === IMPORT_OPTION) {
            // Le champ du panneau d'import prend ensuite le focus.
            close();
            setImporting(true);
          } else window.location.assign(mapSearch(id));
        }}
      />
      {importing && (
        <StageImportPanel
          onClose={() => setImporting(false)}
          onReady={onImported}
        />
      )}
    </>
  );
};
