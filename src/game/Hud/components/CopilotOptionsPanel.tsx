"use client";

import { useEffect, useRef } from "react";
import type { CopilotVoiceId } from "@/audio/copilotVoice";
import { createVoicePreview, type VoicePreview } from "@/audio/voicePreview";
import type { Copilot } from "@/game/copilot";
import {
  applyAudioOptions,
  type CopilotOptions,
  MINI_MAP_STYLES,
  type MiniMapStyle,
  SPEEDOMETER_STYLES,
  type SpeedometerStyle,
  type Volume,
} from "@/game/copilotOptions";
import { setCopilotOptions, useHudStore } from "@/game/hudStore";
import { hudButton, menuFocus } from "../hudStyles";
import { type MenuCard, MenuCards } from "./MenuCards";
import { MiniMapPreview } from "./MiniMap/components/MiniMapPreview";
import { type MenuOption, MenuSelect } from "./MenuSelect";
import { MenuSlider } from "./MenuSlider";
import { SpeedometerPreview } from "./Speedometer";

const enabledOptions = (suffix: string): readonly MenuOption<boolean>[] => [
  { id: true, name: `Activée${suffix}` },
  { id: false, name: `Désactivée${suffix}` },
];
const ENABLED = enabledOptions("");
const ENABLED_PLURAL = enabledOptions("s");
const VOICES: readonly MenuOption<CopilotVoiceId>[] = [
  { id: "siwis", name: "Féminine" },
  { id: "siwis-nicola", name: "Masculine" },
];
const MAP_STYLE_NAMES: Record<MiniMapStyle, string> = {
  global: "Globale",
  north: "Zoom, nord en haut",
  heading: "Zoom, cap en haut",
  hybrid: "Zoom et vue globale",
};
/** `off` : mini-carte désactivée, le style choisi est gardé pour la suivante */
type MiniMapChoice = MiniMapStyle | "off";
const MAP_STYLES: readonly MenuCard<MiniMapChoice>[] = [
  { id: "off", name: "Aucune", preview: <MiniMapPreview style="off" /> },
  ...MINI_MAP_STYLES.map((id) => ({
    id,
    name: MAP_STYLE_NAMES[id],
    preview: <MiniMapPreview style={id} />,
  })),
];
const SPEEDOMETER_NAMES: Record<SpeedometerStyle, string> = {
  digital: "Chiffres et LED",
  dial: "Cadran à aiguille",
  arc: "Arc de régime",
  telemetry: "Télémétrie",
};
const SPEEDOMETERS: readonly MenuCard<SpeedometerStyle>[] =
  SPEEDOMETER_STYLES.map((id) => ({
    id,
    name: SPEEDOMETER_NAMES[id],
    preview: <SpeedometerPreview style={id} />,
  }));

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
    const { voice, voiceVolume } = update(patch);
    if (muted) return;
    preview.current ??= createVoicePreview();
    preview.current.say(voice, voiceVolume / 100);
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
        title="Voix"
        value={options.voice}
        options={VOICES}
        onChoose={(voice, close) => {
          updateAndListen({ voice });
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
      <MenuCards
        title="Mini-carte"
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
      <MenuCards
        title="Compteur"
        value={options.speedometerStyle}
        cards={SPEEDOMETERS}
        onChoose={(speedometerStyle) => update({ speedometerStyle })}
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
