import type { PaceCall, PaceNote } from "./track/paceNotes";
import type { Track } from "./types";

/** Une phrase finit ce temps avant son virage, en secondes. Se règle au volant, à chaque vitesse de diction. */
const ANTICIPATION = 1;
/** Une voiture qui sort d'un virage accélère pendant la phrase : marge ajoutée à la vitesse lue, en m/s² */
const PLAN_ACCEL = 2;
/** Une annonce ne part jamais plus près de son virage que ça, sauf retard, en mètres */
const MIN_CUE_DISTANCE = 25;
/** Nombre d'annonces à venir prises en compte pour planifier à rebours */
const PLAN_CALLS = 8;
/** Au-delà de ce retard sur le planning, la phrase perd ses précisions, en secondes */
const MAX_LATE = 0.5;
/** Saut d'abscisse au-delà duquel `nearest()` a changé de branche, en mètres */
const MAX_JUMP = 25;
/** Un saut n'est admis qu'après avoir progressé d'autant sur la nouvelle branche, en mètres. Une branche d'épingle se lit à rebours : elle n'avance jamais. */
const JUMP_CONFIRM = 25;
/** Recul toléré avant de suspendre les annonces, en mètres : l'abscisse tremble un peu, même à l'arrêt */
const REVERSE_MARGIN = 2;

export interface CueTiming {
  /** Secondes, vitesse de diction comprise */
  durationOf: (call: PaceCall, short: boolean) => number;
}

export interface PaceCue {
  call: PaceCall;
  short: boolean;
  index: number;
}

interface SpokenCue extends PaceCue {
  startAt: number;
  endAt: number;
}

export interface CueInput {
  x: number;
  z: number;
  /** Vitesse en m/s, toujours positive */
  speed: number;
  /** Temps de course en secondes : figé pendant la pause */
  now: number;
  respawnCount: number;
  finished: boolean;
}

export interface PaceNoteCue {
  /** À appeler après les pas de simulation : renvoie l'annonce à dire maintenant, ou null. */
  update: (input: CueInput) => PaceCue | null;
  /** À la reprise après une pause : renvoie la phrase interrompue à redire, ou null si elle était finie ou si son virage est passé. */
  replay: (now: number) => PaceCue | null;
  /** Redémarrage de la course : coupe la phrase en cours et repart de la première annonce. */
  reset: () => void;
  /** Annonces dont le virage n'est pas encore dépassé et déjà commencées, pour les icônes */
  activeCalls: () => readonly PaceCue[];
  /** Notes de ces annonces pas encore dépassées, dans l'ordre de la route : une icône par virage */
  activeNotes: () => readonly PaceNote[];
}

