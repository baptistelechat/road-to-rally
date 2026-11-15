"use client";

import { hudLeft } from "../../hudStyles";
import { Chrono, RestartButton } from "../Chrono";
import { ControlsHelp } from "../ControlsHelp";
import { DriverBadge } from "../DriverBadge";
import { Speedometer } from "../Speedometer";
import { StageNotices } from "../StageNotices";

interface BroadcastHudProps {
  closed: boolean;
  notices: readonly string[];
}

/** Habillage télé : voiture et chrono en bandeau en haut à gauche, commandes en bas à gauche, compteur en bas à droite. */
export const BroadcastHud = ({ closed, notices }: BroadcastHudProps) => (
  <>
    <div
      className={`absolute top-7 ${hudLeft.broadcast} flex flex-col items-start gap-2`}
    >
      <Chrono closed={closed} hudStyle="broadcast" lead={<DriverBadge />} />
      <RestartButton closed={closed} />
      <StageNotices notices={notices} />
    </div>
    {/* Dans l'angle, comme le compteur en face : la frise verticale s'arrête bien au-dessus. */}
    <div className={`absolute bottom-7 ${hudLeft.broadcast}`}>
      <ControlsHelp closed={closed} />
    </div>
    <div className="absolute right-7 bottom-7">
      <Speedometer />
    </div>
  </>
);
