import assert from "node:assert/strict";
import { Vector3 } from "three";
import { createCarAudio } from "../../src/audio/engineAudio";
import {
  createTireVoice,
  DEFAULT_TIRE_SOUND,
  squealAmount,
} from "../../src/audio/tireVoice";
import { updateRumble } from "../../src/audio/gamepadRumble";
import {
  HUD_PERIOD_MS,
  pushHud,
  setLapTimes,
  nextScreen,
  setHudScreen,
  useHudStore,
} from "../../src/game/hudStore";
import { applyMenuAction } from "../../src/game/Hud/applyMenuAction";
import {
  createCameraRig,
  type CameraMode,
  type RigInput,
} from "../../src/render/camera/cameraRig";
import { discGlow, stepDiscHeat } from "../../src/render/car/brakeDisc";
import {
  clodRate,
  createDustPool,
  DUST_POOL_SIZE,
} from "../../src/render/fx/dustPool";
import { createExhaustFlash } from "../../src/render/fx/exhaustFlash";
import {
  createImpactDetector,
  impactContact,
} from "../../src/render/fx/impactSpark";
import { createShiftJolt } from "../../src/render/fx/shiftJolt";
import { createSkidPool, SKID_SEGMENTS } from "../../src/render/fx/skidPool";
import { wheelContactPoint } from "../../src/render/fx/wheelContact";
import { carConfig, wheelRestPosition } from "../../src/sim/carConfig";
import type { CarState, WheelState } from "../../src/sim/types";

const yawQuat = (yaw: number) => ({
  x: 0,
  y: Math.sin(yaw / 2),
  z: 0,
  w: Math.cos(yaw / 2),
});

const wheel = (over: Partial<WheelState> = {}): WheelState => ({
  steerAngle: 0,
  spinAngle: 0,
  offsetY: 0,
  compression: 0.3,
  inContact: true,
  surface: "asphalt",
  slip: 0,
  ...over,
});

