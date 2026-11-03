"use client";

import { Moon, Satellite, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BasemapId } from "./basemaps";

const OPTIONS: { id: BasemapId; label: string; Icon: typeof Moon }[] = [
  { id: "satellite", label: "Satellite", Icon: Satellite },
  { id: "light", label: "Clair", Icon: Sun },
  { id: "dark", label: "Sombre", Icon: Moon },
];

interface BasemapSwitchProps {
  value: BasemapId;
  onChange: (id: BasemapId) => void;
}

export const BasemapSwitch = ({ value, onChange }: BasemapSwitchProps) => (
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
