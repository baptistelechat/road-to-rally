// Typologie, toit et matériaux d'un bâtiment, déduits des champs BD TOPO et de la géométrie (story 5.2).
// Règles validées dans le labo `decor-lab/buildings` (encadré IgnGuide). Pure : ni hasard, ni horloge.
// Changer un seuil modifie le décor produit : incrémenter `PIPELINE_VERSION`.
import type {
  DecorBuildingType,
  DecorRoofKind,
  DecorRoofMaterial,
  DecorWallMaterial,
} from "../../sim/types";
import type { PlanePoint } from "../gpx";
import {
  churchRoof,
  isCanalDepartment,
  regionalRoof,
  regionalStone,
  roofFromCode,
  wallFromCode,
} from "./roofing";
import type { RawBuilding } from "./types";

/** En dessous, en m² : annexe ou garage */
const ANNEX_MAX_AREA = 30;
/** Murs plus bas que ça : annexe */
const ANNEX_MAX_HEIGHT = 3;
/** Rapport longueur / largeur d'une longère */
const LONGHOUSE_MIN_RATIO = 2.5;
const LONGHOUSE_MAX_HEIGHT = 5;
/** Au-delà, en m² : bâtiment d'activité */
const WORKSHOP_MIN_AREA = 300;
/** Au-delà, en m² : grange plutôt que maison, sans autre indice */
const BARN_MIN_AREA = 400;
/** Logements et niveaux (rez-de-chaussée compris) d'un petit immeuble */
const APARTMENT_MIN_DWELLINGS = 4;
const APARTMENT_MIN_FLOORS = 4;
/** En dessous, en m² : chapelle plutôt qu'église */
const CHAPEL_MAX_AREA = 150;
/** Pavillon de plain-pied en croupe en dessous de ce rapport longueur / largeur */
const HIP_MAX_RATIO = 1.6;
/** En dessous, en m² : monument fin (obélisque) en pointe, plutôt que bloc massif à acrotère */
const MONUMENT_MAX_SMALL_AREA = 20;
/** Dans le Midi à tuile canal, la croupe va jusqu'à ce rapport et à l'étage */
const CANAL_HIP_MAX_RATIO = 2;
/** Écart d'altitude du toit sous lequel il est plat, en mètres… */
const FLAT_ROOF_SPREAD = 0.5;
/** …sur une emprise d'au moins tant de m² : une petite emprise mal mesurée garde son toit */
const FLAT_ROOF_MIN_AREA = 150;
/** Écart au-dessus duquel un bâtiment d'activité ou un immeuble a un vrai toit à pentes */
const PITCHED_ROOF_SPREAD = 1.5;

export interface TypologyInput {
  raw: RawBuilding;
  ring: PlanePoint[];
  /** Surface de l'emprise, positive */
  area: number;
  /** Hauteur des murs lue dans les données, avant l'enterrement dans la pente */
  wallHeight: number;
  floors: number;
  hasParty: boolean;
  department: string | null;
}

export interface Typology {
  type: DecorBuildingType;
  roof: DecorRoofKind;
  roofMaterial: DecorRoofMaterial;
  wallMaterial: DecorWallMaterial;
}

/** Sans accents ni casse : « Église », « eglise » et « EGLISE » se valent. */
const normalize = (value: string | null): string =>
  value === null
    ? ""
    : value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Longueur sur largeur du rectangle englobant le plus serré, aligné sur un mur. */
const elongation = (ring: PlanePoint[]): number => {
  let best = Infinity;
  let ratio = 1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-6) continue;
    const ux = (b.x - a.x) / length;
    const uz = (b.z - a.z) / length;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of ring) {
      const u = p.x * ux + p.z * uz;
      const v = p.z * ux - p.x * uz;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const w = maxU - minU;
    const h = maxV - minV;
    // Inégalité stricte : à égalité, le premier mur, pour un résultat fixe.
    if (w * h < best) {
      best = w * h;
      ratio = Math.max(w, h) / Math.max(Math.min(w, h), 1e-6);
    }
  }
  return ratio;
};

