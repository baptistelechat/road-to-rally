"use client";

import {
  APP_HEX,
  bannerPosts,
  beachFlag,
  DA,
  flagPole,
  foldingChair,
  inflatableArch,
  parasol,
  placardStake,
  PLACARD_FACE,
  tapeLine,
  tent,
} from "./dressing";
import type { Vec3 } from "./geometry";
import { Lettering } from "./Lettering";
import { Piece } from "./Piece";
import { jitter, placardOf } from "./placement";
import { StartPanel } from "./StartPanel";

// Éléments d'habillage partagés par la scène : fabriques stables, voile, pancarte et arche.

/** Fabriques stables : `Piece` ne reconstruit une géométrie que si sa fabrique change. */
export const BUILD = {
  tapeShort: () => tapeLine(12.5),
  tapeLong: () => tapeLine(27.5),
  bannerPosts: () => bannerPosts(6, 2.4),
  arch: () => inflatableArch(11),
  flagBrand: () => beachFlag(DA.brand, DA.night),
  flagNight: () => beachFlag(DA.night, DA.brand),
  flagSnow: () => beachFlag(DA.brand, DA.snow),
  // Touche secondaire : une voile sur quatre reprend un bleu des graphiques.
  flagSky: () => beachFlag(DA.sky, DA.night),
  poleFinish: () => flagPole([DA.ink, DA.snow, DA.ink]),
  tent: () => tent([DA.brand, DA.night], DA.night),
  parasol: () => parasol([DA.sky, DA.snow, DA.ember, DA.snow]),
  chairSky: () => foldingChair(DA.sky),
  chairEmber: () => foldingChair(DA.ember),
  placard: () => placardStake(),
} as const;

const SAILS = [BUILD.flagBrand, BUILD.flagNight, BUILD.flagSnow, BUILD.flagSky];

/** Voile « beach flag » : couleur tirée de la graine, voile tournée vers la route. */
export const Sail = ({ position, seed }: { position: Vec3; seed: number }) => (
  <Piece
    build={SAILS[seed % SAILS.length]}
    position={position}
    rotation={[0, Math.PI / 2 + jitter(seed, 0.6), 0]}
  />
);

/** Pancarte plantée, message et couleurs tirés de la graine. */
export const Sign = ({ position, seed }: { position: Vec3; seed: number }) => {
  const placard = placardOf(seed);
  // Côté nord, la pancarte se retourne vers la route.
  const yaw = (position[2] > 0 ? Math.PI : 0) + jitter(20 + seed, 0.5);
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <Piece build={BUILD.placard} />
      <Lettering
        text={placard.text}
        width={PLACARD_FACE.width}
        height={PLACARD_FACE.height}
        position={PLACARD_FACE.at}
        background={placard.background}
        color={placard.color}
      />
    </group>
  );
};

interface ArchProps {
  x: number;
  text: string;
  checker?: boolean;
  /** Panneau lumineux sous l'enseigne (départ seulement) */
  lights?: boolean;
}

/** L'arche gonflable unique : départ, intermédiaires et arrivée ne changent que l'enseigne. */
export const Arch = ({
  x,
  text,
  checker = false,
  lights = false,
}: ArchProps) => (
  <group position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
    <Piece build={BUILD.arch} />
    <Lettering
      text={text}
      width={4}
      height={1}
      position={[0, 4.1, 0]}
      background={APP_HEX.night}
      color={APP_HEX.brand}
      checker={checker}
    />
    {lights && <StartPanel position={[0, 3.3, 0]} />}
  </group>
);
