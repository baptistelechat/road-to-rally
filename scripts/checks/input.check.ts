import assert from "node:assert/strict";
import { createInputController } from "../../src/input/inputController";
import { createInputRecorder, replayInputs } from "../../src/input/recorder";
import {
  applyDeadzone,
  KEYBOARD_RAMPS,
  rampAxis,
  STICK_DEADZONE,
  type GamepadLike,
} from "../../src/input/smoothing";
import { FIXED_DT } from "../../src/sim/fixedStep";
import { NEUTRAL_INPUT, type CarInput } from "../../src/sim/types";

type Listener = (event: unknown) => void;

interface FakeEvent {
  code: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  target?: { closest: (selector: string) => unknown };
}

// Émetteur minimal commun à la fenêtre et au document factices.
const createEmitter = () => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener: (type: string, listener: Listener): void => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener: (type: string, listener: Listener): void => {
      listeners.get(type)?.delete(listener);
    },
    emit: (type: string, event: unknown = {}): void => {
      listeners.get(type)?.forEach((listener) => listener(event));
    },
  };
};

const createFakeWindow = () => {
  const emitter = createEmitter();
  const documentEmitter = createEmitter();
  const document = { ...documentEmitter, visibilityState: "visible" };
  let pads: (GamepadLike | null)[] = [];
  const fake = {
    ...emitter,
    document,
    navigator: { getGamepads: () => pads },
  };
  // Renvoie les preventDefault observés pour vérifier qu'on bloque le défilement.
  const key = (type: "keydown" | "keyup", event: FakeEvent): boolean => {
    let prevented = false;
    emitter.emit(type, { ...event, preventDefault: () => (prevented = true) });
    return prevented;
  };
  return {
    window: fake as unknown as Window,
    down: (code: string, extra: Partial<FakeEvent> = {}) =>
      key("keydown", { code, ...extra }),
    up: (code: string) => key("keyup", { code }),
    emit: emitter.emit,
    setHidden: (hidden: boolean): void => {
      document.visibilityState = hidden ? "hidden" : "visible";
      documentEmitter.emit("visibilitychange");
    },
    setPads: (next: (GamepadLike | null)[]): void => {
      pads = next;
    },
  };
};

interface PadState {
  steer?: number;
  throttle?: number;
  brake?: number;
  pressed?: number[];
}

const makePad = ({
  steer = 0,
  throttle = 0,
  brake = 0,
  pressed = [],
}: PadState = {}) => ({
  connected: true,
  mapping: "standard",
  axes: [steer, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => {
    const analog =
      i === 7 ? throttle : i === 6 ? brake : pressed.includes(i) ? 1 : 0;
    return { pressed: analog > 0, value: analog };
  }),
});

const stepsUntil = (done: () => boolean, step: () => void): number => {
  let steps = 0;
  while (!done()) {
    step();
    steps++;
    assert.ok(steps < 10_000, "la rampe ne converge pas");
  }
  return steps;
};

// Une session scriptée, jouée deux fois pour prouver le déterminisme.
const runSession = (): CarInput[] => {
  const fake = createFakeWindow();
  const controller = createInputController(fake.window);
  const outputs: CarInput[] = [];
  const run = (steps: number): void => {
    for (let i = 0; i < steps; i++) outputs.push(controller.sample(FIXED_DT));
  };
  fake.down("KeyW");
  run(20);
  fake.down("KeyA");
  run(15);
  fake.up("KeyA");
  fake.down("ArrowRight");
  run(15);
  fake.down("Space");
  fake.down("ArrowDown");
  run(10);
  fake.up("KeyW");
  fake.up("Space");
  fake.up("ArrowRight");
  run(30);
  fake.setPads([makePad({ steer: -0.6, throttle: 0.4 })]);
  run(1);
  fake.setPads([makePad({ steer: 0.7, throttle: 0.9, pressed: [0] })]);
  run(10);
  controller.dispose();
  return outputs;
};

