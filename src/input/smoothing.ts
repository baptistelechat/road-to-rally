// Logique pure des entrées : aucun DOM, aucune horloge, tout dépend du seul `dt`.
import type { CarInput } from "../sim/types";

export type InputDevice = "keyboard" | "gamepad";

export interface RampRates {
  /** Vitesse en s⁻¹ en s'éloignant de zéro */
  rise: number;
  /** Vitesse en s⁻¹ en revenant vers zéro */
  fall: number;
}

// Réglages de ressenti, à ajuster manette en main.
export const KEYBOARD_RAMPS = {
  steer: { rise: 3.5, fall: 7 },
  throttle: { rise: 5, fall: 10 },
  brake: { rise: 6, fall: 12 },
} as const satisfies Record<string, RampRates>;

export const STICK_DEADZONE = 0.12;
export const TRIGGER_DEADZONE = 0.02;
/** Écart depuis le dernier relevé de référence à partir duquel la manette prend la main */
export const GAMEPAD_TAKEOVER_THRESHOLD = 0.1;

/** Sous-ensemble de `Gamepad` lu ici, pour tester sans navigateur. */
export interface GamepadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
  /** Date du dernier changement de valeur envoyé par la manette */
  timestamp?: number;
  id?: string;
  mapping?: string;
}

// NaN retombe à zéro : une valeur matérielle aberrante ne doit jamais atteindre la physique.
export const clamp = (value: number, min: number, max: number): number =>
  Number.isNaN(value) ? 0 : Math.min(max, Math.max(min, value));

/** Avance `current` vers `target` ; au contre-braquage, repart de zéro sans transition. */
export const rampAxis = (
  current: number,
  target: number,
  rates: RampRates,
  dt: number,
): number => {
  const from = current * target < 0 ? 0 : current;
  const rate = Math.abs(target) > Math.abs(from) ? rates.rise : rates.fall;
  return target > from
    ? Math.min(target, from + rate * dt)
    : Math.max(target, from - rate * dt);
};

/** Sous la zone morte : zéro. Au-delà : remise à l'échelle pour repartir de 0 sans saut et atteindre 1. */
export const applyDeadzone = (value: number, deadzone: number): number => {
  const clamped = clamp(value, -1, 1);
  const magnitude = Math.abs(clamped);
  if (magnitude <= deadzone) return 0;
  return (Math.sign(clamped) * (magnitude - deadzone)) / (1 - deadzone);
};

export const readGamepadInput = (pad: GamepadLike): CarInput => ({
  // Un seul axe, donc zone morte 1D : un stick en diagonale ne réduit pas le braquage.
  steer: applyDeadzone(pad.axes[0] ?? 0, STICK_DEADZONE),
  throttle: clamp(
    applyDeadzone(pad.buttons[7]?.value ?? 0, TRIGGER_DEADZONE),
    0,
    1,
  ),
  brake: clamp(
    applyDeadzone(pad.buttons[6]?.value ?? 0, TRIGGER_DEADZONE),
    0,
    1,
  ),
  handbrake: pad.buttons[0]?.pressed ?? false,
});

export interface GarageInput {
  /** Stick droit, +1 = vers la droite */
  orbitX: number;
  /** Stick droit, +1 = vers le bas */
  orbitY: number;
  /** +1 = RT à fond, se rapprocher ; -1 = LT à fond, s'éloigner */
  zoom: number;
  pause: boolean;
}

// Stick gauche et croix restent libres pour les menus de personnalisation.
export const readGarageInput = (pad: GamepadLike): GarageInput => {
  const { throttle, brake, handbrake } = readGamepadInput(pad);
  return {
    orbitX: applyDeadzone(pad.axes[2] ?? 0, STICK_DEADZONE),
    orbitY: applyDeadzone(pad.axes[3] ?? 0, STICK_DEADZONE),
    zoom: throttle - brake,
    pause: handbrake,
  };
};

// Comparé à une référence et non au pas précédent : une gâchette pressée lentement
// finit par franchir le seuil, et une valeur maintenue ne vole pas la main au clavier.
export const hasGamepadMoved = (
  reference: CarInput,
  current: CarInput,
): boolean =>
  current.handbrake !== reference.handbrake ||
  Math.abs(current.steer - reference.steer) > GAMEPAD_TAKEOVER_THRESHOLD ||
  Math.abs(current.throttle - reference.throttle) >
    GAMEPAD_TAKEOVER_THRESHOLD ||
  Math.abs(current.brake - reference.brake) > GAMEPAD_TAKEOVER_THRESHOLD;

// ponytail: le périphérique actif prend tout, pas de mélange par axe. Mélanger
// laisserait une gâchette ou un stick maintenu parasiter la conduite au clavier.
export const mergeInputs = (
  device: InputDevice,
  keyboard: CarInput,
  gamepad: CarInput | null,
): CarInput => ({ ...(device === "gamepad" && gamepad ? gamepad : keyboard) });
