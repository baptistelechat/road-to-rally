// Icônes des commandes, par appareil. Source unique de `pnpm icons:sync`, qui copie ces SVG
// depuis `assets-src/kenney-input/` vers `public/input/`. Aucun import : le script le lit dans Node.

export const PROMPT_DEVICES = ["keyboard", "xbox", "playstation"] as const;
export type PromptDevice = (typeof PROMPT_DEVICES)[number];

/** Dossier du pack Kenney, relatif à `assets-src/kenney-input/` */
export const ICON_SOURCES: Record<PromptDevice, string> = {
  keyboard: "Keyboard & Mouse",
  xbox: "Xbox Series",
  playstation: "PlayStation Series",
};

export type KeyboardLayout = "azerty" | "qwerty";

/** Icônes affichées côte à côte ; plusieurs groupes sont des alternatives, séparées par « / ». */
export type IconGroups = readonly (readonly string[])[];

interface LayoutIcons {
  azerty: IconGroups;
  qwerty: IconGroups;
}

/** Une liste vide : l'action n'existe pas sur cet appareil, sa ligne d'aide disparaît. */
interface Prompt {
  keyboard: IconGroups | LayoutIcons;
  xbox: IconGroups;
  playstation: IconGroups;
}

export const INPUT_PROMPTS = {
  // Course
  steer: {
    keyboard: {
      azerty: [["keyboard_arrows_horizontal"], ["keyboard_q", "keyboard_d"]],
      qwerty: [["keyboard_arrows_horizontal"], ["keyboard_a", "keyboard_d"]],
    },
    xbox: [["xbox_stick_l_horizontal"]],
    playstation: [["playstation_stick_l_horizontal"]],
  },
  pedals: {
    keyboard: {
      azerty: [["keyboard_arrows_vertical"], ["keyboard_z", "keyboard_s"]],
      qwerty: [["keyboard_arrows_vertical"], ["keyboard_w", "keyboard_s"]],
    },
    xbox: [["xbox_rt", "xbox_lt"]],
    playstation: [["playstation_trigger_r2", "playstation_trigger_l2"]],
  },
  handbrake: {
    keyboard: [["keyboard_space"]],
    xbox: [["xbox_button_color_a"]],
    playstation: [["playstation_button_color_cross"]],
  },
  respawn: {
    keyboard: [["keyboard_r"]],
    xbox: [["xbox_button_color_y"]],
    playstation: [["playstation_button_color_triangle"]],
  },
  restart: {
    keyboard: [["keyboard_backspace"]],
    xbox: [["xbox_button_view"]],
    playstation: [["playstation5_button_create"]],
  },
  camera: {
    keyboard: [["keyboard_c"]],
    xbox: [["xbox_button_color_x"]],
    playstation: [["playstation_button_color_square"]],
  },
  lookAround: {
    keyboard: [],
    xbox: [["xbox_stick_r"]],
    playstation: [["playstation_stick_r"]],
  },
  mute: {
    keyboard: [["keyboard_m"]],
    xbox: [],
    playstation: [],
  },
  pause: {
    keyboard: [["keyboard_escape"]],
    xbox: [["xbox_button_menu"]],
    playstation: [["playstation5_button_options"]],
  },
  // Menus et garage
  navigate: {
    keyboard: [["keyboard_arrows_all"]],
    xbox: [["xbox_dpad"], ["xbox_stick_l"]],
    playstation: [["playstation_dpad"], ["playstation_stick_l"]],
  },
  confirm: {
    keyboard: [["keyboard_enter"]],
    xbox: [["xbox_button_color_a"]],
    playstation: [["playstation_button_color_cross"]],
  },
  cancel: {
    keyboard: [["keyboard_escape"]],
    xbox: [["xbox_button_color_b"]],
    playstation: [["playstation_button_color_circle"]],
  },
  orbit: {
    keyboard: [["mouse_left"]],
    xbox: [["xbox_stick_r"]],
    playstation: [["playstation_stick_r"]],
  },
  zoom: {
    keyboard: [["mouse_scroll_vertical"]],
    xbox: [["xbox_rt", "xbox_lt"]],
    playstation: [["playstation_trigger_r2", "playstation_trigger_l2"]],
  },
} as const satisfies Record<string, Prompt>;

export type PromptAction = keyof typeof INPUT_PROMPTS;

const isLayoutIcons = (icons: IconGroups | LayoutIcons): icons is LayoutIcons =>
  !Array.isArray(icons);

export const promptIcons = (
  action: PromptAction,
  device: PromptDevice,
  layout: KeyboardLayout,
): IconGroups => {
  const icons: IconGroups | LayoutIcons = INPUT_PROMPTS[action][device];
  return isLayoutIcons(icons) ? icons[layout] : icons;
};

/** Toutes les icônes d'un appareil, dispositions de clavier comprises, sans doublon */
export const iconsOf = (device: PromptDevice): string[] => {
  const names = new Set<string>();
  for (const prompt of Object.values(INPUT_PROMPTS)) {
    const icons: IconGroups | LayoutIcons = prompt[device];
    const variants = isLayoutIcons(icons)
      ? [icons.azerty, icons.qwerty]
      : [icons];
    for (const groups of variants)
      for (const group of groups) for (const name of group) names.add(name);
  }
  return [...names].sort();
};

export const iconUrl = (device: PromptDevice, name: string): string =>
  `/input/${device}/${name}.svg`;

// Noms lus par les lecteurs d'écran, d'après la fin du nom de fichier Kenney.
const SPOKEN: Record<string, string> = {
  arrows_horizontal: "Flèches gauche et droite",
  arrows_vertical: "Flèches haut et bas",
  arrows_all: "Flèches",
  space: "Espace",
  backspace: "Retour arrière",
  escape: "Échap",
  enter: "Entrée",
  left: "Clic gauche",
  scroll_vertical: "Molette",
  dpad: "Croix directionnelle",
  stick_l: "Stick gauche",
  stick_l_horizontal: "Stick gauche",
  stick_r: "Stick droit",
  view: "View",
  menu: "Menu",
  create: "Create",
  options: "Options",
  cross: "Croix",
  circle: "Rond",
  square: "Carré",
  triangle: "Triangle",
};

export const iconLabel = (name: string): string => {
  const suffix = name
    .replace(/^(keyboard|mouse|xbox|playstation\d?)_/, "")
    .replace(/^(button_color|button|trigger)_/, "");
  return SPOKEN[suffix] ?? suffix.toUpperCase();
};
