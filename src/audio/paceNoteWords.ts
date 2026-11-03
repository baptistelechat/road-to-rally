// Annonce du copilote → liste de mots enregistrés. Pur : tourne aussi dans les vérifications Node.
import type {
  PaceCall,
  PaceGrade,
  PaceNote,
  PaceTurn,
} from "@/sim/track/paceNotes";

/** Un fichier `public/audio/copilot/<mot>.wav` par entrée */
export const PACE_WORDS = [
  "gauche",
  "droite",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "longue",
  "se-resserre",
  "crete",
  "bosse",
  "attention",
  "puis",
  "enfilade",
] as const;

export type PaceWord = (typeof PACE_WORDS)[number];

export interface CallWordsOptions {
  /** Retire « longue », « se resserre » et « enfilade » : la phrase tient dans moins de temps */
  short?: boolean;
}

const GRADE_WORDS: Record<PaceGrade, PaceWord> = {
  1: "un",
  2: "deux",
  3: "trois",
  4: "quatre",
  5: "cinq",
  6: "six",
};

const turnStart = ({ direction, grade }: PaceTurn): PaceWord[] => [
  direction === "left" ? "gauche" : "droite",
  GRADE_WORDS[grade],
];

const noteWords = (note: PaceNote, short: boolean): PaceWord[] => {
  if (note.kind !== "turn")
    return ["attention", note.kind === "crest" ? "crete" : "bosse"];
  const precisions: PaceWord[] = [];
  if (!short && note.long) precisions.push("longue");
  if (!short && note.tightens) precisions.push("se-resserre");
  // « Quatre se resserre » : la note annoncée est celle de l'entrée.
  return [...turnStart({ ...note, grade: note.entryGrade }), ...precisions];
};

export const callToWords = (
  { type, notes }: PaceCall,
  { short = false }: CallWordsOptions = {},
): PaceWord[] => {
  // Chaque virage est annoncé, sans précisions. En retard, le mot « enfilade » saute : le cadre des icônes le montre.
  if (type === "chain")
    return [
      ...(short ? [] : (["enfilade"] as const)),
      ...notes.flatMap((note) =>
        note.kind === "turn"
          ? turnStart({ ...note, grade: note.entryGrade })
          : [],
      ),
    ];
  return notes.flatMap((note, i): PaceWord[] =>
    i === 0 ? noteWords(note, short) : ["puis", ...noteWords(note, short)],
  );
};