const carState = (over: Partial<CarState> = {}): CarState => ({
  position: { x: 0, y: 0.5, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  linearVelocity: { x: 0, y: 0, z: 0 },
  speed: 0,
  forwardSpeed: 0,
  rpm: 900,
  gear: 1,
  throttle: 0,
  brake: 0,
  handbrake: false,
  wheels: [wheel(), wheel(), wheel(), wheel()],
  impact: 0,
  ...over,
});

const input = (
  yaw: number,
  velocity: { x: number; z: number },
  position = { x: 0, y: 0, z: 0 },
): RigInput => ({
  pose: { position, rotation: yawQuat(yaw) },
  velocity: { x: velocity.x, y: 0, z: velocity.z },
  forwardSpeed: -Math.sin(yaw) * velocity.x - Math.cos(yaw) * velocity.z,
  grass: 0,
  impact: 0,
  gear: 0,
  orbit: 0,
});

/** Trajectoire analytique : les mêmes instants donnent les mêmes entrées, quelle que soit la cadence. */
type Scenario = (t: number) => RigInput;

const curve: Scenario = (t) => {
  const yaw = 0.5 * t;
  const speed = 20 + 4 * t;
  // Virage à vitesse de lacet constante : position intégrée finement, identique pour toutes les cadences.
  let x = 0;
  let z = 0;
  const steps = 2000;
  for (let i = 0; i < steps; i++) {
    const s = ((i + 0.5) / steps) * t;
    const ds = (20 + 4 * s) * (t / steps);
    x += -Math.sin(0.5 * s) * ds;
    z += -Math.cos(0.5 * s) * ds;
  }
  return input(
    yaw,
    { x: -Math.sin(yaw) * speed, z: -Math.cos(yaw) * speed },
    { x, y: 0.2 * Math.sin(3 * t), z },
  );
};

const turnAround: Scenario = () => input(Math.PI / 2, { x: 0, z: 0 });

const runAt = (
  hz: number,
  scenario: Scenario,
  start: RigInput,
  mode: CameraMode,
): Vector3 => {
  const rig = createCameraRig();
  rig.snap(start, mode);
  for (let i = 1; i <= hz; i++) rig.update(scenario(i / hz), 1 / hz, mode);
  return rig.output.position.clone();
};

const checkCadence = (): void => {
  const scenarios: [string, Scenario, RigInput][] = [
    ["virage en accélérant", curve, curve(0)],
    ["demi-tour de la caisse", turnAround, input(0, { x: 0, z: 0 })],
  ];
  for (const [name, scenario, start] of scenarios) {
    const reference = runAt(144, scenario, start, "chase");
    const car = scenario(1).pose.position;
    const span = reference.distanceTo(new Vector3(car.x, car.y, car.z));
    for (const hz of [30, 60]) {
      const gap = runAt(hz, scenario, start, "chase").distanceTo(reference);
      assert.ok(
        gap / span < 0.01,
        `${name} : ${hz} Hz s'écarte de ${((gap / span) * 100).toFixed(2)} % de la distance caméra-voiture`,
      );
    }
  }
};

const noise = (index: number): number =>
  (Math.sin(index * 12.9898) * 43758.5453) % 1;

const checkNoAndReverse = (): void => {
  // À l'arrêt : un vecteur vitesse bruité, dans toutes les directions, ne fait pas tourner la caméra.
  const rig = createCameraRig();
  const bodyYaw = 0.7;
  rig.snap(input(bodyYaw, { x: 0, z: 0 }), "chase");
  for (let i = 0; i < 600; i++) {
    const velocity = { x: noise(i) * 1.3, z: noise(i + 1000) * 1.3 };
    rig.update(input(bodyYaw, velocity), 1 / 60, "chase");
    assert.ok(
      Math.abs(rig.output.yaw - bodyYaw) < 1e-9,
      `à l'arrêt, cap dévié de ${rig.output.yaw - bodyYaw} rad`,
    );
  }

  // Marche arrière rapide, bruitée : la caméra reste derrière la caisse et ne se retourne pas.
  const reverse = createCameraRig();
  reverse.snap(input(0, { x: 0, z: 0 }), "chase");
  for (let i = 0; i < 300; i++) {
    const velocity = { x: noise(i) * 2, z: 12 + noise(i + 500) * 2 };
    reverse.update(input(0, velocity), 1 / 60, "chase");
    assert.ok(
      Math.abs(reverse.output.yaw) < 1e-9,
      `en marche arrière, cap dévié de ${reverse.output.yaw} rad`,
    );
    assert.ok(
      reverse.output.position.z > 0,
      "la caméra est passée devant la voiture",
    );
  }

  // En glisse à 35 degrés : le cap suit davantage la vitesse que la caisse.
  const drift = createCameraRig();
  const slide = 35 * (Math.PI / 180);
  const velocity = { x: -Math.sin(slide) * 25, z: -Math.cos(slide) * 25 };
  drift.snap(input(0, velocity), "chase");
  assert.ok(
    drift.output.yaw > slide * 0.6 && drift.output.yaw < slide,
    `cap en glisse : ${drift.output.yaw} rad`,
  );

  // Remise en piste : aucune trace de l'ancien cap ni de l'ancienne position.
  const teleport = createCameraRig();
  teleport.snap(input(0, { x: 0, z: -30 }), "chase");
  for (let i = 0; i < 60; i++)
    teleport.update(input(0, { x: 0, z: -30 }), 1 / 60, "chase");
  const fresh = input(2, { x: 0, z: 0 }, { x: 500, y: 3, z: -200 });
  teleport.snap(fresh, "chase");
  const clean = createCameraRig();
  clean.snap(fresh, "chase");
  assert.ok(teleport.output.yaw === clean.output.yaw);
  assert.ok(teleport.output.position.distanceTo(clean.output.position) < 1e-9);

  // Stick droit : la caméra passe à droite de la voiture, la vise toujours, puis revient derrière.
  const still = input(0, { x: 0, z: 0 });
  const orbiting = createCameraRig();
  orbiting.snap({ ...still, orbit: 0.5 }, "chase");
  const side = orbiting.output.position;
  assert.ok(
    side.x > 6.9 && Math.abs(side.z) < 1e-9,
    `orbite à droite : ${side.x}, ${side.z}`,
  );
  const aim = new Vector3(0, 0, -1).applyQuaternion(orbiting.output.quaternion);
  assert.ok(aim.x < -0.9, `la caméra ne vise plus la voiture : ${aim.x}`);
  orbiting.snap({ ...still, orbit: 1 }, "chase");
  assert.ok(side.z < -6.9, `stick à fond, vue de face : ${side.z}`);
  for (let i = 0; i < 120; i++) orbiting.update(still, 1 / 60, "chase");
  assert.ok(
    side.z > 6.9 && Math.abs(side.x) < 0.1,
    `retour derrière : ${side.x}, ${side.z}`,
  );

  // La vue capot ne tourne pas.
  const hoodOrbit = createCameraRig();
  hoodOrbit.snap({ ...still, orbit: 1 }, "hood");
  const hoodStill = createCameraRig();
  hoodStill.snap(still, "hood");
  assert.ok(
    hoodOrbit.output.quaternion.angleTo(hoodStill.output.quaternion) < 1e-9,
  );

  // Vue capot : tangage de 0,2 rad très atténué une fois stabilisé.
  const hood = createCameraRig();
  const pitched: RigInput = {
    ...input(0, { x: 0, z: 0 }),
    pose: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: Math.sin(0.1), y: 0, z: 0, w: Math.cos(0.1) },
    },
  };
  hood.snap(pitched, "hood");
  const lookDir = new Vector3(0, 0, -1).applyQuaternion(hood.output.quaternion);
  assert.ok(
    Math.abs(Math.asin(lookDir.y) - 0.06) < 1e-3,
    `tangage capot : ${lookDir.y}`,
  );
};

