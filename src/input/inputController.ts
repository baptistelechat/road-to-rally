import { NEUTRAL_INPUT, type CarInput } from "../sim/types";
import {
  hasGamepadMoved,
  KEYBOARD_RAMPS,
  mergeInputs,
  rampAxis,
  readGamepadInput,
  type GamepadLike,
  type InputDevice,
} from "./smoothing";

export type GameAction = "camera" | "restart" | "mute" | "diag" | "pause";

export interface InputDebug {
  connected: boolean;
  device: "keyboard" | "gamepad";
  /** Fenêtre sans focus : les entrées sont coupées */
  suspended: boolean;
  id: string | null;
  mapping: string | null;
  timestamp: number;
}

export interface InputController {
  /** À appeler exactement une fois par pas de simulation, avec dt fixe */
  sample: (dt: number) => CarInput;
  /** Actions déclenchées depuis le dernier appel, chacune une fois */
  consumeActions: () => GameAction[];
  activeDevice: () => "keyboard" | "gamepad";
  gamepadConnected: () => boolean;
  dispose: () => void;
  debug: () => InputDebug;
}

const LEFT_KEYS = ["ArrowLeft", "KeyA"];
const RIGHT_KEYS = ["ArrowRight", "KeyD"];
const THROTTLE_KEYS = ["ArrowUp", "KeyW"];
const BRAKE_KEYS = ["ArrowDown", "KeyS"];
const HANDBRAKE_KEYS = ["Space"];
const RESPAWN_KEY = "KeyR";
const RESPAWN_BUTTON = 3;
const DRIVE_KEYS = new Set([
  ...LEFT_KEYS,
  ...RIGHT_KEYS,
  ...THROTTLE_KEYS,
  ...BRAKE_KEYS,
  ...HANDBRAKE_KEYS,
]);
const KEY_ACTIONS = new Map<string, GameAction>([
  ["KeyC", "camera"],
  ["Backspace", "restart"],
  ["KeyM", "mute"],
  // La touche M d'un clavier AZERTY porte le code physique du « ; » QWERTY.
  ["Semicolon", "mute"],
  ["F9", "diag"],
  ["Escape", "pause"],
]);
const BUTTON_ACTIONS: readonly (readonly [number, GameAction])[] = [
  [2, "camera"],
  [8, "restart"],
  [4, "diag"],
];

interface KeyTarget {
  closest?: (selector: string) => unknown;
}

// Le jeu ne doit ni conduire ni bloquer Retour arrière pendant une saisie de texte.
const isEditing = (eventTarget: EventTarget | null): boolean =>
  Boolean(
    (eventTarget as KeyTarget | null)?.closest?.(
      "input, textarea, select, [contenteditable]",
    ),
  );

// Peut lever une SecurityError si la permission gamepad est refusée (iframe) :
// la boucle de simulation doit survivre et continuer au clavier.
// ponytail: première manette standard ; les mappings non standard sont ignorés car leurs indices ne veulent rien dire.
export const findStandardPad = (target: Window): GamepadLike | null => {
  try {
    const pads = target.navigator.getGamepads?.() ?? [];
    return (
      pads.find((pad) => pad?.connected && pad.mapping === "standard") ?? null
    );
  } catch {
    return null;
  }
};

