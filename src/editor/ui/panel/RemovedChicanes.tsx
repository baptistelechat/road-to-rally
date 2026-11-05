"use client";

import type { ChicaneRemoval } from "@/geo/chicanes";
import { chicaneKm } from "../../chicanes";
import { editorStore, useEditor } from "../../store";
import { useChicanes } from "../useChicanes";

/** Les chicanes retirées à la génération : un clic montre l'endroit, pour les déplacer une par une. */
export const RemovedChicanes = ({
  removals,
}: {
  removals: ChicaneRemoval[];
}) => {
  const chicanes = useChicanes();
  const runoffPoints = useEditor(
    (state) => state.analysis?.axis?.runoffPoints ?? 0,
  );
  return removals.map(({ message, reason, position }) => {
    const listed = chicanes.find(
      (chicane) =>
        chicane.position.lat === position.lat &&
        chicane.position.lon === position.lon,
    );
    return (
      <button
        key={message}
        type="button"
        title="Voir sur la carte"
        className="block rounded text-left text-brand hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => editorStore.setState({ focus: { position } })}
      >
        {listed
          ? `La chicane du ${chicaneKm(listed.index, runoffPoints)} a été retirée : ${reason}.`
          : message}
      </button>
    );
  });
};
