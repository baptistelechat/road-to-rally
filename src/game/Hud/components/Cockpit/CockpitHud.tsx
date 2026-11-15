"use client";

import { useHudStore } from "@/game/hudStore";
import { hudBlock, hudLeft } from "../../hudStyles";
import { Chrono, RestartButton } from "../Chrono";
import { ControlsHelp } from "../ControlsHelp";
import { DriverBadge } from "../DriverBadge";
import { Speedometer } from "../Speedometer";
import { isRoundGauge } from "../Speedometer/gauge";
import { StageNotices } from "../StageNotices";

interface CockpitHudProps {
  closed: boolean;
  notices: readonly string[];
}

/** Trapèze plus large en bas : le tableau de bord pose sur le bord de l'écran */
const DASH_FACET = "[clip-path:polygon(5%_0,95%_0,100%_100%,0_100%)]";

/** Numéro et drapeau de la voiture, l'un sous l'autre devant le chrono */
const DashChrono = ({ closed }: { closed: boolean }) => (
  <div className="flex items-center gap-5">
    <DriverBadge stacked />
    <Chrono closed={closed} hudStyle="cockpit" />
  </div>
);

/**
 * Tableau de bord bas d'un seul tenant, sous la voiture : chrono à gauche, compteur au centre, relance à droite.
 * Cadran et Arc sortent du tableau de bord, posés à son bout droit.
 */
export const CockpitHud = ({ closed, notices }: CockpitHudProps) => {
  const style = useHudStore((s) => s.copilotOptions.speedometerStyle);
  const round = isRoundGauge(style);
  return (
    <>
      {/* Aligné sur la frise verticale, qui reste plus bas, centrée */}
      <div className={`absolute top-6 ${hudLeft.cockpit} flex flex-col items-start`}>
        <StageNotices notices={notices} />
        <ControlsHelp closed={closed} />
      </div>
      <div className="absolute bottom-0 left-1/2 w-[min(73.75rem,100%)] -translate-x-1/2">
        {round ? (
          <div
            className={`${hudBlock} ${DASH_FACET} flex h-27.5 items-center justify-between gap-8 pt-4 pr-75 pb-3 pl-16`}
          >
            <DashChrono closed={closed} />
            <RestartButton closed={closed} />
          </div>
        ) : (
          <div
            className={`${hudBlock} ${DASH_FACET} grid h-31 grid-cols-[1fr_auto_1fr] items-center gap-10 px-16 pt-4.5 pb-3.5`}
          >
            <div className="justify-self-start">
              <DashChrono closed={closed} />
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