/** Faux `AudioContext` minimal : enregistre les valeurs visées et refuse toute écriture directe après le démarrage. */
const createFakeAudio = () => {
  const record = { started: false, oscillators: [] as FakeNode[], resumed: 0 };
  const param = (initial: number) => {
    const state = {
      value: initial,
      targets: [] as { value: number; at: number }[],
      setTargetAtTime: (value: number, at: number, tc: number) => {
        assert.ok(tc > 0, "constante de temps nulle : risque de clic");
        state.targets.push({ value, at });
      },
      cancelScheduledValues: () => undefined,
      setValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
    };
    return state;
  };
  type FakeParam = ReturnType<typeof param>;
  interface FakeNode {
    frequency: FakeParam;
    detune: FakeParam;
    gain: FakeParam;
    Q: FakeParam;
    type: string;
    buffer: unknown;
    loop: boolean;
    connect: () => void;
    disconnect: () => void;
    start: () => void;
    stop: () => void;
    setPeriodicWave: () => void;
  }
  const node = (): FakeNode => ({
    setPeriodicWave(this: FakeNode) {
      this.type = "custom";
    },
    frequency: param(0),
    detune: param(0),
    gain: param(0),
    Q: param(0),
    type: "",
    buffer: null,
    loop: false,
    connect: () => undefined,
    disconnect: () => undefined,
    start: () => {
      record.started = true;
    },
    stop: () => undefined,
  });
  const context = {
    currentTime: 1,
    sampleRate: 8000,
    state: "suspended",
    destination: node(),
    createGain: node,
    createBiquadFilter: node,
    createDynamicsCompressor: node,
    createWaveShaper: node,
    createPeriodicWave: () => ({}),
    createBufferSource: node,
    createOscillator: () => {
      const osc = node();
      record.oscillators.push(osc);
      return osc;
    },
    createBuffer: (_: number, length: number) => {
      const samples = new Float32Array(length);
      return { getChannelData: () => samples };
    },
    resume: async () => {
      record.resumed++;
      context.state = "running";
    },
    suspend: async () => undefined,
    close: async () => undefined,
  };
  return { context: context as unknown as AudioContext, record };
};

const lastTarget = (p: {
  targets: { value: number }[];
  value: number;
}): number => p.targets.at(-1)?.value ?? p.value;

