import assert from "node:assert/strict";
import type { CopilotVoice, VoiceBus } from "../../src/audio/copilotVoice";
import { createCopilot, type CopilotSim } from "../../src/game/copilot";
import { miniMapOutline } from "../../src/game/Hud/miniMapOutline";
import { setHudPaceNotes, useHudStore } from "../../src/game/hudStore";
import type { PaceNote } from "../../src/sim/track/paceNotes";
import { createNotesBenchStage } from "../../src/sim/track/notesBenchTrack";
import { createSandboxTrack } from "../../src/sim/track/sandboxTrack";
import { createStageTrack } from "../../src/sim/track/stage";
import type { CarState } from "../../src/sim/types";

const DT = 1 / 60;
const SPEED = 15;

const setup = () => {
  const track = createStageTrack(createNotesBenchStage());
  const state = {
    position: { ...track.points[track.indexAt(track.startS)] },
    speed: SPEED,
  } as unknown as CarState;
  const world = { finished: false, muted: false, contextState: "running" };
  const sim: CopilotSim = {
    track,
    lap: { finished: () => world.finished },
    state: () => state,
    respawnCount: () => 0,
  };
  const played: string[] = [];
  let stops = 0;
  const voice = {
    play: (call) => {
      played.push(call.notes.map((note) => note.startS).join());
    },
    stop: () => {
      stops++;
    },
    durationOf: () => 1,
  } as Partial<CopilotVoice> as CopilotVoice;
  const copilot = createCopilot(
    sim,
    {
      voiceBus: () =>
        ({ context: { state: world.contextState } }) as unknown as VoiceBus,
      isMuted: () => world.muted,
      setMix: () => undefined,
    },
    voice,
  );
  let s = track.startS;
  /** Roule jusqu'à la prochaine annonce, sans écrire autre chose que la position de la voiture factice */
  const driveToCall = (): void => {
    const before = useHudStore.getState().paceCall;
    while (useHudStore.getState().paceCall === before) {
      s += SPEED * DT;
      assert.ok(s < track.finishS, "aucune annonce avant l'arrivée");
      const point = track.points[track.indexAt(s)];
      state.position.x = point.x;
      state.position.z = point.z;
      copilot.update(DT, "race");
    }
  };
  return {
    copilot,
    world,
    played,
    driveToCall,
    stops: () => stops,
    rewind: () => {
      s = track.startS;
      state.position = { ...track.points[track.indexAt(s)] };
    },
  };
};

const checkMenus = (): void => {
  const { copilot, played } = setup();
  for (let i = 0; i < 600; i++) copilot.update(DT, "start");
  assert.equal(played.length, 0, "annonce dans le menu de départ");
  assert.equal(useHudStore.getState().paceCall, null);
  copilot.reset();
};

const checkMute = (): void => {
  const { copilot, world, played, driveToCall, stops } = setup();
  driveToCall();
  assert.equal(played.length, 1);
  world.muted = true;
  const stopped = stops();
  copilot.update(DT, "race");
  assert.equal(stops(), stopped + 1, "`M` coupe la phrase en cours");
  copilot.update(DT, "race");
  assert.equal(stops(), stopped + 1, "une seule coupure par passage en muet");
  driveToCall();
  assert.equal(played.length, 1, "muet : le calcul continue, sans voix");
  assert.ok(
    useHudStore.getState().paceNotes.length > 0,
    "muet : les icônes restent",
  );
  copilot.reset();
};

const checkPause = (): void => {
  const { copilot, world, played, driveToCall, stops } = setup();
  driveToCall();
  const first = played[0];
  const stopped = stops();
  world.contextState = "suspended";
  copilot.update(DT, "pause");
  assert.equal(stops(), stopped + 1, "la pause coupe la phrase");
  for (let i = 0; i < 600; i++) copilot.update(DT, "pause");
  // À la reprise, le contexte n'est pas encore relancé : `start()` serait perdu.
  copilot.update(DT, "race");
  assert.equal(played.length, 1, "redite avant que le contexte tourne");
  world.contextState = "running";
  copilot.update(DT, "race");
  assert.deepEqual(played, [first, first], "la phrase coupée est redite");
  copilot.reset();
};

