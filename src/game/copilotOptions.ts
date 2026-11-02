// Réglages du copilote, lus par le HUD et la voix. La simulation n'en dépend jamais.
import { SPEECH_RATES } from "@/audio/copilotVoice";
import type { Copilot } from "./copilot";

export type SpeechRate = keyof typeof SPEECH_RATES;

export const VOICE_VOLUMES = [0, 25, 50, 75, 100] as const;
export type VoiceVolume = (typeof VOICE_VOLUMES)[number];

export interface CopilotOptions {
  voiceEnabled: boolean;
  speechRate: SpeechRate;
  /** En pourcentage */
  voiceVolume: VoiceVolume;
  paceIconsEnabled: boolean;
  miniMapEnabled: boolean;
}

export const defaultCopilotOptions: CopilotOptions = {
  voiceEnabled: true,
  speechRate: "normal",
  voiceVolume: 100,
  paceIconsEnabled: true,
  miniMapEnabled: true,
};

const OPTIONS_KEY = "rally:copilot-options";
const SPEECH_RATE_IDS = Object.keys(SPEECH_RATES) as SpeechRate[];

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
    const rate = SPEECH_RATE_IDS.find((id) => id === stored?.speechRate);
    if (rate) options.speechRate = rate;
    const volume = VOICE_VOLUMES.find((step) => step === stored?.voiceVolume);
    if (volume !== undefined) options.voiceVolume = volume;
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

/** Vitesse de diction comprise : le moment des annonces la lit à travers `durationOf`. */
export const applyVoiceOptions = (
  copilot: Pick<Copilot, "voice" | "setVoiceEnabled">,
  { voiceEnabled, speechRate, voiceVolume }: CopilotOptions,
): void => {
  copilot.setVoiceEnabled(voiceEnabled);
  copilot.voice.setRate(SPEECH_RATES[speechRate]);
  copilot.voice.setVolume(voiceVolume / 100);
};
