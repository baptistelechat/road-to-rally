"use client";

import { TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import {
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerTooltip,
} from "@/components/ui/map";
import { useEditor, type EditorIssue } from "../../store";
import { missingRunoff } from "../../trace";

const IssueLink = ({ id, issue }: { id: string; issue: EditorIssue }) => {
  const coordinates = useMemo((): [number, number][] => {
    const { position, otherPosition } = issue;
    return position && otherPosition
      ? [
          [position.lon, position.lat],
          [otherPosition.lon, otherPosition.lat],
        ]
      : [];
  }, [issue]);
  return (
    <MapRoute
      id={id}
      coordinates={coordinates}
      color={issue.blocking ? "#f87171" : "#fbbf24"}
      width={3}
      opacity={1}
      dashArray={[1, 1]}
      interactive={false}
    />
  );
};

/** À l'endroit fautif, avec un trait vers la portion rejointe ou la route réelle. Le texte complet est dans le panneau. */
export const IssueMarkers = () => {
  const issues = useEditor((state) => state.issues);
  const trace = useEditor((state) => state.history.present);
  const missing = useMemo((): EditorIssue | null => {
    const found = missingRunoff(trace);
    // Décalée : elle se pose sur le point à déplacer, qu'elle ne doit pas cacher.
    return found && { ...found, code: "deadEnd", s: 0, blocking: true };
  }, [trace]);
  return (missing ? [missing, ...issues] : issues).map((issue, i) => {
    const { position } = issue;
    if (!position) return null;
    const id = `issue-${i}-${issue.code}`;
    return (
      // Une alerte tombe souvent sur un point : décalée, elle ne le cache pas et il reste à glisser.
      <MapMarker
        key={id}
        longitude={position.lon}
        latitude={position.lat}
        offset={[22, -22]}
      >
        <MarkerContent className="cursor-help">
          <span
            className={`grid size-6 place-items-center rounded-full border border-white shadow-md ${issue.blocking ? "bg-red-600 text-white" : "bg-amber-400 text-neutral-900"}`}
          >
            <TriangleAlert aria-hidden="true" className="size-3.5" />
          </span>
        </MarkerContent>
        <MarkerTooltip className="max-w-64">{issue.message}</MarkerTooltip>
        <IssueLink id={id} issue={issue} />
      </MapMarker>
    );
  });
};