export const createInputController = (target: Window): InputController => {
  const pressed = new Set<string>();
  const actions: GameAction[] = [];
  let steer = 0;
  let throttle = 0;
  let brake = 0;
  let device: InputDevice = "keyboard";
  let connected = false;
  // Relevé de référence pour la prise de main, refait à chaque reprise du clavier.
  let reference: CarInput | null = null;
  let heldButtons: boolean[] | null = null;
  let padRespawn = false;
  let lastPad: GamepadLike | null = null;
  // Fenêtre sans focus : plus aucune entrée ne passe, manette comprise.
  let suspended = false;

  const isAnyPressed = (codes: readonly string[]): boolean =>
    codes.some((code) => pressed.has(code));

  const release = (): void => {
    pressed.clear();
    steer = 0;
    throttle = 0;
    brake = 0;
    suspended = true;
  };

  const resume = (): void => {
    suspended = false;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    // Ctrl+R, Ctrl+C ou Alt+← appartiennent au navigateur.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditing(event.target)) return;
    const action = KEY_ACTIONS.get(event.code);
    const isDrive = DRIVE_KEYS.has(event.code);
    const isRespawn = event.code === RESPAWN_KEY;
    if (!action && !isDrive && !isRespawn) return;
    event.preventDefault();
    resume();
    if (action) {
      if (!event.repeat) actions.push(action);
      return;
    }
    pressed.add(event.code);
    if (isRespawn) return;
    // L'auto-répétition d'une touche maintenue ne doit pas reprendre la main à la manette.
    // Les touches d'action non plus : couper le son ne doit pas lâcher le volant.
    if (!event.repeat) {
      device = "keyboard";
      reference = null;
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    pressed.delete(event.code);
    if (
      DRIVE_KEYS.has(event.code) ||
      KEY_ACTIONS.has(event.code) ||
      event.code === RESPAWN_KEY
    )
      event.preventDefault();
  };

  const onVisibilityChange = (): void => {
    if (target.document.visibilityState === "hidden") release();
    else resume();
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", release);
  target.addEventListener("focus", resume);
  target.document.addEventListener("visibilitychange", onVisibilityChange);

  const pollGamepad = (): CarInput | null => {
    const pad = findStandardPad(target);
    connected = pad !== null;
    lastPad = pad;
    padRespawn = pad?.buttons[RESPAWN_BUTTON]?.pressed ?? false;
    if (!pad) {
      device = "keyboard";
      reference = null;
      heldButtons = null;
      return null;
    }

    const input = readGamepadInput(pad);
    const held = BUTTON_ACTIONS.map(
      ([index]) => pad.buttons[index]?.pressed ?? false,
    );
    // Le premier relevé sert de base : le bouton pressé pour réveiller la manette ne déclenche rien.
    if (heldButtons && !suspended) {
      const previous = heldButtons;
      BUTTON_ACTIONS.forEach(([, action], i) => {
        if (held[i] && !previous[i]) actions.push(action);
      });
    }
    heldButtons = held;

    if (!reference) reference = input;
    else if (!suspended && hasGamepadMoved(reference, input))
      device = "gamepad";
    return input;
  };

  return {
    sample: (dt) => {
      const gamepad = pollGamepad();
      const steerTarget =
        Number(isAnyPressed(RIGHT_KEYS)) - Number(isAnyPressed(LEFT_KEYS));
      steer = rampAxis(steer, steerTarget, KEYBOARD_RAMPS.steer, dt);
      throttle = rampAxis(
        throttle,
        Number(isAnyPressed(THROTTLE_KEYS)),
        KEYBOARD_RAMPS.throttle,
        dt,
      );
      brake = rampAxis(
        brake,
        Number(isAnyPressed(BRAKE_KEYS)),
        KEYBOARD_RAMPS.brake,
        dt,
      );
      if (suspended) return { ...NEUTRAL_INPUT };
      const keyboard = {
        steer,
        throttle,
        brake,
        handbrake: isAnyPressed(HANDBRAKE_KEYS),
      };
      const merged = mergeInputs(device, keyboard, gamepad);
      return pressed.has(RESPAWN_KEY) || padRespawn
        ? { ...merged, respawn: true }
        : merged;
    },
    consumeActions: () => actions.splice(0),
    activeDevice: () => device,
    gamepadConnected: () => connected,
    debug: () => ({
      connected,
      device,
      suspended,
      id: lastPad?.id ?? null,
      mapping: lastPad?.mapping ?? null,
      timestamp: lastPad?.timestamp ?? 0,
    }),
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", release);
      target.removeEventListener("focus", resume);
      target.document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
      release();
    },
  };
};
