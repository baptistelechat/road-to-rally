"use client";

import { useHudStore } from "@/game/hudStore";
import { RESPAWN_HOLD_S } from "@/sim/recovery";
import { panel } from "../hudStyles";

type Help = readonly (readonly [string, string])[];

const keyboardHelp = (restart: string): Help => [
  ["Flèches / ZQSD", "Conduire"],
  ["Espace", "Frein à main"],
  ["R maintenu", `Remise en piste (${RESPAWN_HOLD_S} s)`],
  ["Retour arrière", restart],
  ["C", "Vue"],
  ["M", "Son"],
  ["Échap", "Pause et cartes"],
  ["F9", "Signaler un lag"],
];

const gamepadHelp = (restart: string): Help => [
  ["Stick gauche", "Diriger"],
  ["Stick droit", "Tourner la caméra"],
  ["RT / LT", "Gaz / Frein, marche arrière"],
  ["A", "Frein à main"],
  ["Y maintenu", `Remise en piste (${RESPAWN_HOLD_S} s)`],
  ["Select", restart],
  ["X", "Vue"],
  ["Start", "Pause et cartes"],
  ["LB", "Signaler un lag"],
];

/** Masqué si le joueur l'a coupé dans les options. */
export const ControlsHelp = ({ closed }: { closed: boolean }) => {
  const device = useHudStore((s) => s.device);
  const enabled = useHudStore((s) => s.copilotOptions.controlsHelpEnabled);
  if (!enabled) return null;
  const restart = closed ? "Relancer le tour" : "Relancer";
  const help =
    device === "gamepad" ? gamepadHelp(restart) : keyboardHelp(restart);
  return (
    <dl
      aria-label="Commandes"
      className={`${panel} hidden grid-cols-[auto_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-xs sm:grid`}
    >
      {help.map(([key, action]) => (
        <div key={key} className="contents">
          <dt>
            <kbd className="rounded-sm border border-input bg-secondary px-1 font-mono text-[0.6875rem] text-secondary-foreground">
              {key}
            </kbd>
          </dt>
          <dd className="text-muted-foreground">{action}</dd>
        </div>
      ))}
    </dl>
  );
};
