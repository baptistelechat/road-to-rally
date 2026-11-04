"use client";

import { useEffect, useMemo } from "react";
import {
  type BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SPLIT_ARCH_TUBE, splitArches } from "@/sim/track/scenery";
import type { Track } from "@/sim/types";

/** Couleurs de l'arche gonflable : à brancher plus tard sur les couleurs du jeu ou de la livrée. */
export interface SplitArchColors {
  tube: string;
  /** Pieds lestés, un ton plus sombre */
  foot: string;
  band: string;
  banner: string;
  text: string;
  rope: string;
}

export const SPLIT_ARCH_COLORS: SplitArchColors = {
  tube: "#2563eb",
  foot: "#1e40af",
  band: "#f8fafc",
  banner: "#f8fafc",
  text: "#0b2a6b",
  rope: "#9ca3af",
};

/** Rayon des boudins : le même que leur collider */
const TUBE = SPLIT_ARCH_TUBE;
/** Haut de la traverse au-dessus de la route */
const TOP = 6.2;
/** Pieds enfoncés sous la route : le bas-côté descend parfois */
const SINK = 1;
const FOOT_HEIGHT = 0.55;
/** Bandes blanches sur les montants, hauteur de leur centre au-dessus de la route */
const BANDS = [1.7, 3.2];
const BAND_HEIGHT = 0.35;
const BANNER_HEIGHT = 0.95;
const BANNER_MAX_WIDTH = 5;
/** Pixels de texture par mètre de bannière : le texte garde ses proportions quelle que soit la largeur */
const BANNER_PIXELS = 112;
/** Haubans : du coin haut jusqu'au sol, à tant de mètres au-delà du pied */
const ROPE_REACH = 3.5;
const ROPE_RADIUS = 0.025;

