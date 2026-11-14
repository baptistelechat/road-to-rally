"use client";

import { useState } from "react";
import type { Copilot } from "@/game/copilot";
import { useHudStore } from "@/game/hudStore";
import type { ImportedStage } from "@/game/useStageImport";
import { CopilotOptionsPanel } from "./CopilotOptionsPanel";
import { MenuDrawer } from "./Menu/MenuDrawer";
import { readyRequested } from "./Menu/mapChoices";
import { PauseDrawer } from "./Menu/PauseDrawer";
import { ReadyScreen } from "./Menu/ReadyScreen";
import { StartMenu } from "./Menu/StartMenu";

interface GameMenuProps {
  map: string;
  mapLabel: string;
  /** Tracé en boucle, sinon spéciale d'un départ à une arrivée */
  closed: boolean;
  copilot: Copilot;
  onImported: (stage: ImportedStage) => void;
  onToggleMute: () => void;
}

/** Démonté en course : le menu rouvre toujours sur sa première page. */
const MenuScreens = ({
  paused,
  ...props
}: GameMenuProps & { paused: boolean }) => {
  // `returned` : retour des options, le focus revient sur leur bouton. `ready` : carte changée depuis la pause.
  const [view, setView] = useState<"menu" | "options" | "returned" | "ready">(
    () => (readyRequested() ? "ready" : "menu"),
  );
  if (paused) return <PauseDrawer {...props} />;
  if (view === "ready")
    return (
      <ReadyScreen mapLabel={props.mapLabel} onBack={() => setView("menu")} />
    );
  if (view === "options")
    return (
      <MenuDrawer title="Options" onDismiss={() => setView("returned")}>
        <CopilotOptionsPanel
          copilot={props.copilot}
          autoFocus
          onBack={() => setView("returned")}
        />
      </MenuDrawer>
    );
  return (
    <StartMenu
      map={props.map}
      mapLabel={props.mapLabel}
      returned={view === "returned"}
      onImported={props.onImported}
      onOptions={() => setView("options")}
    />
  );
};

/**
 * Menu de départ et drawer de pause : choix de la carte, options et lancement de la course, gelée derrière.
 * Le premier geste sur ce menu débloque aussi le son : `useGameSession` écoute toute la page.
 */
export const GameMenu = (props: GameMenuProps) => {
  const screen = useHudStore((s) => s.screen);
  if (screen === "race" || screen === "result") return null;
  return <MenuScreens {...props} paused={screen === "pause"} />;
};