export const createPaceNoteCue = (
  track: Track,
  calls: readonly PaceCall[],
  timing: CueTiming,
): PaceNoteCue => {
  const { closed, length } = track;
  const count = calls.length;

  // Les annonces et l'abscisse sont comptées en continu d'un tour à l'autre : `k` vaut tour × annonces + indice.
  const exists = (k: number): boolean => k < count || (closed && count > 0);
  const callOf = (k: number): PaceCall => calls[k % count];
  const lapBase = (k: number): number =>
    closed ? Math.floor(k / count) * length : 0;
  const startAt = (k: number): number => lapBase(k) + callOf(k).startS;
  const endAt = (k: number): number => lapBase(k) + callOf(k).endS;
  /** De `from` à `to` par le plus court, y compris à travers la ligne d'un circuit */
  const along = (from: number, to: number): number => {
    const gap = to - from;
    return closed ? gap - Math.round(gap / length) * length : gap;
  };

  let tracked: number | null = null;
  let furthest = 0;
  let branch: { from: number; last: number } | null = null;
  let respawns = 0;
  let next = 0;
  let speakingUntil = -Infinity;
  let spoken: SpokenCue | null = null;
  let active: SpokenCue[] = [];

  /** Première annonce du tour en cours qui n'est pas passée */
  const seek = (s: number, passed: (k: number) => boolean): number => {
    let k = closed ? Math.max(0, Math.floor(s / length)) * count : 0;
    while (exists(k) && passed(k)) k++;
    return k;
  };

  /** Distance parcourue pendant `seconds`, accélération probable comprise */
  const travel = (speed: number, seconds: number): number =>
    speed * seconds + (PLAN_ACCEL * seconds * seconds) / 2;

  /** Abscisse où partir pour que chaque phrase à venir finisse à l'heure, sans empiéter sur la suivante */
  const plannedStart = (speed: number, floor: number): number => {
    let latest = Infinity;
    for (let k = next + PLAN_CALLS - 1; k >= next; k--) {
      if (!exists(k)) continue;
      const duration = timing.durationOf(callOf(k), false);
      latest = Math.min(
        startAt(k) - Math.max(travel(speed, duration + ANTICIPATION), floor),
        latest - travel(speed, duration),
      );
    }
    return latest;
  };

  /** Suit la route en ignorant les sauts de branche de `nearest()` */
  const follow = (s: number, raw: number): number => {
    const gap = along(s, raw);
    if (Math.abs(gap) <= MAX_JUMP) {
      branch = null;
      return s + gap;
    }
    if (branch === null || Math.abs(along(branch.last, raw)) > MAX_JUMP)
      branch = { from: raw, last: raw };
    else branch.last = raw;
    if (along(branch.from, raw) < JUMP_CONFIRM) return s;
    // Vraie coupe : la voiture roule bien sur cette portion.
    branch = null;
    furthest = s + gap;
    return furthest;
  };

  return {
    update: ({ x, z, speed, now, respawnCount, finished }) => {
      if (finished) {
        if (active.length > 0) active = [];
        return null;
      }
      const raw = track.nearest(x, z).s;
      let s: number;
      if (tracked === null) {
        s = raw;
        furthest = raw;
        respawns = respawnCount;
        // Au départ, un virage déjà entamé reste à annoncer.
        next = seek(s, (k) => endAt(k) < s);
      } else if (respawnCount !== respawns) {
        s = tracked + along(tracked, raw);
        furthest = s;
        respawns = respawnCount;
        branch = null;
        next = seek(s, (k) => startAt(k) <= s);
        spoken = null;
        active = [];
      } else {
        s = follow(tracked, raw);
        furthest = Math.max(furthest, s);
      }
      tracked = s;

      // Un virage entièrement dépassé sans annonce ne se dit plus : la voiture a coupé la route.
      while (exists(next) && endAt(next) < s) next++;
      if (active.some((cue) => cue.endAt < s))
        active = active.filter((cue) => cue.endAt >= s);

      if (now < speakingUntil || s < furthest - REVERSE_MARGIN) return null;
      if (!exists(next) || s < plannedStart(speed, MIN_CUE_DISTANCE))
        return null;

      const call = callOf(next);
      const short =
        s - plannedStart(speed, 0) > speed * MAX_LATE &&
        timing.durationOf(call, true) < timing.durationOf(call, false);
      const cue: SpokenCue = {
        call,
        short,
        index: next % count,
        startAt: startAt(next),
        endAt: endAt(next),
      };
      speakingUntil = now + timing.durationOf(call, short);
      spoken = cue;
      active = [...active, cue];
      next++;
      return cue;
    },
    replay: (now) => {
      if (
        spoken === null ||
        tracked === null ||
        now >= speakingUntil ||
        tracked >= spoken.startAt
      )
        return null;
      speakingUntil = now + timing.durationOf(spoken.call, spoken.short);
      return spoken;
    },
    reset: () => {
      tracked = null;
      branch = null;
      next = 0;
      speakingUntil = -Infinity;
      spoken = null;
      active = [];
    },
    activeCalls: () => active,
    activeNotes: () =>
      active
        .flatMap(({ call, startAt: callAt }) => {
          // Abscisses comptées en continu : une annonce du tour suivant se range après celles du tour en cours.
          const lap = callAt - call.startS;
          return call.notes
            .filter((note) => tracked === null || note.endS + lap >= tracked)
            .map((note) => ({ note, at: note.startS + lap }));
        })
        .sort((a, b) => a.at - b.at)
        .map(({ note }) => note),
  };
};
