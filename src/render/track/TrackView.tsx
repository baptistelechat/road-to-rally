"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import {
  embankment,
  GROUND_Y,
  lateralStrip,
  SHOULDER_WIDTH,
} from "@/sim/track/ribbon";
import type { MeshData, Track } from "@/sim/types";
import { groundMesh } from "./groundMesh";
import { StartArch } from "./TrackFurniture";

const LINE_INSET = 0.2;
const LINE_WIDTH = 0.18;
const LINE_LIFT = 0.012;
const CENTER_LINE_WIDTH = 0.16;
/** En segments de l'axe, d'environ 2 m chacun : 4 m de trait pour 6 m de vide. */
const DASH_ON = 2;
const DASH_PERIOD = 5;

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

/** Sol, talus, bas-côté, route, marquage, repères et arche d'un tracé quelconque. */
export const TrackView = ({ track }: { track: Track }) => {
  const geometries = useMemo(() => {
    const half = track.width / 2;
    const { points, closed } = track;
    const bank = embankment(points, track.width, closed);
    const strip = (left: number, right: number, lift: number): BufferGeometry =>
      toGeometry(lateralStrip(points, closed, left, right, lift));
    return {
      ground: toGeometry(groundMesh(track)),
      bank: bank ? toGeometry(bank) : null,
      road: toGeometry(track.ribbon),
      shoulderLeft: strip(-half - SHOULDER_WIDTH, -half, GROUND_Y),
      shoulderRight: strip(half, half + SHOULDER_WIDTH, GROUND_Y),
      lineLeft: strip(
        -half + LINE_INSET,
        -half + LINE_INSET + LINE_WIDTH,
        LINE_LIFT,
      ),
      lineCenter: toGeometry(
        dashed(
          lateralStrip(
            points,
            closed,
            -CENTER_LINE_WIDTH / 2,
            CENTER_LINE_WIDTH / 2,
            LINE_LIFT,
          ),
        ),
      ),
      lineRight: strip(
        half - LINE_INSET - LINE_WIDTH,
        half - LINE_INSET,
        LINE_LIFT,
      ),
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
      ].map((geometry) => (
        <mesh key={geometry.uuid} geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color="#e8e4d8"
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ))}
      <StartArch track={track} />
    </group>
  );
};