const assertBounds = (input: CarInput): void => {
  assert.ok(input.steer >= -1 && input.steer <= 1, `steer ${input.steer}`);
  assert.ok(
    input.throttle >= 0 && input.throttle <= 1,
    `throttle ${input.throttle}`,
  );
  assert.ok(input.brake >= 0 && input.brake <= 1, `brake ${input.brake}`);
};

export default async function check(): Promise<void> {
  // Même séquence d'événements, mêmes sorties, et bornes respectées.
  const session = runSession();
  assert.deepEqual(session, runSession());
  session.forEach(assertBounds);

  // Montée progressive au clavier, et retour au centre plus rapide que l'aller.
  {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    fake.down("KeyD");
    const first = controller.sample(FIXED_DT).steer;
    assert.ok(first > 0 && first < 0.2, `premier pas ${first}`);
    let last = first;
    const rise = stepsUntil(
      () => last === 1,
      () => (last = controller.sample(FIXED_DT).steer),
    );
    fake.up("KeyD");
    const fall = stepsUntil(
      () => last === 0,
      () => (last = controller.sample(FIXED_DT).steer),
    );
    assert.ok(fall < rise, `retour ${fall} pas, aller ${rise} pas`);
    controller.dispose();
  }

  // Contre-braquage : le passage par zéro est instantané.
  assert.equal(
    rampAxis(0.8, -1, KEYBOARD_RAMPS.steer, FIXED_DT),
    -KEYBOARD_RAMPS.steer.rise * FIXED_DT,
  );

  // Gauche + droite s'annulent, et la touche jumelle reste active au relâchement de l'autre.
  {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    fake.down("KeyA");
    fake.down("KeyD");
    assert.equal(controller.sample(FIXED_DT).steer, 0);
    fake.up("KeyD");
    assert.ok(controller.sample(FIXED_DT).steer < 0);
    fake.down("KeyW");
    fake.down("ArrowUp");
    fake.up("KeyW");
    assert.ok(controller.sample(FIXED_DT).throttle > 0);
    controller.dispose();
  }

  // Mapping : défilement bloqué, raccourcis navigateur et saisie de texte préservés.
  {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    for (const code of ["ArrowUp", "ArrowDown", "Space", "Backspace", "KeyM"])
      assert.ok(fake.down(code), `${code} sans preventDefault`);
    controller.consumeActions();
    assert.equal(fake.down("Tab"), false);
    assert.equal(fake.down("KeyR", { ctrlKey: true }), false);
    assert.deepEqual(controller.consumeActions(), []);
    const field = {
      closest: (selector: string) => (selector.includes("input") ? {} : null),
    };
    assert.equal(fake.down("Backspace", { target: field }), false);
    assert.deepEqual(controller.consumeActions(), []);
    controller.dispose();
  }

  // Zone morte : zéro dedans, continu à la sortie, plein débattement atteint, valeurs folles bornées.
  assert.equal(applyDeadzone(STICK_DEADZONE, STICK_DEADZONE), 0);
  assert.equal(applyDeadzone(-STICK_DEADZONE / 2, STICK_DEADZONE), 0);
  assert.ok(applyDeadzone(STICK_DEADZONE + 0.001, STICK_DEADZONE) < 0.01);
  assert.equal(applyDeadzone(1, STICK_DEADZONE), 1);
  assert.equal(applyDeadzone(-1, STICK_DEADZONE), -1);
  assert.equal(applyDeadzone(3, STICK_DEADZONE), 1);
  assert.equal(applyDeadzone(Number.NaN, STICK_DEADZONE), 0);

  // blur et visibilitychange relâchent tout, y compris la manette.
  for (const lose of ["blur", "hidden"] as const) {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    fake.down("KeyW");
    fake.down("KeyD");
    fake.down("Space");
    for (let i = 0; i < 30; i++) controller.sample(FIXED_DT);
    if (lose === "blur") fake.emit("blur");
    else fake.setHidden(true);
    assert.deepEqual(controller.sample(FIXED_DT), NEUTRAL_INPUT);

    // Au retour, la touche n'est plus considérée comme enfoncée.
    if (lose === "blur") fake.emit("focus");
    else fake.setHidden(false);
    assert.deepEqual(controller.sample(FIXED_DT), NEUTRAL_INPUT);

    fake.setPads([makePad()]);
    controller.sample(FIXED_DT);
    fake.setPads([makePad({ throttle: 1 })]);
    assert.equal(controller.sample(FIXED_DT).throttle, 1);
    if (lose === "blur") fake.emit("blur");
    else fake.setHidden(true);
    assert.deepEqual(controller.sample(FIXED_DT), NEUTRAL_INPUT);
    controller.dispose();
  }

  // Action clavier délivrée une seule fois, auto-répétition comprise.
  {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    fake.down("KeyC");
    fake.down("KeyC", { repeat: true });
    fake.up("KeyC");
    assert.deepEqual(controller.consumeActions(), ["camera"]);
    assert.deepEqual(controller.consumeActions(), []);
    fake.down("Backspace");
    fake.down("KeyM");
    assert.deepEqual(controller.consumeActions(), ["restart", "mute"]);
    controller.dispose();
  }

  // La touche M d'un clavier AZERTY porte un autre code physique.
  {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    fake.down("Semicolon");
    assert.deepEqual(controller.consumeActions(), ["mute"]);
    controller.dispose();
  }

  // Action manette : détection de front, le bouton maintenu ne redéclenche pas.
  {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    // Le bouton qui révèle la manette ne déclenche rien.
    fake.setPads([makePad({ pressed: [2] })]);
    controller.sample(FIXED_DT);
    assert.deepEqual(controller.consumeActions(), []);
    fake.setPads([makePad()]);
    controller.sample(FIXED_DT);
    fake.setPads([makePad({ pressed: [2] })]);
    controller.sample(FIXED_DT);
    controller.sample(FIXED_DT);
    assert.deepEqual(controller.consumeActions(), ["camera"]);
    fake.setPads([makePad({ pressed: [2, 8] })]);
    controller.sample(FIXED_DT);
    assert.deepEqual(controller.consumeActions(), ["restart"]);
    assert.deepEqual(controller.consumeActions(), []);
    controller.dispose();
  }

  // Remise en piste : un état maintenu, pas une action, au clavier comme à la manette.
  {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    assert.equal(controller.sample(FIXED_DT).respawn, undefined);
    fake.down("KeyR");
    assert.equal(controller.sample(FIXED_DT).respawn, true);
    assert.equal(controller.sample(FIXED_DT).respawn, true);
    assert.equal(controller.activeDevice(), "keyboard");
    fake.up("KeyR");
    assert.equal(controller.sample(FIXED_DT).respawn, undefined);
    fake.setPads([makePad({ pressed: [3] })]);
    assert.equal(controller.sample(FIXED_DT).respawn, true);
    fake.setPads([makePad()]);
    assert.equal(controller.sample(FIXED_DT).respawn, undefined);
    assert.deepEqual(controller.consumeActions(), []);
    fake.down("KeyR");
    fake.emit("blur");
    assert.equal(controller.sample(FIXED_DT).respawn, undefined);
    controller.dispose();
  }

  // Bascule de périphérique et branchement à chaud.
  {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    assert.equal(controller.gamepadConnected(), false);
    assert.equal(controller.activeDevice(), "keyboard");

    // Une manette non standard est ignorée.
    fake.setPads([
      null,
      { ...makePad({ throttle: 1 }), mapping: "" } as GamepadLike,
    ]);
    controller.sample(FIXED_DT);
    assert.equal(controller.gamepadConnected(), false);

    // Branchée mais immobile : le clavier garde la main.
    fake.setPads([makePad()]);
    controller.sample(FIXED_DT);
    assert.equal(controller.gamepadConnected(), true);
    assert.equal(controller.activeDevice(), "keyboard");

    // Un frémissement du stick sous la zone morte ne bascule pas.
    fake.setPads([makePad({ steer: STICK_DEADZONE / 2 })]);
    controller.sample(FIXED_DT);
    assert.equal(controller.activeDevice(), "keyboard");

    fake.setPads([makePad({ steer: 1, throttle: 0.5 })]);
    const input = controller.sample(FIXED_DT);
    assert.equal(controller.activeDevice(), "gamepad");
    assert.equal(input.steer, 1);
    assert.ok(input.throttle > 0.4 && input.throttle < 0.6);

    // Le clavier reprend la main ; la manette maintenue ne la lui vole pas.
    fake.down("KeyS");
    assert.equal(controller.activeDevice(), "keyboard");
    const back = controller.sample(FIXED_DT);
    assert.equal(back.throttle, 0);
    assert.ok(back.brake > 0);
    assert.equal(controller.activeDevice(), "keyboard");

    // L'auto-répétition et les touches d'action ne reprennent pas la main à la manette.
    fake.setPads([makePad({ steer: 0.2 })]);
    controller.sample(FIXED_DT);
    assert.equal(controller.activeDevice(), "gamepad");
    fake.down("KeyS", { repeat: true });
    fake.down("KeyM");
    assert.equal(controller.activeDevice(), "gamepad");

    // Débranchement : retour au clavier, sans planter.
    fake.setPads([null]);
    controller.sample(FIXED_DT);
    assert.equal(controller.gamepadConnected(), false);
    assert.equal(controller.activeDevice(), "keyboard");
    controller.dispose();
  }

  // Une gâchette pressée lentement finit par donner la main à la manette.
  {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    fake.setPads([makePad()]);
    controller.sample(FIXED_DT);
    for (let value = 0.01; value < 0.2; value += 0.01) {
      fake.setPads([makePad({ throttle: value })]);
      controller.sample(FIXED_DT);
    }
    assert.equal(controller.activeDevice(), "gamepad");
    controller.dispose();
  }

  // Un navigateur qui refuse la Gamepad API ne casse pas la boucle.
  {
    const fake = createFakeWindow();
    const denied = {
      ...fake.window,
      addEventListener: fake.window.addEventListener,
      removeEventListener: fake.window.removeEventListener,
      navigator: {
        getGamepads: () => {
          throw new Error("SecurityError");
        },
      },
    } as unknown as Window;
    const controller = createInputController(denied);
    assert.deepEqual(controller.sample(FIXED_DT), NEUTRAL_INPUT);
    controller.dispose();
  }

  // dispose retire les écouteurs.
  {
    const fake = createFakeWindow();
    const controller = createInputController(fake.window);
    controller.dispose();
    fake.down("KeyR");
    assert.deepEqual(controller.consumeActions(), []);
  }

  // Un enregistrement relu redonne exactement les mêmes entrées, pas par pas.
  {
    const recorder = createInputRecorder();
    const inputs: CarInput[] = [
      ...session,
      ...Array.from({ length: 120 }, () => ({ ...NEUTRAL_INPUT })),
      { steer: -0, throttle: 0, brake: 0, handbrake: false },
      { steer: 1 / 3, throttle: Math.PI / 4, brake: 1e-12, handbrake: true },
    ];
    inputs.forEach(recorder.record);
    const frames = recorder.frames();
    assert.equal(frames.count, inputs.length);
    // Le neutre maintenu tient dans une plage : stockage bien plus court qu'un tableau complet.
    assert.ok(frames.runs.length < inputs.length * 4);

    for (const source of [frames, JSON.parse(JSON.stringify(frames))]) {
      const replay = replayInputs(source);
      const replayed = inputs.map(() => replay.next());
      // JSON ne conserve pas -0 : on compare ce cas à part, sur la source directe uniquement.
      if (source === frames) assert.deepEqual(replayed, inputs);
      else assert.deepEqual(replayed.slice(0, session.length), session);
      assert.equal(replay.next(), null);
    }
  }
}
