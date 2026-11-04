// Annonce du copilote → morceaux enregistrés, un par note entière. Pur : tourne aussi dans les vérifications Node.
import type {
  PaceCall,
  PaceGrade,
  PaceNote,
  PaceTurn,
} from "@/sim/track/paceNotes";

export interface CallWordsOptions {
  /** Retire « long », « se resserre » et « enfilade » : la phrase tient dans moins de temps */
  short?: boolean;
}

const GRADE_TEXT: Record<PaceGrade, string> = {
  1: "un",
  2: "deux",
  3: "trois",
  4: "quatre",
  5: "cinq",
  6: "six",
};

const sideText = (direction: PaceTurn["direction"]): string =>
  direction === "left" ? "gauche" : "droite";

const turnText = (
  direction: PaceTurn["direction"],
  grade: PaceGrade,
  long: boolean,
  tightens: boolean,
): string =>
  [
    sideText(direction),
    GRADE_TEXT[grade],
    ...(long ? ["long"] : []),
    ...(tightens ? ["se resserre"] : []),
  ].join(" ");

const noteText = (note: PaceNote, short: boolean): string => {
  switch (note.kind) {
    case "crest":
      return "attention crête";
    case "bump":
      return "attention bosse";
    case "chicane":
      return `chicane ${sideText(note.direction)}`;
    case "finish":
      return "arrivée";
    case "turn":
      // « Quatre se resserre » : la note annoncée est celle de l'entrée.
      return turnText(
        note.direction,
        note.entryGrade,
        !short && note.long,
        !short && note.tightens,
      );
  }
};

/**
 * Morceaux d'une annonce, dans l'ordre. Le seul raccord tombe avant « puis », où un copilote marque déjà une pause.
 * Enfilade : chaque virage, sans précisions. En retard, le mot « enfilade » saute : le cadre des icônes le montre.
 */
export const callToClips = (
  { type, notes }: PaceCall,
  { short = false }: CallWordsOptions = {},
): string[] => {
  if (type === "chain")
    return [
      ...(short ? [] : ["enfilade"]),
      ...notes.flatMap((note) =>
        note.kind === "turn" ? [noteText(note, true)] : [],
      ),
    ];
  return notes.map((note, i) =>
    i === 0 ? noteText(note, short) : `puis ${noteText(note, short)}`,
  );
};

/** « puis chicane droite » → `puis-chicane-droite` : nom du fichier, sans accent. */
export const clipFile = (clip: string): string =>
  clip.normalize("NFD").replace(/[̀-ͯ]/g, "").replaceAll(" ", "-");

const NOTE_CLIPS: string[] = [
  ...(["left", "right"] as const).flatMap((direction) =>
    ([1, 2, 3, 4, 5, 6] as const).flatMap((grade) =>
      [false, true].flatMap((long) =>
        [false, true].map((tightens) =>
          turnText(direction, grade, long, tightens),
        ),
      ),
    ),
  ),
  "attention crête",
  "attention bosse",
  "chicane gauche",
  "chicane droite",
  "arrivée",
];

/** Tout ce que la voix sait dire. `scripts/generate-copilot-words.py` génère la même liste. */
export const PACE_CLIPS: readonly string[] = [
  ...NOTE_CLIPS,
  ...NOTE_CLIPS.map((clip) => `puis ${clip}`),
  "enfilade",
];