/** Bannière « SECTEUR n », dessinée une fois : aucune police chargée, rien sur le réseau. */
const bannerTexture = (
  sector: number,
  width: number,
  colors: SplitArchColors,
): CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * BANNER_PIXELS);
  canvas.height = Math.round(BANNER_HEIGHT * BANNER_PIXELS);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = colors.banner;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = colors.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(canvas.height * 0.55)}px system-ui, sans-serif`;
    ctx.fillText(`SECTEUR ${sector}`, canvas.width / 2, canvas.height / 2 + 3);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

/** Morceaux sans index : `mergeGeometries` exige les mêmes attributs partout. */
const merge = (parts: BufferGeometry[]): BufferGeometry => {
  const geometry = mergeGeometries(parts.map((part) => part.toNonIndexed()));
  for (const part of parts) part.dispose();
  return geometry;
};

/** Gros boudins : deux montants, la traverse et des coins arrondis. */
const tubeGeometry = (halfSpan: number): BufferGeometry => {
  const legHeight = TOP - TUBE + SINK;
  return merge([
    ...[-1, 1].map((side) =>
      new CylinderGeometry(TUBE, TUBE, legHeight, 10).translate(
        side * halfSpan,
        legHeight / 2 - SINK,
        0,
      ),
    ),
    new CylinderGeometry(TUBE, TUBE, 2 * halfSpan, 10)
      .rotateZ(Math.PI / 2)
      .translate(0, TOP - TUBE, 0),
    ...[-1, 1].map((side) =>
      new SphereGeometry(TUBE, 10, 8).translate(side * halfSpan, TOP - TUBE, 0),
    ),
  ]);
};

/** Pieds lestés : un boudin écrasé, plus large que le montant. */
const footGeometry = (halfSpan: number): BufferGeometry =>
  merge(
    [-1, 1].map((side) =>
      new SphereGeometry(TUBE * 1.6, 10, 6)
        .scale(1, FOOT_HEIGHT / (TUBE * 1.6), 1)
        .translate(side * halfSpan, FOOT_HEIGHT * 0.4, 0),
    ),
  );

/** Bandes blanches, à peine plus larges que le montant pour ne pas scintiller avec lui. */
const bandGeometry = (halfSpan: number): BufferGeometry =>
  merge(
    [-1, 1].flatMap((side) =>
      BANDS.map((y) =>
        new CylinderGeometry(TUBE * 1.02, TUBE * 1.02, BAND_HEIGHT, 10).translate(
          side * halfSpan,
          y,
          0,
        ),
      ),
    ),
  );

const UP = new Vector3(0, 1, 0);

/** Haubans tendus du coin haut vers un piquet au sol, de chaque côté, vers l'extérieur de la route. */
const ropeGeometry = (halfSpan: number): BufferGeometry =>
  merge(
    [-1, 1].map((side) => {
      const from = new Vector3(side * halfSpan, TOP - TUBE, 0);
      const to = new Vector3(side * (halfSpan + ROPE_REACH), -0.1, 0);
      const along = to.clone().sub(from);
      const length = along.length();
      return new CylinderGeometry(ROPE_RADIUS, ROPE_RADIUS, length, 4)
        .applyQuaternion(
          new Quaternion().setFromUnitVectors(UP, along.normalize()),
        )
        .translate(
          (from.x + to.x) / 2,
          (from.y + to.y) / 2,
          (from.z + to.z) / 2,
        );
    }),
  );

/**
 * Arche gonflable à chaque intermédiaire, qui annonce l'entrée dans le secteur suivant, lisible des deux côtés.
 * `src/render/` ne fait que lire la piste : la position et l'épaisseur des pieds viennent de `splitArches`, comme
 * leur collider.
 */
export const SplitArches = ({
  track,
  colors = SPLIT_ARCH_COLORS,
}: {
  track: Track;
  colors?: SplitArchColors;
}) => {
  const arches = useMemo(
    () =>
      splitArches(track).map(({ position, rotation, halfSpan }, i) => {
        const width = Math.min(2 * halfSpan - 2 * TUBE - 0.4, BANNER_MAX_WIDTH);
        return {
        key: `${position.x},${position.z}`,
        position,
        quaternion: new Quaternion(
          rotation.x,
          rotation.y,
          rotation.z,
          rotation.w,
        ),
        tubes: tubeGeometry(halfSpan),
        feet: footGeometry(halfSpan),
        bands: bandGeometry(halfSpan),
        ropes: ropeGeometry(halfSpan),
        banner: new PlaneGeometry(width, BANNER_HEIGHT),
        // L'arche ouvre un secteur : le premier commence au départ, la première arche ouvre le deuxième.
        texture: bannerTexture(i + 2, width, colors),
        };
      }),
    [track, colors],
  );

  useEffect(
    () => () => {
      for (const arch of arches) {
        arch.tubes.dispose();
        arch.feet.dispose();
        arch.bands.dispose();
        arch.ropes.dispose();
        arch.banner.dispose();
        arch.texture.dispose();
      }
    },
    [arches],
  );

  // Collée sous la traverse
  const bannerY = TOP - 2 * TUBE - BANNER_HEIGHT / 2 + 0.1;
  return arches.map((arch) => (
    <group
      key={arch.key}
      position={[arch.position.x, arch.position.y, arch.position.z]}
      quaternion={arch.quaternion}
    >
      <mesh geometry={arch.tubes} castShadow>
        <meshStandardMaterial color={colors.tube} roughness={0.45} flatShading />
      </mesh>
      <mesh geometry={arch.feet} castShadow>
        <meshStandardMaterial color={colors.foot} roughness={0.5} flatShading />
      </mesh>
      <mesh geometry={arch.bands}>
        <meshStandardMaterial color={colors.band} roughness={0.5} flatShading />
      </mesh>
      <mesh geometry={arch.ropes}>
        <meshStandardMaterial color={colors.rope} roughness={0.8} />
      </mesh>
      {/* Deux faces : le texte reste à l'endroit, que l'on arrive d'un côté ou de l'autre. */}
      {[1, -1].map((face) => (
        <mesh
          key={face}
          geometry={arch.banner}
          position={[0, bannerY, face * 0.03]}
          rotation={[0, face > 0 ? 0 : Math.PI, 0]}
        >
          <meshStandardMaterial map={arch.texture} roughness={0.6} />
        </mesh>
      ))}
    </group>
  ));
};
