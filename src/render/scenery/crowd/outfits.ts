// Copie de `src/app/decor-lab/crowd/outfits.ts` : le labo évolue à part, resynchroniser à la main.
import { PART, partBit } from "./geometry";
import { hash, pick } from "./hash";

// Garde-robe du public : 32 couleurs partagées, chaque instance choisit 4 entrées (peau, haut, bas, tête).
// Les accents reprennent la livrée (crème, marine, rouge brique) et le jaune de marque de la DA.

const SKIN = ["#f1c9a5", "#e0ac85", "#c68a62", "#a0663f", "#7a4a2c", "#f6d8bf"];
const HAIR = ["#241a12", "#5b3b22", "#b38b55", "#8f8f8f"];
const RAIN = ["#d9472b", "#ffd23f", "#2f6fd1", "#2e8a55", "#e2762a"];
const TEAM = ["#1f3a5f", "#efe6d2", "#10161f", "#8a4fd1"];
const CASUAL = ["#6e7b8b", "#b5503a", "#3d5a40"];
const BOTTOM = ["#2c3e5c", "#4a5f86", "#1d1f24", "#b8a27c", "#5b6045"];
const HAT = ["#d9472b", "#1f3a5f", "#ffd23f", "#efe6d2"];
const HIVIS = ["#ff7a1a"];

/** Palette envoyée au shader, dans cet ordre : les indices ci-dessous y renvoient. */
export const CROWD_PALETTE: readonly string[] = [
  ...SKIN,
  ...HAIR,
  ...RAIN,
  ...TEAM,
  ...CASUAL,
  ...BOTTOM,
  ...HAT,
  ...HIVIS,
];

const range = (list: readonly string[]): number[] => {
  const start = CROWD_PALETTE.indexOf(list[0]);
  return list.map((_, i) => start + i);
};

const SKIN_IDS = range(SKIN);
const HAIR_IDS = range(HAIR);
const RAIN_IDS = range(RAIN);
const TEAM_IDS = range(TEAM);
const CASUAL_IDS = range(CASUAL);
const BOTTOM_IDS = range(BOTTOM);
const HAT_IDS = range(HAT);
const HIVIS_IDS = range(HIVIS);

export const WARDROBES = [
  "rain",
  "team",
  "cap",
  "beanie",
  "bare",
  "marshal",
] as const;
export type Wardrobe = (typeof WARDROBES)[number];

export const WARDROBE_LABEL: Record<Wardrobe, string> = {
  rain: "veste de pluie",
  team: "polo d'équipe",
  cap: "casquette",
  beanie: "bonnet",
  bare: "tête nue",
  marshal: "commissaire",
};

/** Ce que reçoit une instance : 4 indices de palette et le masque des pièces facultatives. */
export interface Outfit {
  colors: [number, number, number, number];
  mask: number;
}

/** Tenue tirée de la graine ; sans garde-robe imposée, elle aussi vient de la graine (hors commissaire). */
export const pickOutfit = (seed: number, wardrobe?: Wardrobe): Outfit => {
  const kind = wardrobe ?? pick(WARDROBES.slice(0, 5), seed * 7 + 1);
  const skin = pick(SKIN_IDS, seed * 7 + 2);
  const bottom = pick(BOTTOM_IDS, seed * 7 + 3);
  const hair = pick(HAIR_IDS, seed * 7 + 4);
  const hat = pick(HAT_IDS, seed * 7 + 5);
  const casual = pick(CASUAL_IDS, seed * 7 + 6);
  switch (kind) {
    case "rain":
      return {
        colors: [skin, pick(RAIN_IDS, seed * 7 + 6), bottom, hair],
        mask: partBit(PART.hood),
      };
    case "team": {
      const withCap = hash(seed * 7 + 6) < 0.5;
      return {
        colors: [
          skin,
          pick(TEAM_IDS, seed * 7 + 5),
          bottom,
          withCap ? hat : hair,
        ],
        mask: partBit(PART.band) | partBit(withCap ? PART.cap : PART.hair),
      };
    }
    case "cap":
      return { colors: [skin, casual, bottom, hat], mask: partBit(PART.cap) };
    case "beanie":
      return {
        colors: [skin, pick(RAIN_IDS, seed * 7 + 6), bottom, hat],
        mask: partBit(PART.beanie),
      };
    case "marshal":
      return {
        colors: [skin, HIVIS_IDS[0], BOTTOM_IDS[2], HIVIS_IDS[0]],
        mask: partBit(PART.band) | partBit(PART.cap),
      };
    default:
      return { colors: [skin, casual, bottom, hair], mask: partBit(PART.hair) };
  }
};
