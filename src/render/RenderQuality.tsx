"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { DirectionalLight, type Object3D } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { SharpenShader } from "./sharpenShader";

interface Level {
  /** Ratio de pixels du canvas */
  dpr: number;
  /** Le décor projette ses ombres */
  decorShadows: boolean;
  /** MSAA, net, au lieu du FXAA, qui adoucit toute l'image (rubalises des chicanes moins lisibles, 28/11) */
  msaa: boolean;
  /** Côté de la carte d'ombre, en texels */
  shadowMap: number;
}

/** Échantillons du MSAA, comme celui du canvas avant le 28/11 */
const MSAA_SAMPLES = 4;

/**
 * Paliers du mode automatique, du plus léger au plus beau. Mesuré le 28/11 sur Intel UHD 630 (Edge, `road`, ratio 1) :
 * 23,7 ms par image, 20,3 ms sans l'ombre du décor, 17,7 ms sans aucune ombre ; le MSAA coûtait ~7 ms. Le visuel passe
 * d'abord (Baptiste, 28/11 : sans ombre des arbres « pas naturel ») : la résolution descend jusqu'à 1, puis l'ombre du
 * décor se coupe, puis seulement la résolution passe sous 1. En haut, une carte d'ombre fine et le MSAA, que seul un
 * GPU dédié tient (GTX 1050 : 60 FPS à 1,25).
 */
const ladder = (maxDpr: number): Level[] => {
  const low = { msaa: false, shadowMap: 2048 };
  const levels: Level[] = [
    { dpr: 0.75, decorShadows: false, ...low },
    { dpr: 0.85, decorShadows: false, ...low },
    { dpr: 1, decorShadows: false, ...low },
    { dpr: 1, decorShadows: true, ...low },
  ];
  for (let dpr = 1.1; dpr < maxDpr; dpr += 0.1)
    levels.push({
      dpr: Math.round(dpr * 100) / 100,
      decorShadows: true,
      ...low,
    });
  if (maxDpr > 1) levels.push({ dpr: maxDpr, decorShadows: true, ...low });
  levels.push({
    dpr: maxDpr,
    decorShadows: true,
    msaa: false,
    shadowMap: 4096,
  });
  levels.push({ dpr: maxDpr, decorShadows: true, msaa: true, shadowMap: 4096 });
  return levels;
};
/** MSAA sur les cibles du composeur, ou FXAA puis accentuation en sortie. */
const setAntialias = (
  {
    composer,
    fxaa,
    sharpen,
  }: { composer: EffectComposer; fxaa: ShaderPass; sharpen: ShaderPass },
  msaa: boolean,
): void => {
  const samples = msaa ? MSAA_SAMPLES : 0;
  for (const target of [composer.renderTarget1, composer.renderTarget2])
    if (target.samples !== samples) {
      target.samples = samples;
      // Réalloué au prochain rendu, avec le bon nombre d'échantillons.
      target.dispose();
    }
  fxaa.enabled = !msaa;
  sharpen.enabled = !msaa;
};

/**
 * Plancher de FPS du mode automatique. 40 et pas 50 (Baptiste, 28/11) : le jeu doit rester beau, autant que bien se
 * conduire. Intel UHD 630 tient alors ratio 1 avec toutes les ombres (~42 FPS), au lieu de 0,75.
 */
const MIN_FPS = 40;

/** Palier de départ : ratio 1 avec toutes les ombres, d'où l'ajustement monte ou descend */
const START_LEVEL = 3;

/**
 * Rendu du jeu (28/11, 30 FPS sur un GPU intégré) : paliers de qualité qui suivent les FPS (résolution, ombre du décor,
 * finesse des ombres, MSAA ou FXAA). Le canvas doit avoir `antialias: false` : l'antialiasing se fait ici.
 */
