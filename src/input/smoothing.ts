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

export type MenuAction =
  "up" | "down" | "left" | "right" | "confirm" | "cancel";

export interface GarageInput {
  /** Stick droit, +1 = vers la droite */
  orbitX: number;
  /** Stick droit, +1 = vers le bas */
  orbitY: number;
  /** +1 = RT à fond, se rapprocher ; -1 = LT à fond, s'éloigner */
  zoom: number;
  menu: MenuAction | null;
}

const MENU_STICK_THRESHOLD = 0.5;

/** A valide, B annule ; la croix ou le stick gauche déplacent. */
export const readMenuAction = (pad: GamepadLike): MenuAction | null => {
  if (pad.buttons[0]?.pressed) return "confirm";
  if (pad.buttons[1]?.pressed) return "cancel";
  if (pad.buttons[12]?.pressed) return "up";
  if (pad.buttons[13]?.pressed) return "down";
  if (pad.buttons[14]?.pressed) return "left";
  if (pad.buttons[15]?.pressed) return "right";
  const x = clamp(pad.axes[0] ?? 0, -1, 1);
  const y = clamp(pad.axes[1] ?? 0, -1, 1);
  // ponytail: seuil unique, ajouter une hystérésis si un stick usé fait sauter des lignes
  if (Math.max(Math.abs(x), Math.abs(y)) < MENU_STICK_THRESHOLD) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
};

/** Temps de maintien avant le défilement, en secondes */
export const MENU_REPEAT_DELAY = 0.35;
/** Période du défilement, en secondes */
export const MENU_REPEAT_INTERVAL = 0.09;

export interface MenuRepeat {
  /** Undefined tant qu'aucun relevé : le bouton pressé pour réveiller la manette ne déclenche rien. */
  held: MenuAction | null | undefined;
  wait: number;
}

/** Action à déclencher à ce pas : à la pression, puis en continu pour un déplacement maintenu. */
export const pollMenuRepeat = (
  repeat: MenuRepeat,
  action: MenuAction | null,
  dt: number,
): MenuAction | null => {
  if (action !== repeat.held) {
    const fires = repeat.held !== undefined;
    repeat.held = action;
    repeat.wait = MENU_REPEAT_DELAY;
    return fires ? action : null;
  }
  if (!action || action === "confirm" || action === "cancel") return null;
  repeat.wait -= dt;
  if (repeat.wait > 0) return null;
  repeat.wait = MENU_REPEAT_INTERVAL;
  return action;
};

/** Ligne visée dans une liste en boucle ; `index` vaut -1 si aucune n'est sélectionnée. */
export const stepMenuIndex = (
  index: number,
  count: number,
  action: MenuAction,
): number => {
  if (action === "down") return (index + 1) % count;
  if (action === "up") return (Math.max(index, 0) - 1 + count) % count;
  return index;
};

/** Stick droit, axe horizontal, +1 = vers la droite */
export const readCameraOrbit = (pad: GamepadLike): number =>
  applyDeadzone(pad.axes[2] ?? 0, STICK_DEADZONE);

export const readGarageInput = (pad: GamepadLike): GarageInput => {
  const { throttle, brake } = readGamepadInput(pad);
  return {
    orbitX: readCameraOrbit(pad),
    orbitY: applyDeadzone(pad.axes[3] ?? 0, STICK_DEADZONE),
    zoom: throttle - brake,
    menu: readMenuAction(pad),
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
