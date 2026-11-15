"use client";

import { triangles } from "./geometry";
import type { BushModel } from "./hedges";
import type { TreeModel } from "./trees";
import { trianglesPerHectare, type VineModel } from "./vines";

/** Plafond d'arbres de `vegetation.ts` */
const MAX_TREES = 20000;
/** Part des arbres assez proches pour la version détaillée (moins de 80 m de la voiture environ) */
const NEAR_SHARE = 0.1;
/** Budget visé pour un arbre lointain */
const FAR_BUDGET = 60;

const NATURES: { nature: string; models: string }[] = [
  {
    nature: "Forêt fermée de feuillus",
    models:
      "Chêne à lobes 50 %, feuillu étagé 30 %, bouleau 18 %, arbre mort 2 %",
  },
  {
    nature: "Forêt fermée de conifères",
    models: "Sapin 60 %, pin sylvestre 40 % (pin en plaine, sapin en relief)",
  },
  {
    nature: "Forêt fermée mixte",
    models:
      "Moitié feuillus (chêne, étagé, bouleau), moitié conifères (sapin, pin)",
  },
  {
    nature: "Forêt ouverte",
    models:
      "Mêmes essences selon feuillus ou conifères, plus de bouleaux et de pins (pionniers)",
  },
  {
    nature: "Peupleraie",
    models:
      "Peuplier seul, en rangs réguliers comme le verger (maille 7 m, sans jitter)",
  },
  {
    nature: "Haie",
    models:
      "Massif allongé le long de la ligne, cap aligné sur le segment, plus un chêne tous les 25 m environ",
  },
  { nature: "Verger", models: "Fruitier de verger en rangs, maille 7 m" },
  {
    nature: "Vigne",
    models:
      "Rangs tous les 2 m : palissage complet à moins de 100 m, bande économique au-delà",
  },
  {
    nature: "Lande ligneuse",
    models:
      "Boules de haie éparses (1 pour 80 m²), un pin sylvestre ou un bouleau de loin en loin",
  },
  {
    nature: "Bois",
    models:
      "Comme la forêt mixte, à dominante feuillue : chêne, étagé, bouleau, 20 % de sapin",
  },
];

const format = (value: number): string =>
  Math.round(value).toLocaleString("fr-FR");

interface RecommendationsProps {
  trees: TreeModel[];
  bushes: BushModel[];
  vines: VineModel[];
}

/** Encadré texte : modèle par `nature` BD TOPO et budget de triangles. */
export const Recommendations = ({
  trees,
  bushes,
  vines,
}: RecommendationsProps) => {
  const near = trees.map((tree) => triangles(tree.near));
  const far = trees.map((tree) => triangles(tree.far ?? tree.near));
  const average = (list: number[]): number =>
    list.reduce((sum, value) => sum + value, 0) / Math.max(1, list.length);
  const allNear = MAX_TREES * average(near);
  const withLod =
    MAX_TREES * NEAR_SHARE * average(near) +
    MAX_TREES * (1 - NEAR_SHARE) * average(far);
  const overBudget = trees.filter((tree) => triangles(tree.near) > FAR_BUDGET);

  return (
    <aside
      aria-label="Recommandations végétation"
      className="absolute top-3 right-3 bottom-3 z-30 w-[380px] overflow-y-auto rounded bg-black/75 p-4 text-xs leading-relaxed text-neutral-200"
    >
      <h2 className="mb-2 text-sm font-semibold text-neutral-50">
        Recommandation par nature BD TOPO
      </h2>
      <table className="w-full border-collapse">
        <tbody>
          {NATURES.map(({ nature, models }) => (
            <tr key={nature} className="border-t border-neutral-700 align-top">
              <th
                scope="row"
                className="w-32 py-1 pr-2 text-left font-semibold text-neutral-100"
              >
                {nature}
              </th>
              <td className="py-1">{models}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-neutral-400">
        Saule pleureur : à poser près de l’eau (moins de 15 m d’une surface
        d’eau, le paramètre `water` de `buildTrees` est déjà là), et peuplier en
        bord de rivière hors peupleraie.
      </p>

      <h2 className="mt-4 mb-2 text-sm font-semibold text-neutral-50">
        Budget pour {format(MAX_TREES)} arbres instanciés
      </h2>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          Moyenne des propositions : {format(average(near))} tri en proche,{" "}
          {format(average(far))} tri en lointain.
        </li>
        <li>Tout en version proche : {format(allNear)} triangles.</li>
        <li>
          Avec versions lointaines ({format(NEAR_SHARE * 100)} % proches) :{" "}
          {format(withLod)} triangles, avant le masquage des tranches lointaines
          par `useChunkCulling`.
        </li>
        <li>
          Au-dessus de {FAR_BUDGET} tri :{" "}
          {overBudget.map((tree) => tree.label).join(", ") || "aucun"} ; chacun
          a sa version lointaine (26 à 46 tri), à basculer par tranche selon la
          distance.
        </li>
      </ul>

      <h2 className="mt-4 mb-2 text-sm font-semibold text-neutral-50">Haies</h2>
      <ul className="list-disc space-y-1 pl-4">
        {bushes.map((bush) => (
          <li key={bush.id}>
            {bush.label} : {triangles(bush.geometry)} tri par module de{" "}
            {bush.length.toLocaleString("fr-FR")} m, soit{" "}
            {format((triangles(bush.geometry) * 1000) / bush.spacing)} tri par
            km de haie.
          </li>
        ))}
        <li>
          Recommandé : massif allongé, à peine plus cher que les arbres actuels
          mais une vraie haie continue. Il demande un nouveau type d’objet et un
          cap aligné sur la ligne (aujourd’hui quelconque).
        </li>
      </ul>

      <h2 className="mt-4 mb-2 text-sm font-semibold text-neutral-50">Vigne</h2>
      <ul className="list-disc space-y-1 pl-4">
        {vines.map((vine) => (
          <li key={vine.id}>
            {vine.label} : {triangles(vine.geometry)} tri par module, ≈{" "}
            {format(trianglesPerHectare(vine.geometry))} tri par hectare.
          </li>
        ))}
        <li>
          Stratégie : une instance par module de 5 m de rang (pas par cep), le
          dernier module raccourci par une échelle en x. Le sens des rangs vient
          du plus long côté de la parcelle, la BD TOPO ne le donne pas.
        </li>
      </ul>
    </aside>
  );
};