export const RenderQuality = () => {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  // La caméra du jeu remplace celle par défaut après le montage : le composeur est alors refait.
  const camera = useThree((state) => state.camera);
  const get = useThree((state) => state.get);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const setDpr = useThree((state) => state.setDpr);
  const levels = useMemo(
    () =>
      ladder(
        Math.min(
          1.5,
          typeof window === "undefined" ? 1 : window.devicePixelRatio,
        ),
      ),
    [],
  );
  const [index, setIndex] = useState(START_LEVEL);
  const level = levels[index];
  // Décor qui projette une ombre (`userData.shadow`) et soleil, relevés une fois par seconde : le décor arrive par morceaux.
  const lastScan = useRef(-Infinity);
  const decor = useRef<Object3D[]>([]);
  const sun = useRef<DirectionalLight | null>(null);
  const decorWasOff = useRef(false);

  const passes = useMemo(() => {
    const composer = new EffectComposer(gl);
    const fxaa = new ShaderPass(FXAAShader);
    composer.addPass(new RenderPass(scene, camera));
    // Tone mapping et sRGB avant le FXAA, qui lisse des couleurs d'écran : OutputPass n'est volontairement pas la
    // dernière passe, comme dans l'exemple `webgl_postprocessing_fxaa` de three.js (react-doctor le signale à tort).
    composer.addPass(new OutputPass());
    composer.addPass(fxaa);
    // Le FXAA adoucit toute l'image, et l'Intel tourne sous sa pleine résolution : on rend du mordant aux bords.
    const sharpen = new ShaderPass(SharpenShader);
    composer.addPass(sharpen);
    return { composer, fxaa, sharpen };
  }, [gl, scene, camera]);

  useEffect(() => {
    const { composer, fxaa, sharpen } = passes;
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
    for (const pass of [fxaa, sharpen])
      pass.material.uniforms.resolution.value.set(
        1 / (size.width * dpr),
        1 / (size.height * dpr),
      );
  }, [passes, size, dpr]);

  // Changement de palier : résolution et antialiasing. La carte d'ombre suit dans la boucle, une fois le soleil trouvé.
  useEffect(() => {
    setDpr(level.dpr);
    setAntialias(passes, level.msaa);
  }, [level, passes, setDpr]);

  useEffect(() => () => passes.composer.dispose(), [passes]);

  useEffect(
    () => () => {
      get().gl.info.autoReset = true;
    },
    [get],
  );

  // Priorité positive : R3F ne rend plus la scène lui-même, le composeur s'en charge.
  useFrame((state) => {
    // Le composeur rend plusieurs fois par image : compteurs remis à zéro une fois, pour le diagnostic F9.
    state.gl.info.autoReset = false;
    state.gl.info.reset();
    if (state.clock.elapsedTime - lastScan.current >= 1) {
      lastScan.current = state.clock.elapsedTime;
      const found: Object3D[] = [];
      state.scene.traverse((object) => {
        if (object.userData.shadow === true) found.push(object);
        if (object instanceof DirectionalLight && object.castShadow)
          sun.current = object;
      });
      decor.current = found;
    }
    const shadow = sun.current?.shadow;
    if (shadow && shadow.mapSize.x !== level.shadowMap) {
      shadow.mapSize.set(level.shadowMap, level.shadowMap);
      // Recréée à la bonne taille au prochain rendu des ombres.
      shadow.map?.dispose();
      shadow.map = null;
    }
    // Après les tranches de décor (priorité 0), qui rallument leurs ombres à chaque image en approchant.
    if (!level.decorShadows)
      for (const object of decor.current) object.castShadow = false;
    // Au retour, l'ombre est rendue à tout le décor : bâtiments, ponts et tunnels ne la reprennent pas d'eux-mêmes,
    // les tranches lointaines se recoupent à l'image suivante.
    else if (decorWasOff.current)
      for (const object of decor.current) object.castShadow = true;
    decorWasOff.current = !level.decorShadows;
    passes.composer.render();
  }, 1);

  const last = levels.length - 1;
  return (
    <PerformanceMonitor
      factor={START_LEVEL / last}
      step={1 / last}
      // Monte quand l'écran est tenu presque à sa fréquence, ne descend que sous `MIN_FPS`.
      bounds={(refresh) => [Math.min(MIN_FPS, refresh * 0.8), refresh * 0.95]}
      flipflops={8}
      onChange={({ factor }) => setIndex(Math.round(factor * last))}
    />
  );
};
