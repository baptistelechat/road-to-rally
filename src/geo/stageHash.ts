import { ribbon } from "../sim/track/ribbon";
import type { MeshData, StageData } from "../sim/types";

type Numbers = Float32Array | Float64Array | Uint32Array;

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
    addBytes(
      new Uint8Array(values.buffer, values.byteOffset, values.byteLength),
    );
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
  return hasher.digest();
};
