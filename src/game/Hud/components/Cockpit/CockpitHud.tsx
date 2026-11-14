"use client";

import { useHudStore } from "@/game/hudStore";
import { hudBlock } from "../../hudStyles";
import { Chrono, RestartButton } from "../Chrono";
import { ControlsHelp } from "../ControlsHelp";
import { Speedometer } from "../Speedometer";
import { isRoundGauge } from "../Speedometer/gauge";
import { StageNotices } from "../StageNotices";

interface CockpitHudProps {
  closed: boolean;
  notices: readonly string[];
}

/** Trapèze plus large en bas : le tableau de bord pose sur le bord de l'écran */
const DASH_FACET = "[clip-path:polygon(5%_0,95%_0,100%_100%,0_100%)]";

/**
 * Tableau de bord bas d'un seul tenant, sous la voiture : chrono à gauche, compteur au centre, relance à droite.
 * Cadran et Arc sortent du tableau de bord, posés à son bout droit.
 */
export const CockpitHud = ({ closed, notices }: CockpitHudProps) => {
  const style = useHudStore((s) => s.copilotOptions.speedometerStyle);
  const round = isRoundGauge(style);
  return (
    <>
      {/* Décalé de la frise verticale (left-4, 22 px de large) pour ne jamais la chevaucher */}
      <div className="absolute top-6 left-12 flex flex-col items-start gap-2">
        <StageNotices notices={notices} />
        <ControlsHelp closed={closed} />
      </div>
      <div className="absolute bottom-0 left-1/2 w-[min(73.75rem,100%)] -translate-x-1/2">
        {round ? (
          <div
            className={`${hudBlock} ${DASH_FACET} flex h-27.5 items-center justify-between gap-8 pt-4 pr-75 pb-3 pl-16`}
          >
            <Chrono closed={closed} hudStyle="cockpit" />
            <RestartButton closed={closed} />
          </div>
        ) : (
          <div
            className={`${hudBlock} ${DASH_FACET} grid h-31 grid-cols-[1fr_auto_1fr] items-center gap-10 px-16 pt-4.5 pb-3.5`}
          >
            <div className="justify-self-start">
              <Chrono closed={closed} hudStyle="cockpit" />
            </div>
            <Speedometer />
            <div className="justify-self-end">
              <RestartButton closed={closed} />
            </div>
          </div>
        )}
        {round && (
          <div className="absolute right-2.5 bottom-3.5">
            <Speedometer />
          </div>
        )}
      </div>
    </>
  );
};
