"use client";

import { useMemo } from "react";
import { Crowd } from "./Crowd";
import { APP_HEX } from "./dressing";
import { Arch, BUILD, Sail, Sign } from "./Fixtures";
import { HOST_FLAG, otherFlagOf } from "./flagAtlas";
import { Label } from "./Label";
import { Lettering } from "./Lettering";
import { type Mast, MastFlags } from "./MastFlags";
import { Piece } from "./Piece";
import { CONTROL, controlCrowd, controlMarshals } from "./placement";
import type { StyleId } from "./people";

interface ControlZoneProps {
  /** Position de l'arche le long de X */
  x: number;
  /** Enseigne de l'arche */
  sign: string;
  /** Texte de la banderole */
  banner: string;
  /** Graine des tirages de cet endroit */
  seed: number;
  style: StyleId;
  /** Arrivée : enseigne et 4e mât à damier */
  checker?: boolean;
  /** Départ : panneau lumineux sous l'enseigne */
  lights?: boolean;
  /** Étiquettes de chaque élément (au départ seulement, pour ne pas surcharger) */
  details?: boolean;
  title: string;
  detail: string;
}

/** Départ ou arrivée : le même dispositif, seuls l'enseigne, le damier et le panneau lumineux changent. */
export const ControlZone = ({
  x,
  sign,
  banner,
  seed,
  style,
  checker = false,
  lights = false,
  details = false,
  title,
  detail,
}: ControlZoneProps) => {
  const crowd = useMemo(() => controlCrowd(x, seed * 100), [x, seed]);
  const marshals = useMemo(
    () => controlMarshals(x, seed * 100 + 90),
    [x, seed],
  );
  // Pays hôte sur le premier mât, deux pays étrangers tirés de la graine sur les suivants.
  const masts = useMemo<Mast[]>(
    () =>
      CONTROL.masts.map((dx, i): Mast => ({
        position: [x + dx, 0, -6.4],
        flag: i === 0 ? HOST_FLAG : otherFlagOf(seed * 31 + i),
      })),
    [x, seed],
  );

  return (
    <group>
      {[-4.6, 4.6].map((z) => (
        <Piece
          key={z}
          build={BUILD.tapeLong}
          position={[x + CONTROL.tapeFrom, 0, z]}
        />
      ))}
      <Arch x={x} text={sign} checker={checker} lights={lights} />
      {CONTROL.sails.flatMap((dx, i) =>
        [-6.2, 6.2].map((z, side) => (
          <Sail
            key={`${dx}:${z}`}
            position={[x + dx, 0, z]}
            seed={seed + i * 2 + side}
          />
        )),
      )}
      {CONTROL.signs.map((dx, i) => (
        <Sign
          key={dx}
          position={[x + dx, 0, 6.0 + i * 0.3]}
          seed={seed * 3 + i}
        />
      ))}
      <Piece
        build={BUILD.bannerPosts}
        position={[x + CONTROL.banner, 0, -5.6]}
      />
      <Lettering
        text={banner}
        width={6}
        height={1}
        position={[x + CONTROL.banner, 1.85, -5.6]}
        background={APP_HEX.brand}
        color={APP_HEX.ink}
      />
      <MastFlags masts={masts} />
      {checker && (
        <Piece
          build={BUILD.poleFinish}
          position={[x + CONTROL.checkerMast, 0, -6.4]}
        />
      )}
      <Piece build={BUILD.tent} position={[x + CONTROL.tent, 0, -9]} />
      <Lettering
        text="BUVETTE"
        width={2.9}
        height={0.21}
        position={[x + CONTROL.tent, 2.1, -7.48]}
        background={APP_HEX.night}
        color={APP_HEX.brand}
      />
      <Crowd style={style} members={crowd} />
      <Crowd style={style} members={marshals} />

      <Label position={[x, 7.4, 0]} title={title} detail={detail} />
      {details && (
        <>
          <Label
            position={[x + CONTROL.banner, 3.4, -5.6]}
            title="Banderole tendue"
            detail="deux piquets haubanés"
          />
          <Label
            position={[x + CONTROL.masts[1], 6, -6.4]}
            title="Drapeaux sur mâts"
            detail="France, puis deux pays tirés par hachage"
          />
          <Label
            position={[x + CONTROL.tent, 4.2, -9]}
            title="Tente (buvette, assistance)"
          />
          <Label
            position={[x + 14, 3.4, 7.4]}
            title="Public des deux côtés"
            detail="derrière la rubalise, 16 au sud, 8 au nord"
          />
          <Label
            position={[x, 2.9, 5.3]}
            title="4 commissaires"
            detail="derrière la rubalise, avant et après la ligne"
          />
        </>
      )}
    </group>
  );
};
