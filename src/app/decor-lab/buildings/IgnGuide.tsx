"use client";

// Encadré : de la BD TOPO à la typologie, et ce qu'il faut ajouter au contrat `DecorBuilding`.

interface CodeProps {
  children: string;
}

const Code = ({ children }: CodeProps) => (
  <code className="rounded bg-neutral-800 px-1 text-[11px] text-amber-200">
    {children}
  </code>
);

interface Rule {
  when: string;
  then: string;
}

const NATURE_RULES: Rule[] = [
  { when: "« Église »", then: "Église à clocher (variante A)" },
  { when: "« Chapelle »", then: "Chapelle à clocheton (variante B)" },
  {
    when: "« Château »",
    then: "Maison de bourg R+2 ardoise, en croupe, sans mitoyenneté",
  },
  {
    when: "« Tour, donjon »",
    then: "Clocher seul : emprise carrée, croupe à 70° et plus",
  },
  {
    when: "« Silo »",
    then: "Silo : prisme octogonal, toit conique ; batterie (B) si plusieurs silos à moins de 1 m",
  },
  {
    when: "« Serre »",
    then: "Serre : tunnel (A) si ≤ 12 m de large, multi-chapelles (B) au-delà, une chapelle par 8 m",
  },
  {
    when: "« Arc de triomphe », « Monument »…",
    then: "Monument : obélisque sur socle (A) si < 20 m², bloc de pierre massif (B) sinon",
  },
  {
    when: "« Industriel, agricole ou commercial »",
    then: "Départager par usage_1 (ci-dessous)",
  },
  {
    when: "« Indifférenciée » (le cas courant)",
    then: "Départager par usage_1 (ci-dessous)",
  },
];

const USAGE_RULES: Rule[] = [
  {
    when: "usage « Annexe », ou < 30 m², ou hauteur < 3 m",
    then: "Annexe / garage",
  },
  {
    when: "Résidentiel, arête commune avec un voisin, ≥ 1 étage",
    then: "Maison de bourg (R+2 et plus : variante B)",
  },
  {
    when: "Résidentiel, ≥ 4 logements ou ≥ 3 étages",
    then: "Petit immeuble (toit plat si les altitudes de toit se confondent)",
  },
  {
    when: "Résidentiel ou Agricole, longueur ≥ 2,5 × largeur, ≤ 5 m de haut",
    then: "Longère",
  },
  {
    when: "Résidentiel, autres cas",
    then: "Pavillon (croupe si plain-pied, pignon sinon)",
  },
  {
    when: "Agricole, construction légère ou > 400 m²",
    then: "Hangar ouvert ou grange",
  },
  {
    when: "Industriel, Commercial et services > 300 m²",
    then: "Bâtiment d'activité (acrotère si toit plat)",
  },
  {
    when: "Commercial et services, mitoyen en bourg",
    then: "Maison de bourg avec vitrine",
  },
  {
    when: "Religieux sans nature précise",
    then: "Chapelle si < 150 m², église sinon",
  },
];

const NEW_FIELDS: Rule[] = [
  {
    when: "type",
    then: "Typologie résolue côté geo (union de 11 valeurs), à la place de kind ou en plus",
  },
  {
    when: "floors",
    then: "nombre_d_etages, ou hauteur / 3 m arrondi : place les rangs de fenêtres",
  },
  {
    when: "roof",
    then: "« gable » | « hip » | « flat » | « parapet » | « shed », déduit du type et de l'écart altitude_maximale_toit − altitude_minimale_toit",
  },
  {
    when: "party",
    then: "Indices des arêtes mitoyennes : calculés dans buildBuildings, qui a déjà tous les voisins",
  },
  {
    when: "street",
    then: "Indice de l'arête la plus proche de la route : porte, vitrine",
  },
];

interface RuleListProps {
  rules: Rule[];
}

const RuleList = ({ rules }: RuleListProps) => (
  <ul className="space-y-1">
    {rules.map((rule) => (
      <li key={rule.when}>
        <span className="text-neutral-200">{rule.when}</span>
        <span className="text-neutral-500"> → </span>
        <span className="text-neutral-400">{rule.then}</span>
      </li>
    ))}
  </ul>
);

/** Comment déduire la typologie des données IGN */
export const IgnGuide = () => (
  <section
    aria-labelledby="ign-title"
    className="space-y-3 rounded border border-neutral-700 p-3 text-xs"
  >
    <h2 id="ign-title" className="text-sm font-semibold">
      Déduire la typologie de la BD TOPO
    </h2>
    <p className="text-neutral-400">
      Couche <Code>BDTOPO_V3:batiment</Code>. On lit d&apos;abord{" "}
      <Code>nature</Code>, qui tranche les cas rares et sûrs, puis{" "}
      <Code>usage_1</Code> (et <Code>usage_2</Code> en secours), affiné par la
      géométrie : surface, allongement, mitoyenneté. Tout se calcule côté{" "}
      <Code>src/geo/decor</Code>, de façon déterministe.
    </p>
    <details open>
      <summary className="cursor-pointer font-semibold">1. Par nature</summary>
      <div className="mt-2">
        <RuleList rules={NATURE_RULES} />
      </div>
    </details>
    <details open>
      <summary className="cursor-pointer font-semibold">
        2. Par usage et géométrie, dans cet ordre
      </summary>
      <div className="mt-2">
        <RuleList rules={USAGE_RULES} />
      </div>
    </details>
    <details>
      <summary className="cursor-pointer font-semibold">
        3. Champs à demander au WFS
      </summary>
      <p className="mt-2 text-neutral-400">
        Aujourd&apos;hui :{" "}
        <Code>hauteur,nombre_d_etages,usage_1,construction_legere</Code>.
        Ajouter{" "}
        <Code>
          nature,usage_2,nombre_de_logements,altitude_minimale_toit,altitude_maximale_toit
        </Code>
        , et si utiles <Code>materiaux_des_murs,materiaux_de_la_toiture</Code>{" "}
        (codes des fichiers fonciers, souvent vides : à vérifier sur un
        échantillon avant de s&apos;y fier).
      </p>
    </details>
    <details>
      <summary className="cursor-pointer font-semibold">
        4. Champs à ajouter à DecorBuilding
      </summary>
      <div className="mt-2 space-y-2">
        <RuleList rules={NEW_FIELDS} />
        <p className="text-neutral-400">
          Toute modification du contrat change le codec et l&apos;empreinte des
          spéciales en cache : à faire en une fois, avec la story 5.8.
        </p>
      </div>
    </details>
  </section>
);
