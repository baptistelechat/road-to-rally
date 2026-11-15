"use client";

import { Barrier } from "./Barrier";
import { ControlZone } from "./ControlZone";
import { Crowd } from "./Crowd";
import { APP_HEX } from "./dressing";
import { BUILD, Arch, Sail, Sign } from "./Fixtures";
import { Label } from "./Label";
import {
  FAMILY,
  FLAG_SAMPLE,
  HAIRPIN_CROWD,
  LOD_END,
  LOD_FAR,
  LOD_FILE,
  LOD_NEAR,
  LOD_ORIGIN_X,
  MARSHALS,
  POSE_X,
  STYLE_ROW_Z,
  STYLE_ROWS,
  TAPE_CROWD,
  VARIETY_BLOCK,
  WARDROBE_ROW,
  WARDROBE_ROW_Z,
} from "./placement";
import { Piece } from "./Piece";
import { WARDROBE_LABEL, WARDROBES } from "./outfits";
import { POSE_LABEL, POSES, STYLE_SPECS, STYLES, type StyleId } from "./people";

const ROAD_COLOR = "#3b3e44";
const VERGE_COLOR = "#8c8070";
const MEADOW_COLOR = "#5f7a3a";
/** Route le long de X, de -73 à 127 : l'arrivée garde la place de sa tente */
const ROAD = { center: 27, length: 200 };

/** Sol, accotements et route droite le long de X, lignes de rive comprises. */
const Ground = () => (
  <group>
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[-150, -0.02, 0]}
      receiveShadow
    >
      <planeGeometry args={[1200, 600]} />
      <meshStandardMaterial color={MEADOW_COLOR} roughness={1} />
    </mesh>
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[ROAD.center, -0.01, 0]}
      receiveShadow
    >
      <planeGeometry args={[ROAD.length, 9]} />
      <meshStandardMaterial color={VERGE_COLOR} roughness={1} />
    </mesh>
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[ROAD.center, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[ROAD.length, 7]} />
      <meshStandardMaterial color={ROAD_COLOR} roughness={0.95} />
    </mesh>
    {[-3.2, 3.2].map((z) => (
      <mesh
        key={z}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[ROAD.center, 0.005, z]}
      >
        <planeGeometry args={[ROAD.length, 0.12]} />
        <meshStandardMaterial color="#e9e6dc" roughness={0.9} />
      </mesh>
    ))}
  </group>
);

/** Repère de distance en travers de la file des niveaux de détail. */
const Threshold = ({ distance }: { distance: number }) => (
  <mesh
    rotation={[-Math.PI / 2, 0, 0]}
    position={[LOD_ORIGIN_X - distance, 0.01, 0]}
  >
    <planeGeometry args={[0.4, 8]} />
    <meshStandardMaterial color={APP_HEX.snow} roughness={0.9} />
  </mesh>
);

interface CrowdSceneProps {
  /** Style employé pour les groupes, la garde-robe et le bloc de variété */
  groupStyle: StyleId;
}

