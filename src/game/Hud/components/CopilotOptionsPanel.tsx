"use client";

import { useEffect, useId, useRef } from "react";
import { createVoicePreview, type VoicePreview } from "@/audio/voicePreview";
import type { Copilot } from "@/game/copilot";
import {
  applyAudioOptions,
  type CopilotOptions,
  type Volume,
} from "@/game/copilotOptions";
import { setCopilotOptions, useHudStore } from "@/game/hudStore";
import { label } from "../hudStyles";
import { drawerButton } from "./Menu/menuStyles";
import {
  ENABLED,
  ENABLED_PLURAL,
  HUD_STYLE_OPTIONS,
  MAP_STYLES,
  SHOWN,
  SPEEDOMETERS,
  VOICES,
} from "./Menu/optionChoices";
import { MenuCards } from "./MenuCards";
import { MenuSelect } from "./MenuSelect";
import { MenuSlider } from "./MenuSlider";

interface CopilotOptionsPanelProps {
  copilot: Copilot;
  /** Focus sur le premier réglage à l'ouverture */
  autoFocus?: boolean;
  /** Sans lui, pas de bouton Retour : les options vivent dans le drawer de pause. */
  onBack?: () => void;
}

/** Tout s'applique aussitôt. Seul un choix du joueur écrit dans le stockage. */
export const CopilotOptionsPanel = ({
  copilot,
  autoFocus,
  onBack,
}: CopilotOptionsPanelProps) => {
  const id = useId();
  const options = useHudStore((s) => s.copilotOptions);
  const muted = useHudStore((s) => s.muted);
  const preview = useRef<VoicePreview | null>(null);

  useEffect(
    () => () => {
      preview.current?.dispose();
      preview.current = null;
    },
    [],
  );
  useEffect(() => {
    if (muted) preview.current?.stop();
  }, [muted]);

  const update = (patch: Partial<CopilotOptions>): CopilotOptions => {
    const next = { ...options, ...patch };
    setCopilotOptions(next);
    applyAudioOptions(copilot, next);
    return next;
  };

  const updateAndListen = (patch: Partial<CopilotOptions>): void => {
    const { voice, voiceVolume } = update(patch);
    if (muted) return;
    preview.current ??= createVoicePreview();
    preview.current.say(voice, voiceVolume / 100);
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        <section
          aria-labelledby={`${id}-display`}
          className="flex flex-col gap-2.5"
        >
          <h2 id={`${id}-display`} className={label}>
            Affichage
          </h2>
          <MenuSelect
            title="Style du HUD"
            autoFocus={autoFocus}
            value={options.hudStyle}
            options={HUD_STYLE_OPTIONS}
            onChoose={(hudStyle) => update({ hudStyle })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <MenuCards
              title="Compteur"
              value={options.speedometerStyle}
              cards={SPEEDOMETERS}
              onChoose={(speedometerStyle) => update({ speedometerStyle })}
            />
            <MenuCards
              title="Mini-carte"
              columns={3}
              value={options.miniMapEnabled ? options.miniMapStyle : "off"}
              cards={MAP_STYLES}
              onChoose={(choice) =>
                update(
                  choice === "off"
                    ? { miniMapEnabled: false }
                    : { miniMapEnabled: true, miniMapStyle: choice },
                )
              }
            />
          </div>
          <MenuSelect
            title="Icônes de virage"
            value={options.paceIconsEnabled}
            options={ENABLED_PLURAL}
            onChoose={(paceIconsEnabled) => update({ paceIconsEnabled })}
          />
          <MenuSelect
            title="Fantôme"
            value={options.ghostEnabled}
            options={ENABLED}
            onChoose={(ghostEnabled) => update({ ghostEnabled })}
          />
          <MenuSelect
            title="Commandes"
            value={options.controlsHelpEnabled}
            options={SHOWN}
            onChoose={(controlsHelpEnabled) => update({ controlsHelpEnabled })}
          />
        </section>
        <section
          aria-labelledby={`${id}-audio`}
          className="flex flex-col gap-2.5"
        >
          <h2 id={`${id}-audio`} className={label}>
            Audio et copilote
          </h2>
          <MenuSelect
            title="Voix du copilote"
            value={options.voiceEnabled}
            options={ENABLED}
            onChoose={(voiceEnabled) => update({ voiceEnabled })}
          />
          <MenuSelect
            title="Voix"
            value={options.voice}
            options={VOICES}
            onChoose={(voice) => updateAndListen({ voice })}
          />
          <MenuSlider
            title="Volume de la voix"
            value={options.voiceVolume}
            onChange={(value) => update({ voiceVolume: value as Volume })}
          />
          <MenuSlider
            title="Volume du moteur"
            value={options.engineVolume}
            onChange={(value) => update({ engineVolume: value as Volume })}
          />
          <MenuSlider
            title="Volume des effets"
            value={options.effectsVolume}
            onChange={(value) => update({ effectsVolume: value as Volume })}
          />
        </section>
      </div>
      {onBack && (
        <button
          type="button"
          data-menu-back=""
          className={`${drawerButton} mt-auto w-full`}
          onClick={onBack}
        >
          Retour
        </button>
      )}
    </>
  );
};