const checkAudio = (): void => {
  // Sans AudioContext (Node n'en a pas) : aucune méthode ne plante.
  const silent = createCarAudio();
  silent.start();
  silent.update(carState(), 1 / 60);
  silent.setMuted(true);
  assert.equal(silent.toggleMute(), false);
  silent.setVolume(0.5);
  silent.dispose();

  const { context, record } = createFakeAudio();
  // Le moteur atmo : le sifflement du turbo varierait encore à régime stable, et sa sinusoïde se confondrait avec le choc.
  const audio = createCarAudio(context, "atmo");
  audio.update(carState(), 1 / 60); // avant start : ignoré sans planter
  assert.equal(record.started, false);
  audio.start();
  audio.start(); // idempotent
  assert.ok(record.started);
  assert.ok(record.resumed >= 1, "un contexte suspendu doit être relancé");
  const engine = record.oscillators.filter((osc) => osc.type === "custom");
  assert.equal(engine.length, 2);

  // Contexte encore bloqué par le navigateur : aucun ordre, et le HUD le signale jusqu'au déblocage.
  const state = context as unknown as { state: string };
  state.state = "suspended";
  audio.update(carState({ rpm: 3000, impact: 0.8 }), 1 / 30);
  assert.equal(audio.debug()?.writes, 0);
  assert.equal(audio.isBlocked(), true);
  audio.unlock();
  assert.equal(audio.isBlocked(), false);
  assert.equal(state.state, "running");

  // En pause, un clic dans le menu ne relance pas le son.
  audio.setPaused(true);
  state.state = "suspended";
  audio.unlock();
  assert.equal(state.state, "suspended");
  audio.setPaused(false);
  assert.equal(state.state, "running");

  // Rien ne change : plus aucun ordre vers le fil audio.
  audio.update(carState({ rpm: 3000, throttle: 0.5, gear: 2 }), 1 / 30);
  const writesBefore = audio.debug()?.writes;
  for (let i = 0; i < 300; i++)
    audio.update(carState({ rpm: 3000, throttle: 0.5, gear: 2 }), 1 / 30);
  assert.equal(audio.debug()?.writes, writesBefore);

  // Les fréquences suivent le régime, proportionnellement, pour chaque oscillateur.
  audio.update(carState({ rpm: 2000, throttle: 0.5, gear: 2 }), 1 / 30);
  const low = engine.map((osc) => lastTarget(osc.frequency));
  audio.update(carState({ rpm: 6000, throttle: 0.5, gear: 2 }), 1 / 30);
  const high = engine.map((osc) => lastTarget(osc.frequency));
  for (let i = 0; i < engine.length; i++)
    assert.ok(
      Math.abs(high[i] / low[i] - 3) < 1e-9,
      `oscillateur ${i} : ${low[i]} -> ${high[i]}`,
    );
  assert.ok(Math.abs(low[0] - 2000 / 120) < 1e-9, `cycle moteur : ${low[0]}`);

  // Le choc déclenche le grave, la voix suit le front montant.
  const sine = record.oscillators.find((osc) => osc.type === "sine");
  assert.ok(sine);
  const before = sine.frequency.targets.length;
  audio.update(carState({ rpm: 6000, gear: 2, impact: 0.8 }), 1 / 30);
  assert.ok(
    sine.frequency.targets.length > before,
    "le choc doit être audible",
  );

  // Crissement : muet tant que le pneu accroche ou que la voiture roule au pas, plein en pleine glisse.
  const { threshold } = DEFAULT_TIRE_SOUND;
  assert.equal(squealAmount(threshold - 0.1, 30, threshold), 0);
  assert.equal(squealAmount(1, 2, threshold), 0);
  assert.equal(squealAmount(1, 30, threshold), 1);
  const peak = (slip: number): number => {
    const levels = new Map<AudioParam, number>();
    const voice = createTireVoice(
      createFakeAudio().context,
      createFakeAudio().context.destination,
      (param, value) => levels.set(param, value),
    );
    voice.update(slip, 30);
    voice.dispose();
    return Math.max(...levels.values());
  };
  // Au repos, seule la hauteur des bandes reste écrite : moins haute qu'avec la pleine glisse.
  assert.ok(peak(1) > peak(0), "la glisse doit changer la voix des pneus");

  // Le changement de rapport et les états extrêmes ne plantent pas.
  audio.update(carState({ rpm: 4000, gear: 3 }), 1 / 30);
  audio.update(carState({ rpm: 0, gear: 0, wheels: [] }), 1 / 30);
  audio.setMuted(true);
  assert.equal(audio.isMuted(), true);
  audio.dispose();
  audio.dispose();
  audio.update(carState(), 1 / 30);
};

