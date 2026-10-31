// Vibration manette selon le glissement et les chocs. Sans `vibrationActuator`, ne fait rien.
// Chaque envoi part vers le périphérique : on en fait le moins possible, jamais deux à la fois.
import type { CarState } from "@/sim/types";

const PERIOD_MS = 250;
const EFFECT_MS = 300;
const MIN_MAGNITUDE = 0.03;
/** En dessous de cet écart, l'effet en cours suffit tant qu'il n'est pas terminé */
const MIN_CHANGE = 0.12;
const IMPACT_DECAY_PER_MS = 0.005;

// `?norumble` dans l'URL : compare une capture avec et sans vibration.
const enabled =
  typeof location === "undefined" ||
  !new URLSearchParams(location.search).has("norumble");
let inFlight = false;
let sends = 0;
let lastSentAt = Number.NEGATIVE_INFINITY;
let lastWeak = 0;
let lastStrong = 0;
let lastImpact = 0;
let impactPulse = 0;
let lastUpdateAt = 0;

const findActuator = (): GamepadHapticActuator | null => {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.getGamepads !== "function"
  )
    return null;
  for (const pad of navigator.getGamepads()) {
    if (pad?.vibrationActuator?.playEffect) return pad.vibrationActuator;
  }
  return null;
};

/** Envois depuis le début, et depuis combien de temps le dernier est sans réponse. */
export const rumbleDiag = (
  now: number,
): { sends: number; pendingMs: number } => ({
  sends,
  pendingMs: inFlight ? now - lastSentAt : 0,
});

export const updateRumble = (
  state: CarState,
  now: number = performance.now(),
): void => {
  if (!enabled) return;
  const elapsed = Math.max(0, now - lastUpdateAt);
  lastUpdateAt = now;
  impactPulse = Math.max(0, impactPulse - elapsed * IMPACT_DECAY_PER_MS);
  if (state.impact > lastImpact + 0.02)
    impactPulse = Math.max(impactPulse, state.impact);
  lastImpact = state.impact;

  if (inFlight || now - lastSentAt < PERIOD_MS) return;

  let slip = 0;
  let grass = 0;
  for (const wheel of state.wheels) {
    if (!wheel.inContact) continue;
    slip = Math.max(slip, wheel.slip);
    if (wheel.surface === "grass") grass = 1;
  }
  const speedFactor = Math.min(1, state.speed / 20);
  const weak = Math.min(1, slip * 0.55 + grass * 0.25 * speedFactor);
  const strong = Math.min(1, impactPulse + grass * 0.15 * speedFactor);
  if (weak < MIN_MAGNITUDE && strong < MIN_MAGNITUDE) return;
  const running = now - lastSentAt < EFFECT_MS;
  if (
    running &&
    Math.abs(weak - lastWeak) < MIN_CHANGE &&
    Math.abs(strong - lastStrong) < MIN_CHANGE
  )
    return;

  const actuator = findActuator();
  if (!actuator) return;
  lastSentAt = now;
  lastWeak = weak;
  lastStrong = strong;
  inFlight = true;
  sends++;
  actuator
    .playEffect("dual-rumble", {
      duration: EFFECT_MS,
      startDelay: 0,
      strongMagnitude: strong,
      weakMagnitude: weak,
    })
    .catch(() => undefined)
    .finally(() => {
      inFlight = false;
    });
};
