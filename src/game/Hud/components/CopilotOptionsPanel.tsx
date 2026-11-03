"use client";

import { useEffect, useRef } from "react";
import { SPEECH_RATES } from "@/audio/copilotVoice";
import { createVoicePreview, type VoicePreview } from "@/audio/voicePreview";
import type { Copilot } from "@/game/copilot";
import {
  applyAudioOptions,
  type CopilotOptions,
  type MiniMapStyle,
  type SpeechRate,
  type Volume,
} from "@/game/copilotOptions";
import { setCopilotOptions, useHudStore } from "@/game/hudStore";
import { hudButton, menuFocus } from "../hudStyles";
import { type MenuOption, MenuSelect } from "./MenuSelect";
import { MenuSlider } from "./MenuSlider";

const enabledOptions = (suffix: string): readonly MenuOption<boolean>[] => [
  { id: true, name: `Activée${suffix}` },
  { id: false, name: `Désactivée${suffix}` },
];
const ENABLED = enabledOptions("");
const ENABLED_PLURAL = enabledOptions("s");
const RATES: readonly MenuOption<SpeechRate>[] = [
  { id: "lent", name: "Lent" },
  { id: "normal", name: "Normal" },
  { id: "rapide", name: "Rapide" },
];
const MAP_STYLES: readonly MenuOption<MiniMapStyle>[] = [
  { id: "global", name: "Globale" },
  { id: "north", name: "Zoom, nord en haut" },
  { id: "heading", name: "Zoom, cap en haut" },
  { id: "hybrid", name: "Zoom et vue globale" },
];

interface CopilotOptionsPanelProps {
  copilot: Copilot;
  onBack: () => void;
}

/** Tout s'applique aussitôt. Seul un choix du joueur écrit dans le stockage. */
export const CopilotOptionsPanel = ({
  copilot,
  onBack,
}: CopilotOptionsPanelProps) => {
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
    const { speechRate, voiceVolume } = update(patch);
    if (muted) return;
    preview.current ??= createVoicePreview();
    preview.current.say(SPEECH_RATES[speechRate], voiceVolume / 100);
  };

  return (
    <>
      <MenuSelect
        title="Voix du copilote"
        autoFocus
        value={options.voiceEnabled}
        options={ENABLED}
        onChoose={(voiceEnabled, close) => {
          update({ voiceEnabled });
          close();
        }}
      />
      <MenuSelect
        title="Vitesse de diction"
        value={options.speechRate}
        options={RATES}
        onChoose={(speechRate, close) => {
          updateAndListen({ speechRate });
          close();
        }}
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
      <MenuSelect
        title="Icônes de virage"
        value={options.paceIconsEnabled}
        options={ENABLED_PLURAL}
        onChoose={(paceIconsEnabled, close) => {
          update({ paceIconsEnabled });
          close();
        }}
      />
      <MenuSelect
        title="Mini-carte"
        value={options.miniMapEnabled}
        options={ENABLED}
        onChoose={(miniMapEnabled, close) => {
          update({ miniMapEnabled });
          close();
        }}
      />
      <MenuSelect
        title="Style de mini-carte"
        value={options.miniMapStyle}
        options={MAP_STYLES}
        onChoose={(miniMapStyle, close) => {
          update({ miniMapStyle });
          close();
        }}
      />
      <button
        type="button"
        data-menu-back=""
        className={`${hudButton} ${menuFocus} w-full`}
        onClick={onBack}
      >
        Retour
      </button>
    </>
  );
};