/** Styles et poses au nord, groupes au sud, répartition le long de la route à l'est, niveaux de détail à l'ouest. */
export const CrowdScene = ({ groupStyle }: CrowdSceneProps) => (
  <>
    <Ground />

    {/* Styles × poses */}
    {STYLES.map((style, k) => (
      <group key={style}>
        <Crowd style={style} members={STYLE_ROWS[style]} />
        <Label
          position={[POSE_X(0) - 3.4, 1.2, STYLE_ROW_Z(k)]}
          title={STYLE_SPECS[style].label}
        />
      </group>
    ))}
    {POSES.map((pose, i) => (
      <Label
        key={pose}
        position={[POSE_X(i), 3.1, STYLE_ROW_Z(0)]}
        title={POSE_LABEL[pose]}
      />
    ))}

    {/* Garde-robe */}
    <Crowd style={groupStyle} members={WARDROBE_ROW} />
    {WARDROBES.map((wardrobe, w) => (
      <Label
        key={wardrobe}
        position={[POSE_X(w), 2.6, WARDROBE_ROW_Z]}
        title={WARDROBE_LABEL[wardrobe]}
      />
    ))}

    {/* Variété */}
    <Crowd style={groupStyle} members={VARIETY_BLOCK} />
    <Label
      position={[3.75, 3.2, -9]}
      title="24 tirages au hasard"
      detail="tenue, pose, taille, cap et drapeau par hachage"
    />

    {/* Épingle : barrière de chicane, 2 voiles, 3 pancartes */}
    <Barrier modules={5} position={[-30.5, 0, 5.2]} />
    <Crowd style={groupStyle} members={HAIRPIN_CROWD} />
    <Sail position={[-32.4, 0, 5.6]} seed={1} />
    <Sail position={[-18.6, 0, 5.6]} seed={2} />
    <Sign position={[-33.2, 0, 6.6]} seed={30} />
    <Sign position={[-31.8, 0, 7.8]} seed={31} />
    <Sign position={[-19.2, 0, 7.0]} seed={32} />
    <Label
      position={[-25.6, 3.6, 7]}
      title="Épingle · 2 voiles, 3 pancartes"
      detail="public massé derrière la barrière de chicane"
    />

    {/* Rubalise */}
    <Piece build={BUILD.tapeShort} position={[-16.5, 0, 5.1]} />
    <Crowd style={groupStyle} members={TAPE_CROWD} />
    <Label position={[-10.5, 3.2, 6]} title="File le long d'une rubalise" />

    {/* Famille */}
    <Piece build={BUILD.parasol} position={[4.3, 0, 7.6]} />
    <Piece
      build={BUILD.chairSky}
      position={[3.2, 0, 6.9]}
      rotation={[0, Math.PI + 0.2, 0]}
    />
    <Piece
      build={BUILD.chairEmber}
      position={[4.3, 0, 6.7]}
      rotation={[0, Math.PI - 0.1, 0]}
    />
    <Crowd style={groupStyle} members={FAMILY} />
    <Label
      position={[4.4, 3.6, 7.4]}
      title="Famille"
      detail="parasol, chaises pliantes, glacière"
    />

    {/* Commissaires */}
    <Crowd style={groupStyle} members={MARSHALS} />
    <Label
      position={[13, 3.2, 5.6]}
      title="Commissaires"
      detail="tenue orange, drapeau jaune"
    />

    {/* Départ : arche et feux, 4 voiles, 2 pancartes, banderole, mâts, tente, public, commissaires */}
    <ControlZone
      x={24}
      sign="DÉPART · ES 1"
      banner="SPÉCIALE 1 · DÉPART"
      seed={3}
      style={groupStyle}
      lights
      details
      title="Départ · 4 voiles, 2 pancartes, 3 mâts"
      detail="arche et panneau lumineux, 24 spectateurs, 4 commissaires"
    />

    {/* Drapeaux tenus : tous les pays du jeu, par atlas, face à la vue par défaut */}
    <Crowd style={groupStyle} members={FLAG_SAMPLE} />
    <Label
      position={[14.6, 4.4, -8.6]}
      title="Drapeaux du public · 24 tirages"
      detail="tous les pays du garage, la France une fois sur quatre"
    />

    {/* Intermédiaires : même arche, 2 voiles en quinconce, 1 pancarte */}
    {[
      { x: 58, sector: 2 },
      { x: 78, sector: 3 },
    ].map(({ x, sector }) => (
      <group key={sector}>
        <Arch x={x} text={`SECTEUR ${sector}`} />
        <Sail position={[x - 2.5, 0, 6.2]} seed={10 + sector} />
        <Sail position={[x + 2.5, 0, -6.2]} seed={11 + sector} />
        <Sign position={[x + 3, 0, 6.0]} seed={40 + sector} />
        <Label
          position={[x, 7.4, 0]}
          title={`Intermédiaire ${sector} · 2 voiles, 1 pancarte`}
        />
      </group>
    ))}

    {/* Arrivée : le même dispositif que le départ, enseigne et mât à damier, sans panneau lumineux */}
    <ControlZone
      x={100}
      sign="ARRIVÉE"
      banner="SPÉCIALE 1 · ARRIVÉE"
      seed={7}
      style={groupStyle}
      checker
      title="Arrivée · même habillage que le départ"
      detail="enseigne et 4e mât à damier, sans panneau lumineux"
    />

    {/* Niveaux de détail : B, puis A au-delà de 120 m, puis C au-delà de 300 m */}
    {STYLES.map((style) => (
      <Crowd key={style} style={style} members={LOD_FILE[style]} />
    ))}
    <Threshold distance={0} />
    <Threshold distance={LOD_NEAR} />
    <Threshold distance={LOD_FAR} />
    {/* Étiquettes en quinconce (sud bas, nord haut) : vues depuis l'est, elles ne se chevauchent plus */}
    <Label
      fixed
      position={[LOD_ORIGIN_X, 1.4, 5]}
      title="Point de vue · 0 m"
      detail="la file s'éloigne vers l'ouest"
    />
    <Label
      fixed
      position={[LOD_ORIGIN_X - LOD_NEAR / 2, 6, -5]}
      title="B · Figurine"
      detail={`0 à ${LOD_NEAR} m`}
    />
    <Label
      fixed
      position={[LOD_ORIGIN_X - LOD_NEAR, 3, 5]}
      title={`Seuil ${LOD_NEAR} m`}
    />
    <Label
      fixed
      position={[LOD_ORIGIN_X - (LOD_NEAR + LOD_FAR) / 2, 9, -5]}
      title="A · Facetté"
      detail={`${LOD_NEAR} à ${LOD_FAR} m`}
    />
    <Label
      fixed
      position={[LOD_ORIGIN_X - LOD_FAR, 4, 5]}
      title={`Seuil ${LOD_FAR} m`}
    />
    <Label
      fixed
      position={[LOD_ORIGIN_X - (LOD_FAR + LOD_END) / 2, 12, -5]}
      title="C · Pictogramme"
      detail={`au-delà de ${LOD_FAR} m`}
    />
  </>
);
