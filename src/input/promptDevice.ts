// Appareil dont les icônes de commandes s'affichent : le dernier utilisé, comme sur console.
// Indépendant de la boucle de jeu, qui garde sa propre bascule clavier/manette pour la conduite.
import { create } from "zustand";
import type { KeyboardLayout, PromptDevice } from "./inputPrompts";

export type PadFamily = "xbox" | "playstation";
/** Choix du joueur pour une manette mal reconnue */
export type PadChoice = "auto" | PadFamily;

interface PromptDeviceState {
  lastInput: "keyboard" | "gamepad";
  /** Famille déduite de l'identifiant de la dernière manette vue */
  detectedPad: PadFamily;
  padChoice: PadChoice;
  layout: KeyboardLayout;
}

const CHOICE_KEY = "rally:pad-icons";

export const usePromptDeviceStore = create<PromptDeviceState>(() => ({
  lastInput: "keyboard",
  detectedPad: "xbox",
  padChoice: "auto",
  // Le public est français : AZERTY tant qu'aucune touche n'a dit le contraire.
  layout: "azerty",
}));

// Sony : vendor 054c. Le reste, manettes génériques comprises, suit la disposition Xbox du mapping standard.
export const padFamilyOf = (id: string): PadFamily =>
  /054c|playstation|dualsense|dualshock/i.test(id) ? "playstation" : "xbox";

export const resolvePromptDevice = ({
  lastInput,
  detectedPad,
  padChoice,
}: Pick<
  PromptDeviceState,
  "lastInput" | "detectedPad" | "padChoice"
>): PromptDevice =>
  lastInput === "keyboard"
    ? "keyboard"
    : padChoice === "auto"
      ? detectedPad
      : padChoice;

export const usePromptDevice = (): PromptDevice =>
  usePromptDeviceStore(resolvePromptDevice);

const update = (patch: Partial<PromptDeviceState>): void => {
  const state = usePromptDeviceStore.getState();
  if (
    (Object.keys(patch) as (keyof PromptDeviceState)[]).some(
      (key) => state[key] !== patch[key],
    )
  )
    usePromptDeviceStore.setState(patch);
};

export const setPadChoice = (padChoice: PadChoice): void => {
  update({ padChoice });
  try {
    localStorage.setItem(CHOICE_KEY, padChoice);
  } catch {
    // ponytail: stockage bloqué, le choix vit le temps de la session
  }
};

const loadPadChoice = (): PadChoice => {
  try {
    const stored = localStorage.getItem(CHOICE_KEY);
    return stored === "xbox" || stored === "playstation" ? stored : "auto";
  } catch {
    return "auto";
  }
};

// Ce qu'écrivent ces touches physiques sur un clavier AZERTY : KeyQ écrit « a ».
const AZERTY_KEYS: Record<string, string> = {
  KeyQ: "a",
  KeyW: "z",
  KeyA: "q",
  KeyZ: "w",
};

export const layoutFromKey = (
  code: string,
  key: string,
): KeyboardLayout | null => {
  const azerty = AZERTY_KEYS[code];
  if (!azerty) return null;
  return key.toLowerCase() === azerty ? "azerty" : "qwerty";
};

interface KeyboardLayoutMap {
  get: (code: string) => string | undefined;
}
interface NavigatorWithKeyboard {
  keyboard?: { getLayoutMap?: () => Promise<KeyboardLayoutMap> };
}

const PAD_POLL_MS = 250;
const AXIS_THRESHOLD = 0.5;

/** À monter une fois ; renvoie de quoi tout arrêter. */
export const startPromptDeviceTracking = (target: Window): (() => void) => {
  update({ padChoice: loadPadChoice() });

  // Chrome et Edge donnent la disposition sans attendre une frappe.
  (target.navigator as NavigatorWithKeyboard).keyboard
    ?.getLayoutMap?.()
    .then((map) => {
      const key = map.get("KeyQ");
      if (key) update({ layout: key === "a" ? "azerty" : "qwerty" });
    })
    .catch(() => undefined);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    const layout = layoutFromKey(event.code, event.key);
    update(
      layout ? { lastInput: "keyboard", layout } : { lastInput: "keyboard" },
    );
  };
  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") update({ lastInput: "keyboard" });
  };

  // Poll lent, seulement manette branchée : la boucle de jeu lit déjà la manette à 60 Hz.
  let timer: number | undefined;
  const pollPads = (): void => {
    let pads: (Gamepad | null)[] = [];
    try {
      pads = target.navigator.getGamepads?.() ?? [];
    } catch {
      // Permission gamepad refusée (iframe) : clavier seulement.
    }
    const active = pads.find(
      (pad) =>
        pad?.connected &&
        (pad.buttons.some((button) => button.pressed) ||
          pad.axes.some((axis) => Math.abs(axis) > AXIS_THRESHOLD)),
    );
    if (active)
      update({ lastInput: "gamepad", detectedPad: padFamilyOf(active.id) });
    if (!pads.some((pad) => pad?.connected)) stopPolling();
  };
  const startPolling = (): void => {
    timer ??= target.setInterval(pollPads, PAD_POLL_MS);
  };
  const stopPolling = (): void => {
    if (timer !== undefined) target.clearInterval(timer);
    timer = undefined;
  };
  const onPadConnected = (event: GamepadEvent): void => {
    update({ detectedPad: padFamilyOf(event.gamepad.id) });
    startPolling();
  };

  target.addEventListener("keydown", onKeyDown, { capture: true });
  target.addEventListener("pointerdown", onPointerDown, { capture: true });
  target.addEventListener("gamepadconnected", onPadConnected);
  // Une manette déjà branchée avant le chargement n'émet rien tant qu'on ne la touche pas.
  startPolling();

  return () => {
    target.removeEventListener("keydown", onKeyDown, { capture: true });
    target.removeEventListener("pointerdown", onPointerDown, { capture: true });
    target.removeEventListener("gamepadconnected", onPadConnected);
    stopPolling();
  };
};
