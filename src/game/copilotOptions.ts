// Réglages du copilote, lus par le HUD et la voix. La simulation n'en dépend jamais.
import { COPILOT_VOICES, type CopilotVoiceId } from "@/audio/copilotVoice";
import type { Copilot } from "./copilot";

/** Crans des curseurs de volume, en pourcentage */
export const VOLUME_STEPS = [
  0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
] as const;
export type Volume = (typeof VOLUME_STEPS)[number];

/** Globale, zoom nord en haut, zoom cap en haut, zoom avec vignette globale */
export const MINI_MAP_STYLES = [
  "global",
  "north",
  "heading",
  "hybrid",
] as const;
export type MiniMapStyle = (typeof MINI_MAP_STYLES)[number];

/** Chiffres et LED de régime, cadran à aiguille, arc de régime, télémétrie */
export const SPEEDOMETER_STYLES = [
  "digital",
  "dial",
  "arc",
  "telemetry",
] as const;
export type SpeedometerStyle = (typeof SPEEDOMETER_STYLES)[number];

export interface CopilotOptions {
  voiceEnabled: boolean;
  voice: CopilotVoiceId;
  /** En pourcentage */
  voiceVolume: Volume;
  /** Balance avec la voix, en pourcentage */
  engineVolume: Volume;
  /** Pneus, herbe, vent et chocs, en pourcentage */
  effectsVolume: Volume;
  paceIconsEnabled: boolean;
  miniMapEnabled: boolean;
  miniMapStyle: MiniMapStyle;
  speedometerStyle: SpeedometerStyle;
}

export const defaultCopilotOptions: CopilotOptions = {
  voiceEnabled: true,
  voice: "siwis",
  voiceVolume: 100,
  engineVolume: 100,
  effectsVolume: 100,
  paceIconsEnabled: true,
  miniMapEnabled: true,
  miniMapStyle: "global",
  speedometerStyle: "digital",
};

const OPTIONS_KEY = "rally:copilot-options";

/** Une valeur absente ou invalide reprend celle d'origine. */
export const parseCopilotOptions = (raw: string | null): CopilotOptions => {
  const options = { ...defaultCopilotOptions };
  try {
    const stored = JSON.parse(raw ?? "null") as Partial<
      Record<keyof CopilotOptions, unknown>
    > | null;
    for (const key of [
      "voiceEnabled",
      "paceIconsEnabled",
      "miniMapEnabled",
    ] as const) {
      const value = stored?.[key];
      if (typeof value === "boolean") options[key] = value;
    }
    const voice = COPILOT_VOICES.find((id) => id === stored?.voice);
    if (voice) options.voice = voice;
    for (const key of [
      "voiceVolume",
      "engineVolume",
      "effectsVolume",
    ] as const) {
      const volume = VOLUME_STEPS.find((step) => step === stored?.[key]);
      if (volume !== undefined) options[key] = volume;
    }
    const style = MINI_MAP_STYLES.find((id) => id === stored?.miniMapStyle);
    if (style) options.miniMapStyle = style;
    const speedometer = SPEEDOMETER_STYLES.find(
      (id) => id === stored?.speedometerStyle,
    );
    if (speedometer) options.speedometerStyle = speedometer;
  } catch {
    // JSON illisible : on garde les réglages d'origine.
  }
  return options;
};

export const loadCopilotOptions = (): CopilotOptions => {
  try {
    return parseCopilotOptions(localStorage.getItem(OPTIONS_KEY));
  } catch {
    return defaultCopilotOptions;
  }
};

export const saveCopilotOptions = (options: CopilotOptions): void => {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // ponytail: stockage bloqué, les réglages vivent juste le temps de la session
  }
};

/** Voix comprise : le moment des annonces lit la durée de ses fichiers à travers `durationOf`. */
export const applyAudioOptions = (
  copilot: Pick<Copilot, "voice" | "setVoiceEnabled" | "setMix">,
  {
    voiceEnabled,
    voice,
    voiceVolume,
    engineVolume,
    effectsVolume,
  }: CopilotOptions,
): void => {
  copilot.setMix(engineVolume / 100, effectsVolume / 100);
  copilot.setVoiceEnabled(voiceEnabled);
  copilot.voice.setVoice(voice);
  copilot.voice.setVolume(voiceVolume / 100);
};
