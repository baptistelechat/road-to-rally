"use client";

import { useState } from "react";
import { readDraftStage } from "@/editor/draft";
import {
  CUSTOM_MAP_ID,
  EDITOR_OPTION,
  EDITOR_TRACE_URL,
  EDITOR_URL,
  IMPORT_OPTION,
  IMPORTED_MAP_ID,
  MAPS,
  mapSearch,
} from "@/game/maps";
import type { ImportedStage } from "@/game/useStageImport";
import { hudButton, menuFocus } from "../hudStyles";
import { MenuSelect } from "./MenuSelect";
import { StageImportPanel } from "./StageImportPanel";

/** Retour sur la carte si le brouillon est bien le tracé de cette spéciale, sinon à l'accueil de l'éditeur. */
const editorReturnUrl = (): string =>
  new URLSearchParams(window.location.search).get("stage") === readDraftStage()
    ? EDITOR_TRACE_URL
    : EDITOR_URL;

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
    ...(map === IMPORTED_MAP_ID || map === CUSTOM_MAP_ID
      ? [{ id: map, name: mapLabel }]
      : []),
    { id: IMPORT_OPTION, name: "Import GPX" },
    { id: EDITOR_OPTION, name: "Editor" },
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
          }
          // Une vraie navigation : la scène 3D et son contexte WebGL sont libérés avant la carte de l'éditeur.
          else if (id === EDITOR_OPTION)
            window.location.assign(`${window.location.origin}/editor`);
          else window.location.assign(mapSearch(id));
        }}
      />
      {map === CUSTOM_MAP_ID && (
        <button
          type="button"
          className={`${hudButton} ${menuFocus} w-full`}
          // Une vraie navigation : la scène 3D est libérée avant la carte, et le brouillon attend dans `localStorage`.
          onClick={() => {
            window.location.href = editorReturnUrl();
          }}
        >
          Retour à l&apos;éditeur
        </button>
      )}
      {importing && (
        <StageImportPanel
          onClose={() => setImporting(false)}
          onReady={onImported}
        />
      )}
    </>
  );
};
