"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { embankment, lateralStrip, shoulderStrips } from "@/sim/track/ribbon";
import { FORK_MARGIN, roadForkReach } from "@/sim/track/roadContact";
import { finishArch, startArch } from "@/sim/track/scenery";
import type { MeshData, Track, Vec3 } from "@/sim/types";
import {
  approachSigns,
  ChicaneView,
  IslandBarriers,
  MedianBarriers,
} from "../scenery/ChicaneView";
import { groundMesh, withSkirt } from "./groundMesh";
import { Arch } from "./TrackFurniture";

const LINE_INSET = 0.2;
const LINE_WIDTH = 0.18;
const LINE_LIFT = 0.012;
const CENTER_LINE_WIDTH = 0.16;
/** En segments de l'axe, d'environ 2 m chacun : 4 m de trait pour 6 m de vide. */
const DASH_ON = 2;
const DASH_PERIOD = 5;
/** Nombre de pavés blancs de la ligne d'arrivée */
const FINISH_COLUMNS = 8;

/**
 * Hauteur du marquage en chaque point. En virage et en pente, chaque quad de route est gauche :
 * sa diagonale passe au-dessus d'une bande à 1 cm, qui disparaît par endroits le long de l'intérieur du virage.
 */
const lineLifts = ({ unique: { points, widths }, closed }: Track): number[] => {
  const n = points.length;
  const at = (i: number): Vec3 =>
    closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  const skew = points.map((p, i) => {
    const a = at(i - 1);
    const b = at(i + 1);
    const ux = p.x - a.x;
    const uz = p.z - a.z;
    const vx = b.x - p.x;
    const vz = b.z - p.z;
    const arc = (Math.hypot(ux, uz) + Math.hypot(vx, vz)) / 2 || 1;
    const curvature = Math.abs(
      Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz) / arc,
    );
    return (Math.abs(b.y - a.y) * widths[i] * curvature) / 4;
  });
  return skew.map(
    (value, i) =>
      LINE_LIFT + Math.max(value, skew[(i + 1) % n], skew[(i - 1 + n) % n]),
  );
};

/** Ne garde que les segments (un quad par segment de l'axe) que `keep` accepte. */
const keepSegments = (
  mesh: MeshData,
  keep: (segment: number) => boolean,
): MeshData => {
  const kept: number[] = [];
  for (let t = 0; t < mesh.indices.length; t += 6)
    if (keep(mesh.indices[t] >> 1))
      kept.push(...mesh.indices.subarray(t, t + 6));
  return { positions: mesh.positions, indices: Uint32Array.from(kept) };
};

/** Garde un segment sur quelques-uns d'une bande continue. */
const dashed = (mesh: MeshData): MeshData => {
  const kept: number[] = [];
  for (let segment = 0; segment < mesh.indices.length / 6; segment++)
    if (segment % DASH_PERIOD < DASH_ON)
      kept.push(...mesh.indices.subarray(segment * 6, segment * 6 + 6));
  return { positions: mesh.positions, indices: Uint32Array.from(kept) };
};

const toGeometry = (mesh: MeshData): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  if (mesh.colors)
    geometry.setAttribute("color", new BufferAttribute(mesh.colors, 3));
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * Retire le marquage de la fourche d'un aller-retour : aller et retour s'y recouvrent, leurs lignes s'y couperaient au hasard
 * et, à quelques millimètres près, disparaîtraient l'une sous l'autre.
 */
const outsideFork = (mesh: MeshData, track: Track): MeshData => {
  if (!track.shared) return mesh;
  const { armEnd, returnStart } = track.shared;
  const { points, widths } = track.unique;
  const reach =
    roadForkReach(points, widths, armEnd, returnStart) + FORK_MARGIN;
  const kept: number[] = [];
  for (let t = 0; t < mesh.indices.length; t += 6) {
    // Deux sommets par point de l'axe : le premier du quad donne son segment.
    const segment = mesh.indices[t] >> 1;
    if (Math.abs(segment - armEnd) > reach && segment < returnStart - reach)
      kept.push(...mesh.indices.subarray(t, t + 6));
  }
  return { positions: mesh.positions, indices: Uint32Array.from(kept) };
};

/** Pavés en travers de la route à l'abscisse `s`, sur un segment de l'axe pour épouser la pente. */
const crossLine = (
  track: Track,
  s: number,
  columns: number,
): BufferGeometry => {
  const { points, widths } = track;
  const i = Math.min(points.length - 2, track.indexAt(s));
  const half = widths[i] / 2;
  const column = (2 * half) / (2 * columns - 1);
  const parts: BufferGeometry[] = [];
  for (let c = 0; c < columns; c++) {
    const left = -half + 2 * c * column;
    parts.push(
      toGeometry(
        lateralStrip(
          points.slice(i, i + 2),
          false,
          left,
          left + column,
          LINE_LIFT,
        ),
      ),
    );
  }
  return mergeGeometries(parts);
};