/** Convexe à quelques degrés près, dans un sens de parcours ou dans l'autre. */
const isConvex = (ring: PlanePoint[]): boolean => {
  let positive = false;
  let negative = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const c = ring[(i + 2) % ring.length];
    const l1 = Math.hypot(b.x - a.x, b.z - a.z);
    const l2 = Math.hypot(c.x - b.x, c.z - b.z);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const cross =
      ((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)) / (l1 * l2);
    if (cross > 0.03) positive = true;
    if (cross < -0.03) negative = true;
  }
  return !(positive && negative);
};

/** 1. La nature tranche les cas rares et sûrs. `null` : départager par l'usage. */
const typeByNature = (nature: string): DecorBuildingType | null => {
  if (nature === "eglise") return "church";
  if (nature === "chapelle") return "chapel";
  // Un château se rend en grande maison de bourg isolée, ardoise et croupe.
  if (nature === "chateau") return "townHouse";
  if (
    nature.startsWith("tour") ||
    nature.includes("donjon") ||
    nature.includes("moulin") ||
    nature.includes("phare")
  )
    return "tower";
  if (nature === "silo") return "silo";
  if (nature === "serre") return "greenhouse";
  if (
    nature.includes("monument") ||
    nature.includes("arc de triomphe") ||
    nature.includes("fort") ||
    nature.includes("arene") ||
    nature.includes("tribune")
  )
    return "monument";
  return null;
};

/** 2. L'usage et la géométrie, dans l'ordre du labo. */
const typeByUsage = (
  input: TypologyInput,
  ratio: number,
): DecorBuildingType => {
  const { raw, area, wallHeight, floors, hasParty } = input;
  const usage1 = normalize(raw.usage);
  const usage =
    usage1 === "" || usage1 === "indifferencie"
      ? normalize(raw.usage2)
      : usage1;
  const nature = normalize(raw.nature);
  const residential = usage === "residentiel";
  const agricultural = usage === "agricole";
  const commercial = usage === "commercial et services";
  const industrial = usage === "industriel";
  const unknown =
    usage === "" || usage === "indifferencie" || usage === "annexe";

  if (
    usage1 === "annexe" ||
    area < ANNEX_MAX_AREA ||
    wallHeight < ANNEX_MAX_HEIGHT
  )
    return "annex";
  if (usage === "religieux")
    return area < CHAPEL_MAX_AREA ? "chapel" : "church";
  if (raw.light) return agricultural || unknown ? "hangar" : "annex";

  const bourg = hasParty && floors >= 2 && floors < APARTMENT_MIN_FLOORS + 1;
  if ((residential || unknown) && bourg) return "townHouse";
  // Une grande surface mitoyenne reste un bâtiment d'activité : pas de maison de bourg à vitrine de 40 m.
  if (commercial && hasParty && area <= WORKSHOP_MIN_AREA) return "shop";
  if (
    residential &&
    ((raw.dwellings ?? 0) >= APARTMENT_MIN_DWELLINGS ||
      floors >= APARTMENT_MIN_FLOORS)
  )
    return "apartment";
  if (
    (residential || agricultural || unknown) &&
    ratio >= LONGHOUSE_MIN_RATIO &&
    wallHeight <= LONGHOUSE_MAX_HEIGHT
  )
    return "longhouse";
  if (residential) return "house";
  if (agricultural) return "barn";
  if (industrial || usage === "sportif") return "workshop";
  if (commercial) return area > WORKSHOP_MIN_AREA ? "workshop" : "house";
  // Sans usage : la nature générique, puis la taille.
  if (nature.startsWith("industriel")) return "barn";
  return area > BARN_MIN_AREA ? "barn" : "house";
};

