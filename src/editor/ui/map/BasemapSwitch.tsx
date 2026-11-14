"use client";

import { Moon, Route, Satellite, Sun } from "lucide-react";
import { mapSurface, segmentButton } from "../styles";
import { useBasemap, useRoads, type BasemapId } from "./basemaps";

const OPTIONS: { id: BasemapId; label: string; Icon: typeof Moon }[] = [
  { id: "light", label: "Clair", Icon: Sun },
  { id: "dark", label: "Sombre", Icon: Moon },
  { id: "satellite", label: "Satellite", Icon: Satellite },
];

interface BasemapSwitchProps {
  value: BasemapId;
  onChange: (id: BasemapId) => void;
}

export const BasemapSwitch = ({
  value,
  onChange,
}: BasemapSwitchProps) => (
  <div
    role="group"
    aria-label="Fond de carte"
    className={`absolute top-4 right-4 z-10 flex gap-0.5 rounded-lg p-1 shadow-md ${mapSurface}`}
  >
    {OPTIONS.map(({ id, label, Icon }) => (
      <button
        key={id}
        type="button"
        className={segmentButton(id === value)}
        aria-pressed={id === value}
        onClick={() => onChange(id)}
      >
        <Icon aria-hidden="true" />
        {label}
      </button>
    ))}
  </div>
);

/** Routes OSM sur la photo, ou la photo seule : n'existe que sur le satellite. */
export const RoadsToggle = () => {
  const basemap = useBasemap();
  const { showRoads, setShowRoads } = useRoads();
  if (basemap !== "satellite") return null;
  return (
    <button
      type="button"
      className={segmentButton(showRoads)}
      aria-pressed={showRoads}
      title="Routes sur la photo"
      onClick={() => setShowRoads(!showRoads)}
    >
      <Route aria-hidden="true" />
      Routes
    </button>
  );
};
