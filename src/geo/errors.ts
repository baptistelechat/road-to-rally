export type StageErrorCode =
  | "empty"
  | "tooShort"
  | "tooLong"
  | "selfCrossing"
  | "roadContact"
  | "outOfFrance"
  | "network"
  | "service"
  | "aborted";

/** Toute erreur montrée au joueur : le message est en français et peut s'afficher tel quel. */
export class StageError extends Error {
  readonly code: StageErrorCode;

  constructor(code: StageErrorCode, message: string) {
    super(message);
    this.name = "StageError";
    this.code = code;
  }
}

/** Abscisse lisible, depuis le premier point du tracé. */
export const formatKm = (meters: number): string =>
  `km ${(Math.max(0, meters) / 1000).toFixed(2).replace(".", ",")}`;
