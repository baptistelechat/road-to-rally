"use client";

import { Moon, Route, Satellite, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    className="absolute top-2 right-2 z-10 flex gap-1 rounded-lg border bg-background p-1 shadow-md"
  >
    {OPTIONS.map(({ id, label, Icon }) => (
      <Button
        key={id}
        size="sm"
        variant={id === value ? "secondary" : "ghost"}
        aria-pressed={id === value}
        onClick={() => onChange(id)}
      >
        <Icon aria-hidden="true" />
        {label}
      </Button>
    ))}
  </div>
);

/** Routes OSM sur la photo, ou la photo seule : n'existe que sur le satellite. */
export const RoadsToggle = () => {
  const basemap = useBasemap();
  const { showRoads, setShowRoads } = useRoads();
  if (basemap !== "satellite") return null;
  return (
    <Button
      size="sm"
      variant={showRoads ? "secondary" : "ghost"}
      aria-pressed={showRoads}
      title="Routes sur la photo"
      onClick={() => setShowRoads(!showRoads)}
    >
      <Route aria-hidden="true" />
      Routes
    </Button>
  );
};
