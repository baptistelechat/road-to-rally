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
import { label, panel } from "../hudStyles";
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
  return (
    <>
      <div
        className={`${panel} pointer-events-auto flex items-center justify-between gap-3 px-3 py-2`}
      >
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
            // Une vraie navigation : la scène 3D et son contexte WebGL sont libérés avant la carte de l'éditeur.
            else if (value === EDITOR_OPTION)
              window.location.assign(`${window.location.origin}/editor`);
            else window.location.search = mapSearch(value);
          }}
        >
          {MAPS.map(({ id, label: name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
          {(map === IMPORTED_MAP_ID || map === CUSTOM_MAP_ID) && (
            <option value={map}>{mapLabel}</option>
          )}
          <option value={IMPORT_OPTION}>Import GPX</option>
          <option value={EDITOR_OPTION}>Editor</option>
        </select>
      </div>
      {map === CUSTOM_MAP_ID && (
        <a
          // Une vraie navigation : la scène 3D est libérée avant la carte, et le brouillon attend dans `localStorage`.
          href={editorReturnUrl()}
          className={`${panel} pointer-events-auto px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-amber-400`}
        >
          Retour à l&apos;éditeur
        </a>
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
