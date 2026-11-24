"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  HemisphereLight,
  Vector3,
} from "three";
import { tunnelAt } from "@/render/tunnelAt";
import {
  TUNNEL_COVER,
  TUNNEL_VAULT_RISE,
  TUNNEL_WALL_HEIGHT,
  tunnelProfile,
} from "@/sim/track/tunnelShape";
import type { MeshData, StageTunnel, Track, Vec3 } from "@/sim/types";

const fromMesh = (mesh: MeshData): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  if (mesh.colors)
    geometry.setAttribute("color", new BufferAttribute(mesh.colors, 3));
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * Tube gris le long de l'axe (PR-21, paquet 1) : intrados, extrados à `TUNNEL_COVER` plus loin, et un anneau qui les
 * relie à chaque portail. Sans épaisseur, l'entrée se lisait comme une feuille de papier.
 */
const tubeGeometry = (
  points: Vec3[],
  edge: (i: number) => number,
  tunnel: StageTunnel,
): BufferGeometry => {
  const count = tunnelProfile(1).length;
  const rings = tunnel.to - tunnel.from + 1;
  const last = points.length - 1;
  const positions: number[] = [];
  // Intrados puis extrados : `rings × count` sommets chacun.
  for (const grow of [0, TUNNEL_COVER])
    for (let i = tunnel.from; i <= tunnel.to; i++) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(last, i + 1)];
      const len = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
      // À droite de la route : (-dz, dx), comme les parois en collision.
      const rx = -(next.z - prev.z) / len;
      const rz = (next.x - prev.x) / len;
      // Au bord réel du bas-côté : là où le terrain s'ouvre, sinon le relief entre dans le tube.
      for (const [lateral, height] of tunnelProfile(edge(i), grow))
        positions.push(
          points[i].x + rx * lateral,
          points[i].y + height,
          points[i].z + rz * lateral,
        );
    }
  const outer = rings * count;
  const indices: number[] = [];
  for (const base of [0, outer])
    for (let k = 0; k + 1 < rings; k++)
      for (let j = 0; j + 1 < count; j++) {
        const a = base + k * count + j;
        const b = a + 1;
        const c = a + count;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
  // Anneaux des portails : chaque sommet de l'intrados relié au même sommet de l'extrados.
  for (const k of [0, rings - 1])
    for (let j = 0; j + 1 < count; j++) {
      const a = k * count + j;
      const b = a + 1;
      indices.push(a, b, b + outer, a, b + outer, a + outer);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(Float32Array.from(positions), 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

/** Brouillard au cœur d'un tunnel : couleur du fond du tube, au lieu du ciel qui imitait une sortie au bout d'une courbe */
const TUNNEL_FOG = new Color("#0d0c0b");
/**
 * Le brouillard ne s'assombrit que si le portail regardé est à plus de ça, en mètres, et tout à fait 100 m plus loin.
 * Plus près, la sortie est en vue : le paysage au-delà doit garder son brouillard de ciel, sinon il paraît noir.
 */
const FOG_DEPTH = 150;
/** Lumière du ciel gardée sous la voûte : le soleil est déjà arrêté par le tube, le ciel éclairait encore tout */
const TUNNEL_AMBIENT = 0.15;
/** Fondu au passage d'un portail, par seconde */
const FADE = 3;

/** Tubes et montagne au-dessus, un maillage chacun : peu de tunnels par spéciale. */
export const TunnelsView = ({ track }: { track: Track }) => {
  const geometries = useMemo(() => {
    const { points, widths, shoulders } = track.unique;
    const edge = (i: number): number => widths[i] / 2 + shoulders[i];
    return (track.tunnels ?? []).map((tunnel) => ({
      tube: tubeGeometry(points, edge, tunnel),
      roof: tunnel.roof ? fromMesh(tunnel.roof) : null,
    }));
  }, [track]);

  // Brouillard et lumière du ciel hors tunnel, relevés à la première image : ceux de l'ambiance choisie.
  const base = useRef<{
    fog: Color;
    sky: HemisphereLight | null;
    intensity: number;
    sun: DirectionalLight | null;
    sunIntensity: number;
  } | null>(null);
  const fade = useRef({ fog: 0, ambient: 0 });
  const [look] = useState(() => new Vector3());
  useFrame(({ scene, camera }, delta) => {
    if (!track.tunnels || !(scene.fog instanceof Fog)) return;
    if (!base.current) {
      let sky: HemisphereLight | null = null;
      let sun: DirectionalLight | null = null;
      scene.traverse((object) => {
        if (object instanceof HemisphereLight) sky = object;
        if (object instanceof DirectionalLight) sun = object;
      });
      base.current = {
        fog: scene.fog.color.clone(),
        sky,
        intensity: (sky as HemisphereLight | null)?.intensity ?? 0,
        sun,
        sunIntensity: (sun as DirectionalLight | null)?.intensity ?? 0,
      };
    }
    const tunnel = tunnelAt(track, camera.position.x, camera.position.z);
    const under =
      tunnel !== null &&
      tunnel.distance <= tunnel.edge &&
      camera.position.y <
        tunnel.point.y + TUNNEL_WALL_HEIGHT + TUNNEL_VAULT_RISE;
    const step = Math.min(1, delta * FADE);
    // Seul compte le portail vers lequel regarde la caméra : celui de derrière n'est pas en vue.
    camera.getWorldDirection(look);
    const facing =
      tunnel && look.x * tunnel.tangent.x + look.z * tunnel.tangent.z >= 0
        ? tunnel.ahead
        : (tunnel?.behind ?? 0);
    const deep =
      under && tunnel
        ? Math.min(1, Math.max(0, (facing - FOG_DEPTH) / 100))
        : 0;
    fade.current.fog += (deep - fade.current.fog) * step;
    fade.current.ambient += ((under ? 1 : 0) - fade.current.ambient) * step;
    scene.fog.color.copy(base.current.fog).lerp(TUNNEL_FOG, fade.current.fog);
    // Au cœur du tunnel seulement, comme le brouillard : l'ombre de la voûte laissait filer le soleil sur les arêtes
    // de la voiture, en néon. Près d'un portail en vue, le soleil revient et la sortie reste claire.
    if (base.current.sun)
      base.current.sun.intensity =
        base.current.sunIntensity * (1 - fade.current.fog);
    if (base.current.sky)
      base.current.sky.intensity =
        base.current.intensity *
        (1 - (1 - TUNNEL_AMBIENT) * fade.current.ambient);
  });

  // En quittant la course dans un tunnel, le ciel retrouve sa lumière.
  useEffect(
    () => () => {
      const saved = base.current;
      if (saved?.sky) saved.sky.intensity = saved.intensity;
      if (saved?.sun) saved.sun.intensity = saved.sunIntensity;
    },
    [],
  );

  useEffect(
    () => () => {
      for (const { tube, roof } of geometries) {
        tube.dispose();
        roof?.dispose();
      }
    },
    [geometries],
  );

  // ponytail: béton gris uni, les portails (étape 26) et les lampes (étape 27) l'habillent ensuite.
  return (
    <group>
      {geometries.map(({ tube, roof }) => (
        <group key={tube.uuid}>
          <mesh
            geometry={tube}
            castShadow
            receiveShadow
            userData={{ shadow: true }}
          >
            <meshStandardMaterial
              color="#8b8a85"
              roughness={0.95}
              flatShading
              side={DoubleSide}
            />
          </mesh>
          {roof && (
            <mesh
              geometry={roof}
              castShadow
              receiveShadow
              userData={{ shadow: true }}
            >
              <meshStandardMaterial
                vertexColors
                flatShading
                side={DoubleSide}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
};