/** Sol ou terrain, talus, bas-côté, route, marquage, repères et arches d'un tracé quelconque. */
export const TrackView = ({ track }: { track: Track }) => {
  const hasTerrain = track.terrain !== null;
  const signs = useMemo(
    () => approachSigns(track.obstacles, track, track.shared !== null),
    [track],
  );

  const geometries = useMemo(() => {
    const { closed, terrain } = track;
    const { points, widths, shoulders } = track.unique;
    // Le talus descend vers le sol plat : avec un terrain, il n'a plus lieu d'être.
    const bank = terrain ? null : embankment(points, widths, closed);
    const lifts = lineLifts(track);
    const strip = (
      left: (width: number, i: number) => number,
      right: (width: number, i: number) => number,
      lift: number[],
    ): BufferGeometry =>
      toGeometry(
        outsideFork(
          lateralStrip(
            points,
            closed,
            widths.map(left),
            widths.map(right),
            lift,
          ),
          track,
        ),
      );
    // Une ligne pointillée entre deux voies voisines : aucune sur une voie unique, une sur deux voies, deux sur trois.
    // Pas là où le nombre de voies change : la ligne y sauterait de travers.
    const lanes = track.laneCounts ?? widths.map(() => 2);
    const n = points.length;
    const laneLines = (): BufferGeometry | null => {
      const lines: BufferGeometry[] = [];
      for (let k = 1; k < Math.max(...lanes); k++) {
        const at = (w: number, i: number): number =>
          -w / 2 + (k * w) / lanes[i];
        const mesh = keepSegments(
          dashed(
            lateralStrip(
              points,
              closed,
              widths.map((w, i) => at(w, i) - CENTER_LINE_WIDTH / 2),
              widths.map((w, i) => at(w, i) + CENTER_LINE_WIDTH / 2),
              lifts,
            ),
          ),
          (segment) =>
            lanes[segment] > k && lanes[segment] === lanes[(segment + 1) % n],
        );
        lines.push(toGeometry(outsideFork(mesh, track)));
      }
      if (lines.length === 0) return null;
      const merged = mergeGeometries(lines);
      for (const line of lines) line.dispose();
      return merged;
    };
    const [shoulderLeft, shoulderRight] = shoulderStrips(
      points,
      widths,
      shoulders,
      closed,
    );
    return {
      ground: toGeometry(
        terrain ? withSkirt(terrain, track) : groundMesh(track),
      ),
      bank: bank ? toGeometry(bank) : null,
      road: toGeometry(track.ribbon),
      shoulderLeft: toGeometry(shoulderLeft),
      shoulderRight: toGeometry(shoulderRight),
      lineLeft: strip(
        (w) => -w / 2 + LINE_INSET,
        (w) => -w / 2 + LINE_INSET + LINE_WIDTH,
        lifts,
      ),
      lineCenter: laneLines(),
      lineRight: strip(
        (w) => w / 2 - LINE_INSET - LINE_WIDTH,
        (w) => w / 2 - LINE_INSET,
        lifts,
      ),
      // Le circuit garde son allure : ni ligne au sol, ni seconde arche.
      // Aller-retour : les deux lignes tombent au même endroit, le damier sert aux deux.
      startLine:
        closed || track.shared ? null : crossLine(track, track.startS, 1),
      finishLine: closed
        ? null
        : crossLine(track, track.finishS, FINISH_COLUMNS),
    };
  }, [track]);

  useEffect(
    () => () => {
      for (const geometry of Object.values(geometries)) geometry?.dispose();
    },
    [geometries],
  );

  // Décalage de polygones plutôt que des écarts d'altitude : pas de scintillement au loin, même à quelques centimètres.
  return (
    <group>
      <mesh geometry={geometries.ground} receiveShadow>
        <meshStandardMaterial
          vertexColors
          flatShading={hasTerrain}
          polygonOffset
          polygonOffsetFactor={4}
          polygonOffsetUnits={4}
        />
      </mesh>
      {geometries.bank && (
        <mesh geometry={geometries.bank} receiveShadow>
          <meshStandardMaterial
            color="#54701f"
            flatShading
            polygonOffset
            polygonOffsetFactor={3}
            polygonOffsetUnits={3}
          />
        </mesh>
      )}
      {[geometries.shoulderLeft, geometries.shoulderRight].map((geometry) => (
        <mesh key={geometry.uuid} geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color="#a9a074"
            polygonOffset
            polygonOffsetFactor={2}
            polygonOffsetUnits={2}
          />
        </mesh>
      ))}
      <mesh geometry={geometries.road} receiveShadow>
        <meshStandardMaterial color="#55565b" roughness={0.95} />
      </mesh>
      {[
        geometries.lineLeft,
        geometries.lineCenter,
        geometries.lineRight,
        geometries.startLine,
        geometries.finishLine,
      ].map(
        (geometry) =>
          geometry && (
            <mesh key={geometry.uuid} geometry={geometry} receiveShadow>
              <meshStandardMaterial
                color="#e8e4d8"
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          ),
      )}
      <Arch track={track} place={startArch} />
      {!track.closed && <Arch track={track} place={finishArch} />}
      <ChicaneView blocks={track.obstacles} signs={signs} />
      <IslandBarriers islands={track.islands} groundAt={track.groundAt} />
      <MedianBarriers medians={track.medians} groundAt={track.groundAt} />
    </group>
  );
};
