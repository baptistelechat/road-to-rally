"use client";

import { useEffect, useRef } from "react";
import type { CarInput } from "../sim/types";
import type { InputController } from "./inputController";

const REFRESH_MS = 100;

interface InputDebugProps {
  controller: InputController;
  /** Dernière entrée échantillonnée par la boucle : le panneau n'appelle jamais `sample` */
  getInput: () => Readonly<CarInput>;
}

const describeDevice = (controller: InputController): string => {
  const device =
    controller.activeDevice() === "gamepad" ? "manette" : "clavier";
  // La Gamepad API ne révèle souvent la manette qu'après une première pression.
  const hint = controller.gamepadConnected()
    ? "manette détectée"
    : "manette : appuyer sur un bouton pour la détecter";
  return `${device} (${hint})`;
};

export const InputDebug = ({ controller, getInput }: InputDebugProps) => {
  const output = useRef<HTMLPreElement>(null);

  // Écriture directe dans le DOM : aucun rendu React à chaque rafraîchissement.
  useEffect(() => {
    const refresh = (): void => {
      if (!output.current) return;
      const { steer, throttle, brake, handbrake } = getInput();
      output.current.textContent = [
        `direction  ${steer.toFixed(2).padStart(5)}`,
        `gaz        ${throttle.toFixed(2).padStart(5)}`,
        `frein      ${brake.toFixed(2).padStart(5)}`,
        `frein main ${handbrake ? "  oui" : "  non"}`,
        describeDevice(controller),
      ].join("\n");
    };
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(interval);
  }, [controller, getInput]);

  return (
    <div
      aria-label="Débogage des entrées"
      className="pointer-events-none fixed left-2 top-2 rounded bg-black/70 p-2 font-mono text-xs text-white"
    >
      <pre ref={output} />
      <p className="mt-1 text-white/60">
        Flèches ou ZQSD (WASD en QWERTY), Espace : frein à main
      </p>
    </div>
  );
};
