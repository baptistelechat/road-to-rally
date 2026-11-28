import { Vector2 } from "three";

/**
 * Accentuation de la netteté après le FXAA (28/11, Intel UHD 630 : image douce, rubalises des chicanes mal lisibles).
 * Masque flou à 5 points : le pixel moins la moyenne de ses voisins, renforcé de `amount`, borné par le voisinage pour
 * ne pas créer de halo.
 */
export const SharpenShader = {
  name: "SharpenShader",
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new Vector2(1 / 1024, 1 / 512) },
    amount: { value: 0.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec4 center = texture2D(tDiffuse, vUv);
      vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, resolution.y)).rgb;
      vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, resolution.y)).rgb;
      vec3 e = texture2D(tDiffuse, vUv + vec2(resolution.x, 0.0)).rgb;
      vec3 w = texture2D(tDiffuse, vUv - vec2(resolution.x, 0.0)).rgb;
      vec3 sharp = center.rgb + amount * (4.0 * center.rgb - n - s - e - w);
      vec3 low = min(center.rgb, min(min(n, s), min(e, w)));
      vec3 high = max(center.rgb, max(max(n, s), max(e, w)));
      gl_FragColor = vec4(clamp(sharp, low, high), center.a);
    }`,
};
