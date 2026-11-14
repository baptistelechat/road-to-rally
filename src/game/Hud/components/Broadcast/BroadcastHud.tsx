"use client";

import { Chrono, RestartButton } from "../Chrono";
import { ControlsHelp } from "../ControlsHelp";
import { Speedometer } from "../Speedometer";
import { StageNotices } from "../StageNotices";

interface BroadcastHudProps {
  closed: boolean;
  notices: readonly string[];
}

/** Habillage télé : chrono en bandeau en haut à gauche, compteur en bas à droite. */
export const BroadcastHud = ({ closed, notices }: BroadcastHudProps) => (
  <>
    <div className="absolute top-7 left-7 flex flex-col items-start gap-2">
      <Chrono closed={closed} hudStyle="broadcast" />
      <RestartButton closed={closed} />
      <StageNotices notices={notices} />
      {/* Décalé de la frise verticale (left-4, 22 px de large), qui monte jusqu'à mi-hauteur moins 160 px */}
      <div className="pl-5">
        <ControlsHelp closed={closed} />
      </div>
    </div>
    <div className="absolute right-7 bottom-7">
      <Speedometer />
    </div>
  </>
);