/** Toit voulu par la typologie, avant les corrections par les données. */
const roofByType = (
  type: DecorBuildingType,
  input: TypologyInput,
  ratio: number,
  canal: boolean,
): DecorRoofKind => {
  switch (type) {
    case "house":
      if (canal && ratio < CANAL_HIP_MAX_RATIO) return "hip";
      return input.floors <= 1 && ratio < HIP_MAX_RATIO ? "hip" : "gable";
    case "townHouse":
      // Château isolé : croupe ; maison de bourg mitoyenne : pignons sur les voisins.
      return input.hasParty ? "gable" : "hip";
    case "workshop":
    case "apartment":
      return "parapet";
    case "annex":
      // Adossée à un voisin : appentis ; seule : remise à deux pans.
      return input.hasParty ? "shed" : "gable";
    case "silo":
    case "tower":
      return "hip";
    case "monument":
      return input.area < MONUMENT_MAX_SMALL_AREA ? "hip" : "parapet";
    default:
      return "gable";
  }
};

const MATERIAL_BY_TYPE: Partial<Record<DecorBuildingType, DecorRoofMaterial>> =
  {
    barn: "metal",
    hangar: "metal",
    silo: "metal",
    greenhouse: "glass",
    monument: "stone",
  };

const WALL_BY_TYPE: Partial<Record<DecorBuildingType, DecorWallMaterial>> = {
  house: "render",
  townHouse: "render",
  shop: "render",
  apartment: "render",
  annex: "render",
  barn: "wood",
  hangar: "wood",
  workshop: "metal",
  silo: "metal",
  greenhouse: "glass",
};

/** Typologie, toit et matériaux. Mêmes entrées, même résultat. */
export const resolveTypology = (input: TypologyInput): Typology => {
  const { raw, department, area } = input;
  const ratio = elongation(input.ring);
  const canal = isCanalDepartment(department);
  const type = typeByNature(normalize(raw.nature)) ?? typeByUsage(input, ratio);

  let roof = roofByType(type, input, ratio, canal);
  const spread =
    raw.roofMin !== null && raw.roofMax !== null
      ? raw.roofMax - raw.roofMin
      : null;
  const pitchedOnly =
    type === "church" ||
    type === "chapel" ||
    type === "tower" ||
    type === "silo" ||
    type === "greenhouse";
  // Les altitudes du toit se confondent sur une grande emprise : toit plat, quelle que soit la typologie.
  if (
    !pitchedOnly &&
    spread !== null &&
    spread < FLAT_ROOF_SPREAD &&
    area >= FLAT_ROOF_MIN_AREA
  )
    roof = type === "workshop" || type === "apartment" ? "parapet" : "flat";
  // Un bâtiment d'activité ou un immeuble au toit nettement incliné garde ses pentes.
  if (roof === "parapet" && spread !== null && spread > PITCHED_ROOF_SPREAD)
    roof = type === "apartment" ? "hip" : "gable";

  const coded = roofFromCode(raw.roofMaterial, department);
  // Une terrasse en béton est plate ; une croupe impossible retombe en pignon (le rendu peut encore aller jusqu'au plat).
  if (coded === "membrane" && !pitchedOnly && roof !== "parapet") roof = "flat";
  if (roof === "hip" && !isConvex(input.ring)) roof = "gable";

  const roofMaterial: DecorRoofMaterial =
    roof === "flat" || roof === "parapet"
      ? type === "monument"
        ? "stone"
        : "membrane"
      : ((coded !== null && coded !== "membrane" && type !== "greenhouse"
          ? coded
          : null) ??
        MATERIAL_BY_TYPE[type] ??
        (type === "church" || type === "chapel" || type === "tower"
          ? churchRoof(department)
          : type === "workshop"
            ? "metal"
            : regionalRoof(department)));

  const codedWall = wallFromCode(raw.wallMaterial, department);
  const fixedWall =
    type === "workshop" ||
    type === "silo" ||
    type === "greenhouse" ||
    type === "hangar";
  const wallMaterial: DecorWallMaterial =
    (!fixedWall ? codedWall : null) ??
    WALL_BY_TYPE[type] ??
    regionalStone(department);
  return { type, roof, roofMaterial, wallMaterial };
};
