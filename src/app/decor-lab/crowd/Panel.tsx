"use client";

import { useMemo } from "react";
import type { BufferGeometry } from "three";
import { CHICANE_GEOMETRY } from "@/render/scenery/models";
import {
  bannerPosts,
  beachFlag,
  DA,
  flagMast,
  foldingChair,
  inflatableArch,
  parasol,
  placardStake,
  tapeLine,
  tent,
} from "./dressing";
import { APP_HEX } from "./dressing";
import { ATLAS_FLAGS, ATLAS_SIZE, HOST_FLAG } from "./flagAtlas";
import { PART, partBit, triangles, visibleTriangles } from "./geometry";
import { DISTRIBUTION, LOD_FAR, LOD_NEAR } from "./placement";
import {
  POSE_LABEL,
  POSES,
  STYLE_SPECS,
  STYLES,
  type StyleId,
  buildPerson,
} from "./people";

/** Masques réellement employés par la garde-robe : de la tenue la plus légère à la plus chargée. */
const MASKS = [
  partBit(PART.hair),
  partBit(PART.cap),
  partBit(PART.beanie),
  partBit(PART.hood),
  partBit(PART.band) | partBit(PART.cap),
];

interface PoseCount {
  min: number;
  max: number;
  total: number;
}

const measure = (geometry: BufferGeometry): PoseCount => {
  const counts = MASKS.map((mask) => visibleTriangles(geometry, mask));
  const result = {
    min: Math.min(...counts),
    max: Math.max(...counts),
    total: triangles(geometry),
  };
  geometry.dispose();
  return result;
};

const DRESSING: { label: string; build: () => BufferGeometry; note: string }[] =
  [
    {
      label: "Banderole (piquets + toile)",
      build: () => bannerPosts(6, 2.4),
      note: "+ 2 triangles de toile",
    },
    {
      label: "Rubalise, 10 m",
      build: () => tapeLine(10),
      note: "piquets tous les 2,5 m",
    },
    {
      label: "Arche gonflable 11 m",
      build: () => inflatableArch(11),
      note: "+ 2 triangles d'enseigne",
    },
    {
      label: "Beach flag",
      build: () => beachFlag(DA.brand, DA.night),
      note: "voile extrudée",
    },
    {
      label: "Drapeau sur mât",
      build: () => flagMast(),
      note: "+ 12 triangles de toile, cellule de l'atlas",
    },
    {
      label: "Pancarte",
      build: () => placardStake(),
      note: "+ 2 triangles de message",
    },
    {
      label: "Tente 3 × 3 m",
      build: () => tent([DA.brand, DA.night], DA.night),
      note: "",
    },
    { label: "Parasol", build: () => parasol([DA.sky, DA.snow]), note: "" },
    { label: "Chaise pliante", build: () => foldingChair(DA.sky), note: "" },
  ];

/** Tokens de `globals.css` repris par l'habillage, du plus présent au plus discret. */
const COLORS: { token: string; hex: string; use: string }[] = [
  {
    token: "--brand",
    hex: APP_HEX.brand,
    use: "couleur principale : arche, voiles, banderole, toit de tente, pancartes",
  },
  {
    token: "--background",
    hex: APP_HEX.ink,
    use: "encre sur le jaune, lest de l'arche",
  },
  {
    token: "--card",
    hex: APP_HEX.night,
    use: "quartiers de l'arche, enseignes, voiles sombres, lambrequin",
  },
  { token: "--accent", hex: APP_HEX.slate, use: "fond de pancarte discret" },
  {
    token: "--foreground",
    hex: APP_HEX.snow,
    use: "texte clair, liseré de voile, pancarte claire",
  },
  {
    token: "--chart-2",
    hex: APP_HEX.sky,
    use: "touche secondaire : une voile sur quatre",
  },
  {
    token: "rubalise, damier",
    hex: "#d9472b",
    use: "couleurs réelles, hors charte",
  },
];

interface PanelProps {
  groupStyle: StyleId;
  onStyle: (style: StyleId) => void;
}

