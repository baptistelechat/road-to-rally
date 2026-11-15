"use client";

import { useHudStore } from "@/game/hudStore";
import { InputPrompt } from "@/input/InputPrompt";
import { type PromptAction, promptIcons } from "@/input/inputPrompts";
import { usePromptDevice, usePromptDeviceStore } from "@/input/promptDevice";
import { RESPAWN_HOLD_S } from "@/sim/recovery";
import { panel } from "../hudStyles";

type Row = readonly [PromptAction, string];

const help = (restart: string): readonly Row[] => [
  ["steer", "Diriger"],
  ["pedals", "Gaz / Frein, marche arrière"],
  ["lookAround", "Tourner la caméra"],
  ["handbrake", "Frein à main"],
  ["respawn", `Maintenir : remise en piste (${RESPAWN_HOLD_S} s)`],
  ["restart", restart],
  ["camera", "Vue"],
  ["mute", "Son"],
  ["pause", "Pause et cartes"],
];

const Column = ({ rows }: { rows: readonly Row[] }) => (
  <dl className="grid grid-cols-[auto_auto] content-start items-center gap-x-3 gap-y-1">
    {rows.map(([action, role]) => (
      <div key={action} className="contents">
        <dt className="flex justify-end">
          <InputPrompt action={action} size="sm" />
        </dt>
        <dd className="text-muted-foreground">{role}</dd>
      </div>
    ))}
  </dl>
);

/**
 * Masqué si le joueur l'a coupé dans les options. Une action absente de l'appareil n'a pas de ligne.
 * Deux colonnes : moitié moins haut, la frise verticale laisse peu de place à gauche.
 */
export const ControlsHelp = ({ closed }: { closed: boolean }) => {
  const device = usePromptDevice();
  const layout = usePromptDeviceStore((s) => s.layout);
  const enabled = useHudStore((s) => s.copilotOptions.controlsHelpEnabled);
  if (!enabled) return null;
  const rows = help(closed ? "Relancer le tour" : "Relancer").filter(
    ([action]) => promptIcons(action, device, layout).length > 0,
  );
  const half = Math.ceil(rows.length / 2);
  return (
    <section
      aria-label="Commandes"
      className={`${panel} hidden gap-6 px-3 py-2 text-xs sm:flex`}
    >
      <Column rows={rows.slice(0, half)} />
      <Column rows={rows.slice(half)} />
    </section>
  );
};
