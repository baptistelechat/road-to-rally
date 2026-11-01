/** Moyenne glissante, les bords répètent la dernière valeur. */
export const boxSmooth = (values: number[], radius: number): number[] =>
  values.map((_, i) => {
    let sum = 0;
    for (let j = i - radius; j <= i + radius; j++)
      sum += values[Math.max(0, Math.min(values.length - 1, j))];
    return sum / (2 * radius + 1);
  });

/** Médiane glissante, la fenêtre se réduit aux bords. */
export const medianFilter = (values: number[], radius: number): number[] =>
  values.map((_, i) => {
    const sorted = values
      .slice(Math.max(0, i - radius), i + radius + 1)
      .sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  });
