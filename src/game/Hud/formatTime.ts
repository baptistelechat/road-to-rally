// Temps du HUD au format du chrono : « 01:10.633 », écarts signés et leur couleur.

export const formatLap = (ms: number | null): string => {
  if (ms === null) return "--:--.---";
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor(total / 1000) % 60;
  const millis = total % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
};

/** Écart ou pénalité au format du chrono : « +01:10.633 », « −00:02.150 ». */
export const formatSignedLap = (ms: number): string =>
  `${ms < 0 ? "−" : "+"}${formatLap(Math.abs(ms))}`;

/** Vert devant, rouge derrière */
export const deltaColor = (ms: number): string =>
  ms < 0 ? "text-emerald-400" : ms > 0 ? "text-red-500" : "";
