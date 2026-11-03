import {
  DEFAULT_ENGINE,
  ENGINE_PRESETS,
  type EnginePresetId,
} from "@/audio/enginePresets";
import {
  NUMBER_CHARS,
  NUMBER_LENGTH,
  NUMBER_STYLES,
  type NumberStyle,
  PLATE_CHARS,
  PLATE_LENGTH,
  PLATE_STYLES,
  type PlateStyle,
} from "./decals";
import { DEFAULT_FLAG, FLAGS } from "./flags";

/** Palette de la voiture : changer ces couleurs suffit à la repeindre. Couleurs CSS en hexadécimal. */
export interface LiveryColors {
  /** Haut de caisse, habitacle */
  primary: string;
  /** Bas de caisse, lame d'aileron */
  secondary: string;
  /** Bande de caisse, bandes de capot et de toit, bavettes, flasques d'aileron */
  accent: string;
  /** Jantes */
  rim: string;
}

export interface Livery extends LiveryColors {
  plateText: string;
  plateStyle: PlateStyle;
  numberText: string;
  numberStyle: NumberStyle;
  /** Code pays du drapeau de custode */
  flag: string;
  /** Son du moteur en course */
  engine: EnginePresetId;
}

export const defaultColors: LiveryColors = {
  primary: "#efe6d2",
  secondary: "#1f3a5f",
  accent: "#d9472b",
  rim: "#d9a441",
};

export const defaultLivery: Livery = {
  ...defaultColors,
  plateText: "RA-027-LY",
  plateStyle: "europe",
  numberText: "27",
  numberStyle: "classique",
  flag: DEFAULT_FLAG,
  engine: DEFAULT_ENGINE,
};

const LIVERY_KEY = "rally:livery";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const validText = (
  value: unknown,
  chars: string,
  length: number,
): value is string =>
  typeof value === "string" &&
  value.length <= length &&
  [...value].every((char) => chars.includes(char));

/** Une valeur absente ou invalide reprend celle d'origine. */
export const parseLivery = (raw: string | null): Livery => {
  const livery = { ...defaultLivery };
  try {
    const stored = JSON.parse(raw ?? "null") as Partial<
      Record<keyof Livery, unknown>
    > | null;
    for (const key of Object.keys(defaultColors) as (keyof LiveryColors)[]) {
      const value = stored?.[key];
      if (typeof value === "string" && HEX_COLOR.test(value))
        livery[key] = value;
    }
    const { plateText, plateStyle, numberText, numberStyle, flag, engine } =
      stored ?? {};
    if (validText(plateText, PLATE_CHARS, PLATE_LENGTH))
      livery.plateText = plateText;
    if (validText(numberText, NUMBER_CHARS, NUMBER_LENGTH))
      livery.numberText = numberText;
    const plate = PLATE_STYLES.find(({ id }) => id === plateStyle);
    if (plate) livery.plateStyle = plate.id;
    const number = NUMBER_STYLES.find(({ id }) => id === numberStyle);
    if (number) livery.numberStyle = number.id;
    const country = FLAGS.find(({ id }) => id === flag);
    if (country) livery.flag = country.id;
    const preset = ENGINE_PRESETS.find(({ id }) => id === engine);
    if (preset) livery.engine = preset.id;
  } catch {
    // JSON illisible : on garde la livrée d'origine.
  }
  return livery;
};

export const loadLivery = (): Livery => {
  try {
    return parseLivery(localStorage.getItem(LIVERY_KEY));
  } catch {
    return defaultLivery;
  }
};

export const saveLivery = (livery: Livery): void => {
  try {
    localStorage.setItem(LIVERY_KEY, JSON.stringify(livery));
  } catch {
    // ponytail: stockage bloqué, la livrée vit juste le temps de la session
  }
};