const checkHud = (): void => {
  // Menu à la manette : Start ouvre et ferme la pause.
  assert.equal(nextScreen("race", false, false), "race");
  assert.equal(nextScreen("race", false, true), "pause");
  assert.equal(nextScreen("pause", false, true), "race");
  assert.equal(nextScreen("pause", false, false), "pause");
  // Au départ, Start lance la course, sauf tant que le son est bloqué.
  assert.equal(nextScreen("start", true, true), "start");
  assert.equal(nextScreen("start", false, true), "race");
  assert.equal(nextScreen("start", false, false), "start");

  // Une seconde à 144 Hz, vitesse qui change à chaque image : au plus 10 publications.
  let publications = 0;
  const unsubscribe = useHudStore.subscribe(() => publications++);
  const baseMs = 1_000_000;
  for (let i = 0; i < 144; i++)
    pushHud(carState({ speed: 10 + i, gear: 2 }), baseMs + (i * 1000) / 144);
  assert.ok(
    publications >= 9 && publications <= 11,
    `${publications} publications en 1 s`,
  );
  assert.equal(HUD_PERIOD_MS, 100);
  assert.ok(useHudStore.getState().speedKmh > 0);

  // Le chrono appelé à chaque image reste lui aussi limité, mais un nouveau tour passe immédiatement.
  publications = 0;
  for (let i = 0; i < 60; i++) setLapTimes({ lapMs: i * (1000 / 60) });
  assert.ok(publications <= 11, `chrono : ${publications} publications`);
  setLapTimes({ lapMs: 0, lastLapMs: 61000, bestLapMs: 61000 });
  assert.equal(useHudStore.getState().lastLapMs, 61000);
  assert.equal(useHudStore.getState().lapMs, 0);
  unsubscribe();
};

