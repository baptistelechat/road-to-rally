import { ribbon } from "../sim/track/ribbon";
import {
  DECOR_BUILDING_TYPES,
  DECOR_ROOF_KINDS,
  DECOR_ROOF_MATERIALS,
  DECOR_TREE_KINDS,
  DECOR_WALL_MATERIALS,
  type DecorBuildingKind,
  type MeshData,
  type StageData,
} from "../sim/types";

type Numbers = Float32Array | Float64Array | Uint32Array;

/** Rang de l'usage dans l'empreinte : ne jamais réordonner, seulement ajouter à la fin */
const BUILDING_KINDS: readonly DecorBuildingKind[] = [
  "house",
  "farm",
  "industrial",
  "church",
  "other",
];

// ponytail: octets dans l'ordre de la machine, petit-boutiste sur tous les navigateurs visés.
/** cyrb53 sur des octets : détecte une spéciale différente, pas une attaque. */
const createHasher = () => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const addBytes = (bytes: Uint8Array): void => {
    for (let i = 0; i < bytes.length; i++) {
      h1 = Math.imul(h1 ^ bytes[i], 2654435761);
      h2 = Math.imul(h2 ^ bytes[i], 1597334677);
    }
  };
  /** La longueur d'abord : deux découpes d'une même suite d'octets ne se confondent pas. */
  const add = (values: Numbers): void => {
    addBytes(new Uint8Array(new Float64Array([values.length]).buffer));
    // -0 s'écrit 0 en JSON mais pas en octets : sans ça, une spéciale relue de son fichier change d'empreinte.
    const bytes =
      values instanceof Uint32Array
        ? values
        : (values as Float64Array).map((value) => value + 0);
    addBytes(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  };
  const digest = (): string => {
    const a =
      Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
      Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    const b =
      Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
      Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return [b, a]
      .map((part) => (part >>> 0).toString(16).padStart(8, "0"))
      .join("");
  };
  return { add, addBytes, digest };
};

const addMesh = (
  hasher: ReturnType<typeof createHasher>,
  mesh: MeshData | null,
): void => {
  hasher.add(mesh?.positions ?? new Float32Array());
  hasher.add(mesh?.indices ?? new Uint32Array());
};

/** Empreinte du tracé brut, pour la clé du cache. */
export const hashText = (text: string): string => {
  const hasher = createHasher();
  hasher.addBytes(new TextEncoder().encode(text));
  return hasher.digest();
};

/** Même spéciale, même empreinte, sur toutes les machines. `generatedAt` et `hash` n'en font pas partie. */
export const stageHash = (stage: StageData): string => {
  const hasher = createHasher();
  hasher.add(new Float64Array([stage.pipelineVersion]));
  hasher.add(new Float64Array(stage.points.flatMap((p) => [p.x, p.y, p.z])));
  hasher.add(new Float64Array(stage.widths));
  addMesh(hasher, ribbon(stage.points, stage.widths, false));
  addMesh(hasher, stage.terrain);
  // Sans pont, rien n'est ajouté : les empreintes déjà publiées ne bougent pas.
  if (stage.bridges)
    hasher.add(
      new Float64Array(
        stage.bridges.flatMap((bridge) => [
          bridge.from,
          bridge.to,
          ["stone", "concrete", "steel", "viaduct"].indexOf(bridge.style),
          bridge.halfWidth,
        ]),
      ),
    );
  // Sans tunnel, rien n'est ajouté : les empreintes déjà publiées ne bougent pas.
  for (const tunnel of stage.tunnels ?? []) {
    hasher.add(new Float64Array([tunnel.from, tunnel.to, tunnel.halfWidth]));
    addMesh(hasher, tunnel.roof ?? null);
  }
  // Sans chicane, rien n'est ajouté : les empreintes déjà publiées ne bougent pas.
  if (stage.lanes) hasher.add(new Float64Array(stage.lanes));
  if (stage.islands)
    hasher.add(
      new Float64Array(
        stage.islands.flatMap((island) => [
          island.position.x,
          island.position.y,
          island.position.z,
          island.radius,
          island.height,
          island.skirt,
        ]),
      ),
    );
  if (stage.obstacles)
    hasher.add(
      new Float64Array(
        stage.obstacles.flatMap((block) => [
          block.s,
          block.side === "left" ? 0 : 1,
          block.lateral,
          block.span,
          block.passage,
          block.depth,
          block.height,
          block.skirt,
          block.position.x,
          block.position.y,
          block.position.z,
          block.yaw,
        ]),
      ),
    );
  // Sans décor, rien n'est ajouté : une spéciale sans données de décor garde son empreinte.
  if (stage.decor) {
    const { buildings, trees, water } = stage.decor;
    // Le nombre de points précède chaque contour : deux découpes différentes ne se confondent pas.
    hasher.add(
      new Float64Array(
        buildings.flatMap((building) => [
          building.footprint.length,
          ...building.footprint.flatMap((p) => [p.x, p.z]),
          building.base,
          building.height,
          BUILDING_KINDS.indexOf(building.kind),
          // Typologie de la story 5.2 : rangs dans les listes de `types.ts`, puis les murs mitoyens précédés de leur nombre.
          DECOR_BUILDING_TYPES.indexOf(building.type),
          building.floors,
          DECOR_ROOF_KINDS.indexOf(building.roof),
          DECOR_ROOF_MATERIALS.indexOf(building.roofMaterial),
          DECOR_WALL_MATERIALS.indexOf(building.wallMaterial),
          building.party.length,
          ...building.party,
          building.street,
        ]),
      ),
    );
    hasher.add(
      new Float64Array(
        trees.flatMap((tree) => [
          // Rang dans `DECOR_TREE_KINDS` : tree 0 et pine 1, comme avant
          DECOR_TREE_KINDS.indexOf(tree.kind),
          tree.position.x,
          tree.position.y,
          tree.position.z,
          tree.yaw,
          tree.scale,
        ]),
      ),
    );
    hasher.add(
      new Float64Array(
        water.flatMap((surface) => [
          surface.outline.length,
          ...surface.outline.flatMap((p) => [p.x, p.z]),
          surface.y,
          // Îles : leur nombre, puis chacune précédée de son nombre de points.
          surface.holes?.length ?? 0,
          ...(surface.holes ?? []).flatMap((hole) => [
            hole.length,
            ...hole.flatMap((p) => [p.x, p.z]),
          ]),
        ]),
      ),
    );
  }
  return hasher.digest();
};
