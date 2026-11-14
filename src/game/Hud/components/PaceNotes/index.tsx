"use client";

import { useHudStore } from "@/game/hudStore";
import type { PaceNote } from "@/sim/track/paceNotes";
import { ChainFrame } from "./components/ChainFrame";
import { FinishIcon } from "./components/FinishIcon";
import { ChicaneIcon, ObstacleIcon } from "./components/ObstacleIcon";
import { TurnIcon } from "./components/TurnIcon";

const sideLabel = (direction: "left" | "right"): string =>
  direction === "left" ? "Gauche" : "Droite";

const noteLabel = (note: PaceNote): string => {
  if (note.kind === "chicane") return `Chicane ${sideLabel(note.direction)}`;
  if (note.kind === "finish") return "Arrivée";
  if (note.kind !== "turn") return note.kind === "crest" ? "Crête" : "Bosse";
  return [
    `${sideLabel(note.direction)} ${note.entryGrade}`,
    ...(note.long ? ["long"] : []),
    ...(note.tightens ? [`se resserre en ${note.grade}`] : []),
  ].join(", ");
};

const NoteIcon = ({ note }: { note: PaceNote }) => (
  <svg
    viewBox="-1 -1 112 66"
    role="img"
    aria-label={noteLabel(note)}
    className="h-16"
  >
    {note.kind === "turn" ? (
      <TurnIcon note={note} />
    ) : note.kind === "chicane" ? (
      <ChicaneIcon direction={note.direction} />
    ) : note.kind === "finish" ? (
      <FinishIcon />
    ) : (
      <ObstacleIcon kind={note.kind} />
    )}
  </svg>
);

/** Bande en haut au centre, sur le ciel : sous le message de diagnostic, au-dessus du décompte de remise en piste. */
export const PaceNotes = () => {
  const notes = useHudStore((s) => s.paceNotes);
  const chain = useHudStore((s) => s.paceChain);
  const call = useHudStore((s) => s.paceCall);
  const enabled = useHudStore((s) => s.copilotOptions.paceIconsEnabled);
  // Même taille pour toutes : la note en cours ressort, les suivantes sont atténuées.
  const item = (note: PaceNote, i: number) => (
    <li
      key={`${note.kind}-${note.startS}`}
      className={i === 0 ? undefined : "opacity-60"}
    >
      <NoteIcon note={note} />
    </li>
  );
  const items = notes.map(item);
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {call && <span key={call.id}>{call.text}</span>}
      </p>
      {enabled && notes.length > 0 && (
        <ol
          aria-label="Prochains virages"
          className="absolute top-14 left-1/2 flex -translate-x-1/2 gap-2"
        >
          {chain ? (
            <>
              {items.slice(0, chain.start)}
              <ChainFrame key="chain" open={chain.open}>
                {items.slice(chain.start, chain.end + 1)}
              </ChainFrame>
              {items.slice(chain.end + 1)}
            </>
          ) : (
            items
          )}
        </ol>
      )}
    </>
  );
};
