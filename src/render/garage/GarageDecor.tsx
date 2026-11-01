"use client";

import { useEffect, useMemo } from "react";
import type { BufferGeometry, CanvasTexture } from "three";
import { createDecalTexture } from "@/render/car/decals";
import { drawFlagWhenSettled, NO_FLAG } from "@/render/car/flags";
import type { Livery } from "@/render/car/livery";
import { decalQuads } from "@/render/car/meshBuilder";
import {
  buildClothGeometry,
  buildGarageGeometry,
  GARAGE_BANNER,
  GARAGE_FLAG_Z,
  GARAGE_LOGO,
  GARAGE_NUMBER_Z,
  GARAGE_PLAQUES,
  GARAGE_SCREEN,
} from "./buildGarageGeometry";
import {
  BANNER_SIZE,
  CLOTH_SIZE,
  createPlaquesTexture,
  drawBanner,
  drawLogoSlot,
  drawNumberCloth,
  drawWeave,
  LOGO_SIZE_PX,
  runServiceScreen,
  SCREEN_SIZE,
} from "./garageDecals";

const useDisposed = (resource: BufferGeometry | CanvasTexture): void => {
  useEffect(() => () => resource.dispose(), [resource]);
};

/** Le drapeau arrive de façon asynchrone : la trame du tissu se pose une fois qu'il est dessiné. */
const runFlagCloth = (texture: CanvasTexture, flag: string): (() => void) => {
  const canvas = texture.image as HTMLCanvasElement;
  return drawFlagWhenSettled(
    flag,
    () => canvas,
    () => {
      const ctx = canvas.getContext("2d");
      if (ctx) drawWeave(ctx);
      texture.needsUpdate = true;
    },
  );
};

interface FlatDecalProps {
  geometry: BufferGeometry;
  texture: CanvasTexture;
  vertexColors?: boolean;
  transparent?: boolean;
}

// Hors éclairage et hors tone mapping : un écran ou une bannière garde ses couleurs exactes.
const FlatDecal = ({
  geometry,
  texture,
  vertexColors,
  transparent,
}: FlatDecalProps) => (
  <mesh geometry={geometry}>
    <meshBasicMaterial
      map={texture}
      toneMapped={false}
      vertexColors={vertexColors}
      transparent={transparent}
      premultipliedAlpha={transparent}
    />
  </mesh>
);

interface GarageDecorProps {
  livery: Livery;
}

export const GarageDecor = ({ livery }: GarageDecorProps) => {
  const { primary, secondary, accent, rim, flag } = livery;
  const { numberText, numberStyle, plateText } = livery;
  const decor = useMemo(
    () => buildGarageGeometry({ accent, rim }),
    [accent, rim],
  );
  const bannerQuad = useMemo(() => decalQuads([GARAGE_BANNER]), []);
  const boardQuad = useMemo(() => decalQuads([GARAGE_PLAQUES]), []);
  const screenQuad = useMemo(() => decalQuads([GARAGE_SCREEN]), []);
  const logoQuad = useMemo(() => decalQuads([GARAGE_LOGO]), []);
  const flagCloth = useMemo(() => buildClothGeometry(GARAGE_FLAG_Z), []);
  const numberCloth = useMemo(() => buildClothGeometry(GARAGE_NUMBER_Z), []);
  const banner = useMemo(
    () =>
      createDecalTexture(BANNER_SIZE, (ctx) =>
        drawBanner(ctx, { primary, secondary, accent }),
      ),
    [primary, secondary, accent],
  );
  const board = useMemo(() => createPlaquesTexture(), []);
  const screen = useMemo(() => createDecalTexture(SCREEN_SIZE, () => {}), []);
  const logo = useMemo(
    () => createDecalTexture(LOGO_SIZE_PX, drawLogoSlot),
    [],
  );
  const flagTexture = useMemo(
    () => createDecalTexture(CLOTH_SIZE, () => {}),
    [],
  );
  const numberTexture = useMemo(
    () =>
      createDecalTexture(CLOTH_SIZE, (ctx) =>
        drawNumberCloth(ctx, numberText, numberStyle, { secondary, accent }),
      ),
    [numberText, numberStyle, secondary, accent],
  );

  useDisposed(decor.shell);
  useDisposed(decor.props);
  useDisposed(decor.glow);
  useDisposed(bannerQuad);
  useDisposed(boardQuad);
  useDisposed(screenQuad);
  useDisposed(logoQuad);
  useDisposed(logo);
  useDisposed(flagCloth);
  useDisposed(numberCloth);
  useDisposed(banner);
  useDisposed(board);
  useDisposed(screen);
  useDisposed(flagTexture);
  useDisposed(numberTexture);

  useEffect(
    () =>
      runServiceScreen(
        screen,
        `VOITURE ${numberText.trim()}  ·  ${plateText.trim()}`,
      ),
    [screen, numberText, plateText],
  );
  useEffect(() => runFlagCloth(flagTexture, flag), [flagTexture, flag]);

  return (
    <group>
      <mesh geometry={decor.shell} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      <mesh geometry={decor.props} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.75} />
      </mesh>
      <mesh geometry={decor.glow}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <FlatDecal geometry={bannerQuad} texture={banner} />
      <FlatDecal geometry={boardQuad} texture={board} transparent />
      <FlatDecal geometry={screenQuad} texture={screen} />
      <FlatDecal geometry={logoQuad} texture={logo} />
      {flag !== NO_FLAG && (
        <FlatDecal geometry={flagCloth} texture={flagTexture} vertexColors />
      )}
      <FlatDecal geometry={numberCloth} texture={numberTexture} vertexColors />
    </group>
  );
};
