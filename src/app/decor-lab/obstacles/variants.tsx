"use client";

import { CHICANE_STACK_DEPTH, CHICANE_STACK_HEIGHT } from "@/geo/config";

// Propositions du labo « Obstacles » : des volumes simples, assez pour juger silhouette, couleur et lecture.
// Rien ici n'est importé par le jeu.

const CONCRETE = "#a9a59c";
const RED = "#b8251a";
const WHITE = "#ece9e2";
const STEEL = "#9aa0a6";
const RUBBER = "#1d1f23";
const STONE = "#8c8478";
const GRASS = "#55702f";
const HAY = "#d2b05a";

const Box = ({
  size,
  at,
  color,
  rotY = 0,
}: {
  size: [number, number, number];
  at: [number, number, number];
  color: string;
  rotY?: number;
}) => (
  <mesh position={at} rotation={[0, rotY, 0]} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} flatShading roughness={0.9} />
  </mesh>
);

const Cylinder = ({
  radius,
  top = radius,
  height,
  at,
  color,
  segments = 12,
}: {
  radius: number;
  top?: number;
  height: number;
  at: [number, number, number];
  color: string;
  segments?: number;
}) => (
  <mesh position={at} castShadow receiveShadow>
    <cylinderGeometry args={[top, radius, height, segments]} />
    <meshStandardMaterial color={color} flatShading roughness={0.9} />
  </mesh>
);

export type FaceStyle = "concrete" | "guardrail" | "tyres" | "gabion";

/** Une face d'obstacle de `length` m le long de x, posée au sol, centrée sur l'origine. */
export const Face = ({
  style,
  length,
}: {
  style: FaceStyle;
  length: number;
}) => {
  if (style === "concrete") {
    // Séparateur béton profilé (type GBA) : semelle large, haut étroit, bande réfléchissante rouge et blanche.
    const count = Math.round(length / 2);
    return (
      <group>
        <Box size={[length, 0.3, 0.6]} at={[0, 0.15, 0]} color={CONCRETE} />
        <Box size={[length, 0.6, 0.24]} at={[0, 0.6, 0]} color={CONCRETE} />
        {Array.from({ length: count }, (_, i) => (
          <Box
            key={i}
            size={[length / count, 0.12, 0.25]}
            at={[-length / 2 + (length / count) * (i + 0.5), 0.75, 0]}
            color={i % 2 === 0 ? RED : WHITE}
          />
        ))}
      </group>
    );
  }
  if (style === "guardrail") {
    // Glissière métallique à double onde sur poteaux tous les 2 m.
    const posts = Math.round(length / 2) + 1;
    return (
      <group>
        {Array.from({ length: posts }, (_, i) => (
          <Box
            key={i}
            size={[0.12, 0.75, 0.12]}
            at={[-length / 2 + (length / (posts - 1)) * i, 0.375, -0.08]}
            color={STEEL}
          />
        ))}
        <Box size={[length, 0.16, 0.06]} at={[0, 0.52, 0.02]} color={STEEL} />
        <Box size={[length, 0.16, 0.06]} at={[0, 0.68, 0.02]} color={STEEL} />
      </group>
    );
  }
  if (style === "tyres") {
    // Mur de pneus cerclé d'une bande : trois rangs, un pneu à bande blanche sur trois.
    const per = Math.floor(length / 0.62);
    return (
      <group>
        {Array.from({ length: per * 3 }, (_, k) => {
          const i = k % per;
          const row = Math.floor(k / per);
          return (
            <Cylinder
              key={k}
              radius={0.3}
              height={0.24}
              at={[-length / 2 + 0.31 + i * 0.62, 0.12 + row * 0.25, 0]}
              color={(i + row) % 3 === 0 ? WHITE : RUBBER}
            />
          );
        })}
        <Box size={[length, 0.5, 0.05]} at={[0, 0.4, 0.33]} color={RUBBER} />
      </group>
    );
  }
  // Gabions : cages de pierres, massives, lisibles comme un mur.
  const cages = Math.round(length / 1.5);
  return (
    <group>
      {Array.from({ length: cages }, (_, i) => (
        <Box
          key={i}
          size={[length / cages - 0.04, 1, 0.8]}
          at={[-length / 2 + (length / cages) * (i + 0.5), 0.5, 0]}
          color={i % 2 === 0 ? STONE : "#7b7468"}
        />
      ))}
    </group>
  );
};