const checkFx = (): void => {
  // La position vient bien de la roue réelle : pose, repos et débattement.
  const out = new Vector3();
  const rest = wheelRestPosition(carConfig, 0);
  wheelContactPoint(
    { position: { x: 10, y: 1, z: 20 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
    wheel({ offsetY: 0.1 }),
    0,
    out,
  );
  assert.ok(Math.abs(out.x - (10 + rest.x)) < 1e-9);
  assert.ok(
    Math.abs(out.y - (1 + rest.y + 0.1 - carConfig.front.wheelRadius)) < 1e-6,
  );
  assert.ok(Math.abs(out.z - (20 + rest.z)) < 1e-9);

  // Tampon circulaire : on écrit bien plus que sa capacité sans le dépasser, à taille constante.
  const skid = createSkidPool();
  const length = skid.data.length;
  const sliding = [0, 1, 2, 3].map(() => wheel({ slip: 1 }));
  const state = carState({
    speed: 30,
    linearVelocity: { x: 0, y: 0, z: -30 },
    wheels: sliding,
  });
  const pose = {
    position: { x: 0, y: 0.5, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
  for (let i = 0; i < SKID_SEGMENTS; i++) {
    pose.position.z -= 0.5;
    skid.update(state, pose, 1 / 60);
  }
  assert.ok(
    skid.written() > SKID_SEGMENTS,
    `${skid.written()} segments écrits`,
  );
  assert.equal(skid.data.length, length);
  // Hauteur : au-dessus du point de contact, jamais dessous.
  const contactY = pose.position.y + rest.y - carConfig.front.wheelRadius;
  assert.ok(
    skid.data[1] > contactY && skid.data[1] < contactY + 0.1,
    `y = ${skid.data[1]}`,
  );

  // Une remise en piste ne relie pas l'ancienne et la nouvelle position.
  const before = skid.written();
  skid.breakTrails();
  pose.position.x += 800;
  skid.update(state, pose, 1 / 60);
  assert.equal(skid.written(), before);

  // Sans glissement sur l'asphalte : aucune trace ni fumée.
  const calm = createSkidPool();
  const dust = createDustPool();
  const grip = carState({ speed: 30, linearVelocity: { x: 0, y: 0, z: -30 } });
  for (let i = 0; i < 60; i++) {
    calm.update(grip, pose, 1 / 60);
    dust.update(grip, pose, 1 / 60);
  }
  assert.equal(calm.written(), 0);
  assert.equal(dust.emitted(), 0);

  // Glisse et herbe émettent, même cumul quelle que soit la cadence, dans un pool fixe.
  const emittedAt = (hz: number, st: CarState): number => {
    const pool = createDustPool();
    for (let i = 0; i < hz; i++) pool.update(st, pose, 1 / hz);
    return pool.emitted();
  };
  const smoke = carState({ speed: 20, wheels: sliding });
  const onGrass = carState({
    speed: 25,
    wheels: [0, 1, 2, 3].map(() => wheel({ surface: "grass" })),
  });
  for (const st of [smoke, onGrass]) {
    const reference = emittedAt(144, st);
    assert.ok(reference > 0);
    assert.ok(
      reference < DUST_POOL_SIZE,
      `${reference} particules par seconde dépassent le pool`,
    );
    for (const hz of [30, 60])
      assert.ok(
        Math.abs(emittedAt(hz, st) - reference) <= 8,
        `${hz} Hz : ${emittedAt(hz, st)} / ${reference}`,
      );
  }
};

const checkCarFx = (): void => {
  // Flamme : elle attend son heure, part une seule fois, puis s'éteint.
  const flash = createExhaustFlash();
  let started = 0;
  const tick = (dt: number): number =>
    flash.update(dt, () => {
      started++;
    });
  flash.trigger(0.1, 1);
  assert.equal(tick(0.05), 0);
  assert.equal(started, 0);
  assert.ok(tick(0.06) > 0.5);
  assert.equal(started, 1);
  tick(0.2);
  assert.equal(tick(0.01), 0);
  assert.equal(started, 1);
  // Une image très longue saute la flamme sans perdre ses étincelles.
  flash.trigger(0, 1);
  assert.equal(tick(1), 0);
  assert.equal(started, 2);

  // À-coup : rien à rapport constant ni vers la marche arrière, plus fort en montant.
  const peakAfter = (from: number, to: number): number => {
    const jolt = createShiftJolt();
    jolt.update(from, 1 / 60);
    let peak = Math.abs(jolt.update(to, 1 / 60));
    for (let i = 0; i < 60; i++)
      peak = Math.max(peak, Math.abs(jolt.update(to, 1 / 60)));
    return peak;
  };
  assert.equal(peakAfter(2, 2), 0);
  assert.equal(peakAfter(1, -1), 0);
  assert.ok(peakAfter(2, 3) > 0.3);
  assert.ok(peakAfter(3, 2) < peakAfter(2, 3));
  const settled = createShiftJolt();
  settled.update(2, 1 / 60);
  settled.update(3, 1 / 60);
  let last = 1;
  for (let i = 0; i < 120; i++) last = settled.update(3, 1 / 60);
  assert.ok(Math.abs(last) < 0.01, `à-coup non amorti : ${last}`);
  // Une caméra recalée ne tressaille pas.
  settled.reset(1);
  assert.equal(settled.update(1, 1 / 60), 0);

  // Mottes : sur l'herbe seulement, et plus la roue glisse, plus il y en a.
  assert.equal(clodRate("asphalt", 1, 30), 0);
  assert.equal(clodRate("grass", 1, 2), 0);
  assert.ok(clodRate("grass", 1, 25) > clodRate("grass", 0, 25));

  // Disques : froids sans freiner, rouges après un gros freinage, puis refroidissent.
  let heat = 0;
  for (let i = 0; i < 60; i++) heat = stepDiscHeat(heat, 0, 40, 0.6, 1 / 60);
  assert.equal(discGlow(heat), 0);
  for (let i = 0; i < 180; i++) heat = stepDiscHeat(heat, 1, 40, 0.6, 1 / 60);
  assert.ok(discGlow(heat) > 0.5, `lueur ${discGlow(heat)}`);
  const hot = heat;
  for (let i = 0; i < 600; i++) heat = stepDiscHeat(heat, 0, 0, 0.6, 1 / 60);
  assert.ok(heat < hot * 0.25);

  // Choc : seul un front montant assez fort donne des étincelles, et un frottement n'en crache pas à chaque image.
  const detector = createImpactDetector();
  assert.equal(detector.update(0.1, 1 / 60), 0);
  assert.equal(detector.update(0.8, 1 / 60), 0.8);
  assert.equal(detector.update(0.7, 1 / 60), 0, "le choc retombe");
  assert.equal(detector.update(0.75, 1 / 60), 0, "trop tôt après le précédent");
  for (let i = 0; i < 10; i++) detector.update(0.2, 1 / 60);
  assert.equal(detector.update(0.6, 1 / 60), 0.6);

  // La voiture repart vers +Z : le contact est sur le nez (-Z), et la voiture tournée d'un quart de tour suit.
  const halves = { x: 1, y: 0.5, z: 2 };
  const contact = new Vector3();
  const away = new Vector3();
  const atOrigin = {
    position: { x: 10, y: 1, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
  impactContact(atOrigin, { x: 0, y: 0, z: 5 }, halves, contact, away);
  assert.ok(contact.distanceTo(new Vector3(10, 1, -2)) < 1e-6);
  assert.ok(away.distanceTo(new Vector3(0, 0, 1)) < 1e-6);
  // Quart de tour : le côté droit local (+X) regarde vers -Z du monde.
  impactContact(
    { ...atOrigin, rotation: yawQuat(Math.PI / 2) },
    { x: 0, y: 0, z: 5 },
    halves,
    contact,
    away,
  );
  assert.ok(contact.distanceTo(new Vector3(10, 1, -1)) < 1e-6);
  // Sans variation de vitesse : l'avant, sans NaN.
  impactContact(atOrigin, { x: 0, y: 0, z: 0 }, halves, contact, away);
  assert.ok(contact.distanceTo(new Vector3(10, 1, -2)) < 1e-6);

  // Une détonation écrit dans le pool.
  const dust = createDustPool();
  dust.burst({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1);
  assert.ok(dust.emitted() >= 3);
  const sparked = dust.emitted();
  dust.impactSparks({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, away, 1, 0.5);
  assert.ok(dust.emitted() - sparked >= 20, "gerbe trop maigre");
};

const checkMenuAction = (): void => {
  let clicks = 0;
  const button = {
    dataset: { needsSound: "" },
    click: () => {
      clicks++;
    },
    focus: () => undefined,
  };
  const page = globalThis as { document?: unknown };
  page.document = {
    activeElement: button,
    querySelector: (selector: string) =>
      selector === "dialog[open]" ? { querySelectorAll: () => [button] } : null,
  };
  // Son bloqué : A ne lance pas la course, une fois débloqué si.
  applyMenuAction("confirm", true);
  assert.equal(clicks, 0);
  applyMenuAction("confirm", false);
  assert.equal(clicks, 1);
  // B reprend la course en pause, mais ne la lance pas depuis le menu de départ.
  setHudScreen("start");
  applyMenuAction("cancel", false);
  assert.equal(useHudStore.getState().screen, "start");
  setHudScreen("pause");
  applyMenuAction("cancel", false);
  assert.equal(useHudStore.getState().screen, "race");
  delete page.document;
};

export default async function check(): Promise<void> {
  checkCadence();
  checkNoAndReverse();
  checkAudio();
  checkHud();
  checkFx();
  checkCarFx();
  checkMenuAction();
  // Sans manette ni `getGamepads` : la vibration ne fait rien, sans planter.
  updateRumble(carState({ impact: 1, speed: 30 }), 0);
}
