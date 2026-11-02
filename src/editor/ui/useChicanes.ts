"use client";

import { useMemo } from "react";
import { listChicanes, type ListedChicane } from "../chicanes";
import { useEditor } from "../store";

const NONE: [] = [];

/** Les chicanes telles que la spéciale les recevra : celles du joueur, plus les automatiques restantes. */
export const useChicanes = (): ListedChicane[] => {
  const trace = useEditor((state) => state.history.present);
  const auto = useEditor((state) => state.autoChicanes?.chicanes ?? NONE);
  const axis = useEditor((state) => state.analysis?.axis ?? null);
  return useMemo(
    () => listChicanes({ trace, auto, axis }),
    [trace, auto, axis],
  );
};
