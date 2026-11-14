// Libellés et cartes du panneau d'options.
import type { CopilotVoiceId } from "@/audio/copilotVoice";
import {
  HUD_STYLES,
  type HudStyle,
  MINI_MAP_STYLES,
  type MiniMapStyle,
  SPEEDOMETER_STYLES,
  type SpeedometerStyle,
} from "@/game/copilotOptions";
import type { MenuCard } from "../MenuCards";
import type { MenuOption } from "../MenuSelect";
import { MiniMapPreview } from "../MiniMap/components/MiniMapPreview";
import { SpeedometerPreview } from "../Speedometer";

const enabledOptions = (suffix: string): readonly MenuOption<boolean>[] => [
  { id: true, name: `Activée${suffix}` },
  { id: false, name: `Désactivée${suffix}` },
];
export const ENABLED = enabledOptions("");
export const ENABLED_PLURAL = enabledOptions("s");
export const SHOWN: readonly MenuOption<boolean>[] = [
  { id: true, name: "Affichées" },
  { id: false, name: "Masquées" },
];
export const VOICES: readonly MenuOption<CopilotVoiceId>[] = [
  { id: "siwis", name: "Féminine" },
  { id: "siwis-nicola", name: "Masculine" },
];

const HUD_STYLE_NAMES: Record<HudStyle, string> = {
  cockpit: "Cockpit",
  broadcast: "Broadcast",
};
/** Sans aperçu : des boutons comme les autres réglages courts */
export const HUD_STYLE_OPTIONS: readonly MenuOption<HudStyle>[] =
  HUD_STYLES.map((id) => ({ id, name: HUD_STYLE_NAMES[id] }));

const MAP_STYLE_NAMES: Record<MiniMapStyle, string> = {
  global: "Globale",
  north: "Zoom, nord en haut",
  heading: "Zoom, cap en haut",
  hybrid: "Zoom et vue globale",
};
/** `off` : mini-carte désactivée, le style choisi est gardé pour la suivante */
export type MiniMapChoice = MiniMapStyle | "off";
export const MAP_STYLES: readonly MenuCard<MiniMapChoice>[] = [
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
export const SPEEDOMETERS: readonly MenuCard<SpeedometerStyle>[] =
  SPEEDOMETER_STYLES.map((id) => ({
    id,
    name: SPEEDOMETER_NAMES[id],
    preview: <SpeedometerPreview style={id} />,
  }));
