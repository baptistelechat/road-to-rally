"use client";

import { useRef, useState } from "react";
import { IMPORT_OPTION, IMPORTED_MAP_ID, MAPS, mapSearch } from "@/game/maps";
import type { ImportedStage } from "@/game/useStageImport";
import { label, menuFocus } from "../hudStyles";
import { StageImportPanel } from "./StageImportPanel";

interface MapSelectProps {
  map: string;
  /** Libellé de la carte en cours : le nom de la spéciale si elle est importée */
  mapLabel: string;
  onImported: (stage: ImportedStage) => void;
}

/**
 * Liste maison plutôt qu'un `select` natif : celui-ci ne s'ouvre pas depuis une manette.
 * Changer de carte recharge la page : l'ancien monde Rapier et l'audio sont libérés sans code de plus.
 * Seule une spéciale importée remplace la carte sur place : son tracé n'a pas d'URL.
 */
export const MapSelect = ({ map, mapLabel, onImported }: MapSelectProps) => {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  const close = (): void => {
    setOpen(false);
    toggle.current?.focus();
  };

  const choose = (id: string): void => {
    if (id === map) close();
    else if (id === IMPORT_OPTION) {
      setOpen(false);
      setImporting(true);
    } else window.location.assign(mapSearch(id));
  };

  const options = [
    ...MAPS.map(({ id, label: name }) => ({ id, name })),
    ...(map === IMPORTED_MAP_ID ? [{ id: map, name: mapLabel }] : []),
    { id: IMPORT_OPTION, name: "Import GPX" },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={label}>Carte</span>
        <div
          role="group"
          aria-label="Choix de la carte"
          className="relative"
          // Garde le focus pendant le clic : Safari ne le donne pas aux boutons, et le blur fermerait la liste.
          onMouseDown={(event) => event.preventDefault()}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !open) return;
            // Sinon Échap fermerait aussi le menu.
            event.stopPropagation();
            close();
          }}
        >
          <button
            ref={toggle}
            type="button"
            aria-label={`Carte : ${mapLabel}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={`flex max-w-40 items-center gap-2 rounded border border-white/25 bg-neutral-900 px-2 py-0.5 text-xs font-semibold ${menuFocus}`}
            onClick={() => (open ? close() : setOpen(true))}
          >
            <span className="truncate">{mapLabel}</span>
            <span aria-hidden="true">▾</span>
          </button>
          {open && (
            <div
              role="listbox"
              aria-label="Carte"
              className="absolute top-full right-0 z-10 mt-1 flex w-40 flex-col gap-1 rounded border border-white/25 bg-neutral-900 p-1"
            >
              {options.map(({ id, name }) => (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={id === map}
                  autoFocus={id === map}
                  className={`truncate rounded px-2 py-1 text-left text-xs font-semibold hover:bg-white/15 ${id === map ? "text-amber-400" : ""} ${menuFocus}`}
                  onClick={() => choose(id)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
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
