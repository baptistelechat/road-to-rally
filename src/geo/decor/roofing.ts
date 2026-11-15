// Toitures et parements régionaux (story 5.2). Changer une liste modifie le décor produit : incrémenter `PIPELINE_VERSION`.
import type { DecorRoofMaterial, DecorWallMaterial } from "../../sim/types";

/** Ardoise traditionnelle, par code INSEE de département */
const SLATE_DEPARTMENTS = new Set([
  // Bretagne
  "22",
  "29",
  "35",
  "56",
  // Ouest de la Normandie
  "14",
  "50",
  "61",
  // Anjou, Touraine, Maine
  "37",
  "49",
  "53",
  "72",
  // Ardennes
  "08",
  // Limousin et nord de l'Auvergne
  "15",
  "19",
  "23",
  "63",
  "87",
  // Alpes du Nord
  "73",
  "74",
]);

/** Tuile canal (ou romane), toits à faible pente, croupes fréquentes */
const CANAL_DEPARTMENTS = new Set([
  // Provence et Côte d'Azur (les Hautes-Alpes, montagnardes, en sont exclues)
  "04",
  "06",
  "13",
  "83",
  "84",
  // Vallée du Rhône méridionale
  "07",
  "26",
  // Languedoc et Roussillon (la Lozère, en lauze et ardoise, en est exclue)
  "11",
  "30",
  "34",
  "66",
  // Midi toulousain, Gascogne, Quercy
  "09",
  "31",
  "32",
  "46",
  "65",
  "81",
  "82",
  // Aquitaine et Périgord
  "24",
  "33",
  "40",
  "47",
  "64",
  // Charentes, Poitou et Vendée : la tuile « tige de botte »
  "16",
  "17",
  "79",
  "85",
  "86",
  // Corse
  "2A",
  "2B",
]);

/** Pierre grise de granit plutôt que calcaire ocre */
const GRANITE_DEPARTMENTS = new Set([
  "22",
  "29",
  "35",
  "56",
  "50",
  "19",
  "23",
  "87",
]);

export const isCanalDepartment = (department: string | null): boolean =>
  department !== null && CANAL_DEPARTMENTS.has(department);

/** Couverture traditionnelle du département : ardoise, tuile canal, sinon tuile plate. */
export const regionalRoof = (department: string | null): DecorRoofMaterial =>
  department === null
    ? "tile"
    : SLATE_DEPARTMENTS.has(department)
      ? "slate"
      : CANAL_DEPARTMENTS.has(department)
        ? "canal"
        : "tile";

/** Une église est couverte d'ardoise presque partout, sauf dans le Midi à tuile canal. */
export const churchRoof = (department: string | null): DecorRoofMaterial =>
  isCanalDepartment(department) ? "canal" : "slate";

export const regionalStone = (department: string | null): DecorWallMaterial =>
  department !== null && GRANITE_DEPARTMENTS.has(department)
    ? "granite"
    : "stone";

/** Premier chiffre non nul d'un code des fichiers fonciers : « 12 » (tuiles et ardoises) donne 1, « 01 » aussi. */
const primaryCode = (code: string | null): number | null => {
  if (code === null) return null;
  for (const char of code) {
    if (char >= "1" && char <= "9") return Number(char);
    if (char !== "0") return null;
  }
  return null;
};

/** `materiaux_de_la_toiture` : 1 tuiles, 2 ardoises, 3 zinc ou aluminium, 4 béton (terrasse). `null` si inconnu. */
export const roofFromCode = (
  code: string | null,
  department: string | null,
): DecorRoofMaterial | null => {
  switch (primaryCode(code)) {
    case 1:
      return isCanalDepartment(department) ? "canal" : "tile";
    case 2:
      return "slate";
    case 3:
      return "metal";
    case 4:
      return "membrane";
    default:
      return null;
  }
};

/** `materiaux_des_murs` : 1 pierre, 2 meulière, 3 béton, 4 briques, 5 aggloméré, 6 bois. `null` si inconnu. */
export const wallFromCode = (
  code: string | null,
  department: string | null,
): DecorWallMaterial | null => {
  switch (primaryCode(code)) {
    case 1:
    case 2:
      return regionalStone(department);
    // Béton et parpaing sont presque toujours enduits.
    case 3:
    case 5:
      return "render";
    case 4:
      return "brick";
    case 6:
      return "wood";
    default:
      return null;
  }
};