/** Bloc de chicane : pile de paille au centre, la face proposée devant et derrière. */
export const ChicaneBlock = ({
  style,
  span,
}: {
  style: FaceStyle;
  span: number;
}) => (
  <group>
    <Box
      size={[span - 0.4, CHICANE_STACK_HEIGHT, CHICANE_STACK_DEPTH - 0.3]}
      at={[0, CHICANE_STACK_HEIGHT / 2, 0]}
      color={HAY}
    />
    {[-1, 1].map((side) => (
      <group
        key={side}
        position={[0, 0, (side * CHICANE_STACK_DEPTH) / 2]}
        rotation={[0, side < 0 ? Math.PI : 0, 0]}
      >
        <Face style={style} length={span} />
      </group>
    ))}
  </group>
);

export type IslandStyle = "dome" | "planter" | "paved" | "lawn" | "rocks";

/** Petit îlot de rond-point de rayon `radius`, solide : ce qui ne se renverse pas doit en avoir l'air. */
export const SmallIsland = ({
  style,
  radius,
}: {
  style: IslandStyle;
  radius: number;
}) => {
  const curb = (
    <Cylinder
      radius={radius}
      height={0.2}
      at={[0, 0.1, 0]}
      color={CONCRETE}
      segments={20}
    />
  );
  if (style === "dome")
    return (
      <group>
        {curb}
        <mesh
          position={[0, 0.2, 0]}
          scale={[radius * 0.93, 1, radius * 0.93]}
          castShadow
        >
          <sphereGeometry args={[1, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={GRASS} flatShading roughness={1} />
        </mesh>
      </group>
    );
  if (style === "planter")
    // Jardinière béton haute, arbuste taillé au centre.
    return (
      <group>
        <Cylinder
          radius={radius}
          top={radius * 0.95}
          height={0.7}
          at={[0, 0.35, 0]}
          color={CONCRETE}
          segments={20}
        />
        <Cylinder
          radius={radius * 0.88}
          height={0.05}
          at={[0, 0.7, 0]}
          color="#4a3a2a"
          segments={20}
        />
        <mesh position={[0, 1.4, 0]} castShadow>
          <icosahedronGeometry args={[radius * 0.55, 0]} />
          <meshStandardMaterial color="#3f6a2c" flatShading roughness={1} />
        </mesh>
      </group>
    );
  if (style === "paved")
    // Îlot pavé à bordure haute, panneau giratoire au centre et quatre bornes rouge et blanc.
    return (
      <group>
        <Cylinder
          radius={radius}
          height={0.3}
          at={[0, 0.15, 0]}
          color="#8a8178"
          segments={20}
        />
        <Cylinder
          radius={0.12}
          height={2.2}
          at={[0, 1.4, 0]}
          color={STEEL}
          segments={8}
        />
        <Cylinder
          radius={0.45}
          height={0.06}
          at={[0, 2.2, 0.08]}
          color="#2b5fa8"
          segments={16}
        />
        {[0, 1, 2, 3].map((k) => (
          <Cylinder
            key={k}
            radius={0.18}
            top={0.15}
            height={0.9}
            at={[
              Math.cos((k * Math.PI) / 2) * radius * 0.75,
              0.75,
              Math.sin((k * Math.PI) / 2) * radius * 0.75,
            ]}
            color={k % 2 === 0 ? WHITE : RED}
            segments={8}
          />
        ))}
      </group>
    );
  if (style === "lawn")
    // Pelouse plate sur bordure, un arbre : un vrai îlot de village.
    return (
      <group>
        {curb}
        <Cylinder
          radius={radius * 0.97}
          height={0.25}
          at={[0, 0.125, 0]}
          color={GRASS}
          segments={20}
        />
        <Cylinder
          radius={0.14}
          top={0.1}
          height={2.4}
          at={[0, 1.45, 0]}
          color="#5b4330"
          segments={6}
        />
        <mesh position={[0, 3.1, 0]} castShadow>
          <dodecahedronGeometry args={[1.2, 0]} />
          <meshStandardMaterial color="#4c7a30" flatShading roughness={1} />
        </mesh>
      </group>
    );
  // Rochers groupés sur un lit de gravier.
  return (
    <group>
      <Cylinder
        radius={radius}
        height={0.12}
        at={[0, 0.06, 0]}
        color="#a39a8a"
        segments={20}
      />
      {[
        [0, 0, 0.9],
        [0.9, 0.5, 0.6],
        [-0.8, 0.6, 0.55],
        [0.2, -1, 0.65],
      ].map(([x, z, r], k) => (
        <mesh
          key={k}
          position={[x, r * 0.7, z]}
          rotation={[k, k * 1.3, 0]}
          castShadow
        >
          <dodecahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color={STONE} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
};
