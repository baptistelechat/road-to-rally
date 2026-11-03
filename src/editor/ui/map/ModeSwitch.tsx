"use client";

import { Move, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { editorStore, useEditor, type MapMode } from "../../store";

const OPTIONS: {
  id: MapMode;
  label: string;
  hint: string;
  Icon: typeof Move;
}[] = [
  {
    id: "edit",
    label: "Éditer",
    hint: "Un clic pose un point, le tracé se glisse pour ajouter un passage, un clic droit pose une chicane",
    Icon: Pencil,
  },
  {
    id: "move",
    label: "Déplacer",
    hint: "Seuls les points et les chicanes se glissent : aucun clic ne crée rien",
    Icon: Move,
  },
];

/** Séparer créer et déplacer : en glissant un point, on ne peut plus en créer un par erreur. */
export const ModeSwitch = () => {
  const mode = useEditor((state) => state.mapMode);
  return (
    <div
      role="group"
      aria-label="Mode de la carte"
      className="absolute top-2 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-lg border bg-background p-1 shadow-md"
    >
      {OPTIONS.map(({ id, label, hint, Icon }) => (
        <Button
          key={id}
          size="sm"
          variant={id === mode ? "secondary" : "ghost"}
          aria-pressed={id === mode}
          title={hint}
          onClick={() => editorStore.setState({ mapMode: id })}
        >
          <Icon aria-hidden="true" />
          {label}
        </Button>
      ))}
    </div>
  );
};