const checkVoiceOff = (): void => {
  const { copilot, played, driveToCall } = setup();
  copilot.setVoiceEnabled(false);
  driveToCall();
  assert.equal(played.length, 0, "voix désactivée");
  assert.ok(useHudStore.getState().paceCall, "le calcul continue voix coupée");
  copilot.setVoiceEnabled(true);
  driveToCall();
  assert.equal(played.length, 1, "voix rétablie pour la phrase suivante");
  copilot.reset();
};

const checkVoiceBackInPause = (): void => {
  const { copilot, played, driveToCall } = setup();
  copilot.setVoiceEnabled(false);
  driveToCall();
  copilot.update(DT, "pause");
  copilot.setVoiceEnabled(true);
  copilot.update(DT, "race");
  assert.equal(played.length, 1, "réactivée en pause : l'annonce en cours");
  const current = played[0];
  driveToCall();
  assert.equal(played.length, 2);
  assert.notEqual(played[1], current, "puis l'annonce suivante, sans redite");
  copilot.reset();
};

const checkFinish = (): void => {
  const { copilot, world, played, driveToCall } = setup();
  driveToCall();
  world.finished = true;
  copilot.update(DT, "race");
  assert.equal(
    useHudStore.getState().paceNotes.length,
    0,
    "icônes à l'arrivée",
  );
  // Une pause juste après l'arrivée ne redit rien.
  copilot.update(DT, "pause");
  copilot.update(DT, "race");
  assert.equal(played.length, 1, "annonce après l'arrivée");
  copilot.reset();
};

const checkRestart = (): void => {
  const { copilot, played, driveToCall, stops, rewind } = setup();
  driveToCall();
  const stopped = stops();
  rewind();
  copilot.reset();
  assert.equal(stops(), stopped + 1, "redémarrage : phrase coupée");
  assert.equal(useHudStore.getState().paceNotes.length, 0);
  driveToCall();
  assert.deepEqual(played[1], played[0], "redémarrage : première annonce");
  copilot.reset();
};

const checkMiniMap = (): void => {
  const stage = createStageTrack(createNotesBenchStage());
  const open = miniMapOutline(stage);
  assert.equal(open.start, stage.points[stage.indexAt(stage.startS)]);
  assert.equal(open.finish, stage.points[stage.indexAt(stage.finishS)]);
  assert.ok(!open.path.endsWith("Z"));
  const closed = miniMapOutline(createSandboxTrack());
  assert.ok(closed.path.endsWith("Z"));
  const longTrack = {
    ...stage,
    points: Array.from({ length: 7500 }, (_, i) => ({ x: i, y: 0, z: i % 7 })),
    closed: true,
  };
  assert.ok(
    miniMapOutline(longTrack).path.split("L").length <= 241,
    "15 km : tracé réduit",
  );
};

const checkChainFrame = (): void => {
  const notes = Array.from({ length: 6 }, (_, i): PaceNote => ({
    kind: "bump",
    startS: i * 10,
    endS: i * 10 + 5,
  }));
  const chainOf = () => useHudStore.getState().paceChain;
  // Enfilade de 5 notes qui commence en deuxième position : ouverte à droite.
  setHudPaceNotes(notes, notes.slice(1, 6));
  assert.deepEqual(chainOf(), { start: 1, end: 2, open: true });
  // Les dernières notes de l'enfilade tiennent dans la bande : le cadre se referme.
  setHudPaceNotes(notes.slice(3), notes.slice(1, 5));
  assert.deepEqual(chainOf(), { start: 0, end: 1, open: false });
  setHudPaceNotes(notes);
  assert.equal(chainOf(), null);
  setHudPaceNotes([]);
};

export default async function check(): Promise<void> {
  checkChainFrame();
  checkMenus();
  checkMute();
  checkPause();
  checkVoiceOff();
  checkVoiceBackInPause();
  checkFinish();
  checkRestart();
  checkMiniMap();
}