/** Encadré : choix du style des groupes, triangles mesurés et recommandation. */
export const Panel = ({ groupStyle, onStyle }: PanelProps) => {
  const counts = useMemo(
    () =>
      Object.fromEntries(
        STYLES.map((style) => [
          style,
          POSES.map((pose) => measure(buildPerson(style, pose))),
        ]),
      ) as Record<StyleId, PoseCount[]>,
    [],
  );
  const dressing = useMemo(
    () =>
      DRESSING.map((entry) => {
        const geometry = entry.build();
        const count = triangles(geometry);
        geometry.dispose();
        return { ...entry, count };
      }),
    [],
  );
  // Moyenne des poses debout les plus fréquentes (sans enfant ni commissaire), tenue la plus chargée.
  const average = (style: StyleId): number => {
    const list = counts[style].slice(0, 4).map((count) => count.max);
    return Math.round(list.reduce((sum, n) => sum + n, 0) / list.length);
  };

  return (
    <aside className="w-[380px] shrink-0 overflow-y-auto border-l border-neutral-700 bg-neutral-900 p-4 text-sm leading-relaxed text-neutral-300">
      <h2 className="mb-2 text-base font-semibold text-neutral-100">
        Public et banderoles
      </h2>
      <p className="mb-3 text-neutral-400">
        Propositions seulement : rien n&apos;est branché au jeu. Rangées du nord
        = les trois styles dans les sept poses ; garde-robe, bloc de variété et
        groupes du sud suivent le style choisi ici. La file à l&apos;ouest
        montre la chaîne de niveaux de détail.
      </p>

      <div
        className="mb-4 flex gap-1"
        role="group"
        aria-label="Style des groupes"
      >
        {STYLES.map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => onStyle(style)}
            aria-pressed={style === groupStyle}
            className={`flex-1 rounded px-2 py-1 text-xs ${style === groupStyle ? "bg-neutral-100 text-neutral-900" : "bg-neutral-800 hover:bg-neutral-700"}`}
          >
            {STYLE_SPECS[style].label}
          </button>
        ))}
      </div>

      <h3 className="mb-1 font-semibold text-neutral-100">
        Triangles par personnage
      </h3>
      <p className="mb-2 text-xs text-neutral-500">
        Dessinés selon la tenue (min–max) ; entre parenthèses, la géométrie
        complète avec toutes les coiffes écrasées.
      </p>
      <table className="mb-4 w-full text-xs">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="py-1 font-normal">Pose</th>
            {STYLES.map((style) => (
              <th key={style} className="py-1 font-normal">
                {STYLE_SPECS[style].label.split(" · ")[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {POSES.map((pose, i) => (
            <tr key={pose} className="border-t border-neutral-800">
              <td className="py-1 pr-2">{POSE_LABEL[pose]}</td>
              {STYLES.map((style) => {
                const count = counts[style][i];
                return (
                  <td key={style} className="py-1 tabular-nums">
                    {count.min}–{count.max}{" "}
                    <span className="text-neutral-500">({count.total})</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mb-4 space-y-1 text-xs">
        {STYLES.map((style) => (
          <li key={style}>
            <span className="text-neutral-100">{STYLE_SPECS[style].label}</span>{" "}
            : {STYLE_SPECS[style].blurb} Pour 400 spectateurs ≈{" "}
            <span className="tabular-nums text-neutral-100">
              {(average(style) * 400).toLocaleString("fr-FR")}
            </span>{" "}
            triangles.
          </li>
        ))}
      </ul>

      <h3 className="mb-1 font-semibold text-neutral-100">Habillage</h3>
      <table className="mb-4 w-full text-xs">
        <tbody>
          {dressing.map((entry) => (
            <tr key={entry.label} className="border-t border-neutral-800">
              <td className="py-1 pr-2">{entry.label}</td>
              <td className="py-1 tabular-nums">{entry.count}</td>
              <td className="py-1 text-neutral-500">{entry.note}</td>
            </tr>
          ))}
          <tr className="border-t border-neutral-800">
            <td className="py-1 pr-2">Barrière de chicane, module 2 m</td>
            <td className="py-1 tabular-nums">
              {triangles(CHICANE_GEOMETRY.chicaneBarrier)}
            </td>
            <td className="py-1 text-neutral-500">celle du jeu, partagée</td>
          </tr>
          <tr className="border-t border-neutral-800">
            <td className="py-1 pr-2">Toile de drapeau tenu</td>
            <td className="py-1 tabular-nums">2</td>
            <td className="py-1 text-neutral-500">cellule de l&apos;atlas</td>
          </tr>
        </tbody>
      </table>

      <h3 className="mb-1 font-semibold text-neutral-100">Recommandation</h3>
      <ul className="mb-4 list-disc space-y-1.5 pl-4">
        <li>
          <strong className="text-neutral-100">
            Chaîne de niveaux de détail
          </strong>{" "}
          (story 5.6, file à l&apos;ouest de la scène) :{" "}
          <strong className="text-neutral-100">B · Figurine</strong>{" "}
          jusqu&apos;à {LOD_NEAR} m ({average("figurine")} triangles),{" "}
          <strong className="text-neutral-100">A · Facetté</strong> de{" "}
          {LOD_NEAR} à {LOD_FAR} m ({average("facet")}),{" "}
          <strong className="text-neutral-100">C · Pictogramme</strong> au-delà
          ({average("picto")}). La même tenue suit le spectateur d&apos;un
          niveau à l&apos;autre : seuls la géométrie et le lot changent.
        </li>
        <li>
          Coût d&apos;une spéciale de 400 spectateurs vue du départ (60 à moins
          de {LOD_NEAR} m, 140 jusqu&apos;à {LOD_FAR} m, 200 au-delà) ≈{" "}
          <span className="tabular-nums text-neutral-100">
            {(
              average("figurine") * 60 +
              average("facet") * 140 +
              average("picto") * 200
            ).toLocaleString("fr-FR")}
          </span>{" "}
          triangles, contre{" "}
          {(average("figurine") * 400).toLocaleString("fr-FR")} tout en B. Au
          plus 21 appels de dessin (7 poses × 3 niveaux), moins une fois les
          lots vides écartés.
        </li>
        <li>
          <strong className="text-neutral-100">Arche</strong> : une seule arche
          gonflable pour le départ (avec le panneau lumineux de{" "}
          <code>StartLights</code> sous l&apos;enseigne), les intermédiaires des
          secteurs 2 et 3 et l&apos;arrivée (liseré en damier) ; seule
          l&apos;enseigne change. Départ et arrivée ont le même dispositif
          complet : arche, banderole, voiles, mâts à drapeaux, tente, public
          des deux côtés derrière la rubalise et 4 commissaires ; l&apos;arrivée
          ajoute le damier et n&apos;a pas de panneau lumineux.
        </li>
        <li>
          <strong className="text-neutral-100">Épingles</strong> : la barrière
          de chicane du jeu devant le public (plus de bottes couchées), un
          commissaire au point de corde.
        </li>
        <li>
          <strong className="text-neutral-100">Couleurs</strong> : le jaune de
          marque en tête, sur la nuit de l&apos;application ; voir le tableau
          ci-dessous.
        </li>
      </ul>

      <h3 className="mb-1 font-semibold text-neutral-100">
        Couleurs de l&apos;habillage
      </h3>
      <table className="mb-4 w-full text-xs">
        <tbody>
          {COLORS.map((row) => (
            <tr key={row.token} className="border-t border-neutral-800">
              <td className="py-1 pr-2">
                <span
                  aria-hidden
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                  style={{ background: row.hex }}
                />
                <code>{row.token}</code>
              </td>
              <td className="py-1 text-neutral-500">{row.use}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mb-1 font-semibold text-neutral-100">
        Habillage : où et combien
      </h3>
      <table className="mb-2 w-full text-xs">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="py-1 font-normal">Endroit</th>
            <th className="py-1 font-normal">Voiles</th>
            <th className="py-1 font-normal">Pancartes</th>
            <th className="py-1 font-normal">Mâts</th>
            <th className="py-1 font-normal">Commissaires</th>
          </tr>
        </thead>
        <tbody>
          {DISTRIBUTION.map((row) => (
            <tr
              key={row.zone}
              className="border-t border-neutral-800 align-top"
            >
              <td className="py-1 pr-2">
                {row.zone}
                <div className="text-neutral-500">{row.where}</div>
              </td>
              {[row.flags, row.placards, row.masts, row.marshals].map(
                (count, i) => (
                  <td key={i} className="py-1 tabular-nums">
                    {row.places > 1 && count > 0
                      ? `${row.places} × ${count}`
                      : count}
                  </td>
                ),
              )}
            </tr>
          ))}
          <tr className="border-t border-neutral-700 text-neutral-100">
            <td className="py-1 pr-2">Total par spéciale</td>
            {(["flags", "placards", "masts", "marshals"] as const).map(
              (key) => (
                <td key={key} className="py-1 tabular-nums">
                  {DISTRIBUTION.reduce(
                    (sum, row) => sum + row.places * row[key],
                    0,
                  )}
                </td>
              ),
            )}
          </tr>
        </tbody>
      </table>
      <p className="mb-4 text-xs text-neutral-500">
        Dans la scène, d&apos;ouest en est : l&apos;épingle, le départ, les
        intermédiaires 2 et 3, puis l&apos;arrivée, chacun avec ses voiles et
        pancartes ; départ et arrivée ont chacun 24 spectateurs derrière la
        rubalise et 4 commissaires. Couleur des voiles, message des pancartes
        et pays des mâts tirés par hachage.
      </p>

      <h3 className="mb-1 font-semibold text-neutral-100">
        Drapeaux tenus par le public
      </h3>
      <ul className="mb-4 list-disc space-y-1.5 pl-4">
        <li>
          Tous les drapeaux du garage ({ATLAS_FLAGS.length} pays de{" "}
          <code>FLAGS</code>, sans « Sans drapeau »), chaque spectateur tirant
          le sien par hachage de sa graine : {HOST_FLAG} une fois sur quatre,
          sinon un autre pays au hasard. Échantillon de 24 au nord de la route,
          face à la vue par défaut. Sur les mâts : {HOST_FLAG} puis deux pays
          étrangers tirés de la graine de l&apos;endroit.
        </li>
        <li>
          <strong className="text-neutral-100">Technique</strong> : un atlas (un
          seul <code>CanvasTexture</code> de {ATLAS_SIZE.width} ×{" "}
          {ATLAS_SIZE.height} px, cellules de 48 × 32) rempli une fois depuis
          les SVG de <code>loadFlagImages</code>. La toile est un plan de 2
          triangles instancié (12 pour la toile ondulée des mâts) ; un attribut
          d&apos;instance{" "}
          <code>flagCell</code> décale les UV vers la bonne cellule dans le
          shader.
        </li>
        <li>
          <strong className="text-neutral-100">Coût</strong> : 1 appel de dessin
          par lot, 2 triangles par drapeau, ~
          {Math.round((ATLAS_SIZE.width * ATLAS_SIZE.height * 4) / 1e5) / 10} Mo
          de texture (sans mipmaps, pour que les cellules ne bavent pas) et le
          décodage des SVG une seule fois au chargement. Au-delà de {LOD_FAR} m,
          la toile peut sauter : un drapeau n&apos;y fait plus qu&apos;un pixel.
        </li>
      </ul>

      <h3 className="mb-1 font-semibold text-neutral-100">
        À changer dans le jeu
      </h3>
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>
          <code>models.ts</code> : la fonction <code>part</code> gagne deux
          attributs de sommet, <code>slot</code> (0 fixe, 1 peau, 2 haut, 3 bas,
          4 tête) et <code>partId</code> (coiffe, capuche, bande). Les pièces
          habillées sont en blanc. Un modèle par pose :{" "}
          <code>spectatorCheer</code>, <code>spectatorRail</code>…
        </li>
        <li>
          <code>SceneryView.tsx</code> : pour les poses du public, un matériau
          dédié (celui de <code>crowd/crowdMaterial.ts</code>) qui lit une
          palette de 32 couleurs en uniforme, et deux attributs d&apos;instance
          posés sur une copie de la géométrie par lot : <code>outfit</code> (4
          indices de palette) et <code>partMask</code>. Plus de{" "}
          <code>setColorAt</code> pour eux, et un{" "}
          <code>customDepthMaterial</code> pour que les coiffes masquées ne
          fassent pas d&apos;ombre. Libérer la copie au démontage.
        </li>
        <li>
          La tenue se tire d&apos;un hachage de la position de l&apos;instance
          dans la vue : rien à changer dans <code>scenery.ts</code> ni dans le
          codec, aucun tirage du décor ne bouge.
        </li>
        <li>
          Variante sans shader, si on préfère : couper chaque pose en 3
          maillages (peau, haut, bas) et donner à chacun sa couleur par{" "}
          <code>setColorAt</code>. Simple, mais 3 fois plus d&apos;appels de
          dessin et pas de coiffes variables.
        </li>
        <li>
          Banderoles et pancartes : un atlas de textes (un seul{" "}
          <code>CanvasTexture</code>) et un matériau texturé à part ; le reste
          de l&apos;habillage reste en couleurs par sommet.
        </li>
        <li>
          Drapeaux tenus : reprendre <code>crowd/flagAtlas.ts</code> (atlas
          partagé, attribut <code>flagCell</code>) et le lot de toiles de{" "}
          <code>crowd/Crowd.tsx</code> ; le pays se tire du même hachage que la
          tenue.
        </li>
        <li>
          Arche de départ : brancher le panneau sur <code>StartLights</code> tel
          quel, l&apos;arche gonflable remplaçant la bannière actuelle.
        </li>
      </ol>
    </aside>
  );
};
