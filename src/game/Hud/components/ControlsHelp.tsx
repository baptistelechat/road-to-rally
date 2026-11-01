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

export const ControlsHelp = ({ closed }: { closed: boolean }) => {
  const device = useHudStore((s) => s.device);
  const restart = closed ? "Relancer le tour" : "Relancer";
  const help =
    device === "gamepad" ? gamepadHelp(restart) : keyboardHelp(restart);
  return (
    <dl
      aria-label="Commandes"
      className={`${panel} hidden grid-cols-[auto_auto] gap-x-3 gap-y-0.5 px-3 py-2 text-xs sm:grid`}
    >
      {help.map(([key, action]) => (
        <div key={key} className="contents">
          <dt className="font-mono font-semibold text-white">{key}</dt>
          <dd className="text-white/70">{action}</dd>
        </div>
      ))}
    </dl>
  );
};
