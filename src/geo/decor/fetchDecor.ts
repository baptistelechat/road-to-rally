// Récupération du décor sur le WFS de la Géoplateforme IGN, une fois, à la création de la spéciale (story 5.8).
// Une requête à la fois, une par seconde au plus : c'est la limite du service.
import { StageError } from "../errors";
import {
  project,
  uniqueAxis,
  unproject,
  type LatLon,
  type PlanePoint,
  type TracePoints,
} from "../gpx";
import {
  requestText,
  throwIfAborted,
  type HttpOptions,
  type RetryPolicy,
} from "../http";
import {
  DECOR_CELL_SIZE,
  DECOR_CHUNK_LENGTH,
  DECOR_HALF_WIDTH,
  DECOR_TIME_BUDGET,
  WFS_FIELDS_TIMEOUT,
  WFS_LAYERS,
  WFS_MAX_PAGES,
  WFS_MAX_RETRIES,
  WFS_DEPARTMENT_BOX,
  WFS_DEPARTMENT_LAYER,
  WFS_DEPARTMENT_PROPERTY,
  WFS_MIN_INTERVAL,
  WFS_PAGE_SIZE,
  WFS_PROPERTIES,
  WFS_RETRY_DELAY,
  WFS_TIMEOUT,
  WFS_URL,
} from "./config";
import type {
  DecorInputs,
  RawArea,
  RawBuilding,
  RawLine,
  Rings,
} from "./types";

type Layer = keyof typeof WFS_LAYERS;

/** Un objet WFS dont on a seulement vérifié l'identifiant : la géométrie est lue par couche */
interface WfsFeature {
  id: string;
  geometry: unknown;
  properties: Record<string, unknown>;
}

interface WfsPage {
  features: WfsFeature[];
  /** Objets dans la réponse, valides ou non : sert à la pagination */
  returned: number;
  /** `numberMatched`, `null` si le service ne le donne pas */
  matched: number | null;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Tout ce qui n'a pas la forme attendue est écarté. `null` si la réponse est inutilisable. */
export const parseWfs = (body: string): WfsPage | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isObject(parsed) || !Array.isArray(parsed.features)) return null;
  const features: WfsFeature[] = [];
  for (const feature of parsed.features as unknown[]) {
    if (!isObject(feature)) continue;
    const properties = isObject(feature.properties) ? feature.properties : {};
    // `cleabs` pour la BD TOPO, l'identifiant de l'objet WFS pour le RPG qui n'en a pas.
    const id =
      typeof properties.cleabs === "string"
        ? properties.cleabs
        : typeof feature.id === "string" || typeof feature.id === "number"
          ? String(feature.id)
          : null;
    if (id) features.push({ id, geometry: feature.geometry, properties });
  }
  const matched = parsed.numberMatched;
  return {
    features,
    returned: parsed.features.length,
    matched:
      typeof matched === "number" && Number.isFinite(matched) ? matched : null,
  };
};

// --- Géométries ---

/** Le WFS renvoie parfois `[lon, lat, z]` : seules les deux premières valeurs comptent. */
const toLatLon = (value: unknown): LatLon | null =>
  Array.isArray(value) &&
  typeof value[0] === "number" &&
  typeof value[1] === "number" &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1])
    ? { lat: value[1], lon: value[0] }
    : null;

/** Sans point répété ; un contour fermé perd aussi son point de fermeture. */
const toPoints = (value: unknown, closed: boolean): LatLon[] => {
  if (!Array.isArray(value)) return [];
  const points: LatLon[] = [];
  for (const raw of value as unknown[]) {
    const point = toLatLon(raw);
    const last = points[points.length - 1];
    if (point && !(last && last.lat === point.lat && last.lon === point.lon))
      points.push(point);
  }
  while (
    closed &&
    points.length > 1 &&
    points[0].lat === points[points.length - 1].lat &&
    points[0].lon === points[points.length - 1].lon
  )
    points.pop();
  return points;
};

/** Un contour extérieur inutilisable écarte le polygone, un trou inutilisable est seulement oublié. */
const toRings = (value: unknown): Rings | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rings = (value as unknown[]).map((ring) => toPoints(ring, true));
  if (rings[0].length < 3) return null;
  return [rings[0], ...rings.slice(1).filter((ring) => ring.length >= 3)];
};

const toPolygons = (geometry: unknown): Rings[] => {
  if (!isObject(geometry)) return [];
  if (geometry.type === "Polygon") {
    const rings = toRings(geometry.coordinates);
    return rings ? [rings] : [];
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates))
    return (geometry.coordinates as unknown[]).flatMap((polygon) => {
      const rings = toRings(polygon);
      return rings ? [rings] : [];
    });
  return [];
};

const toLines = (geometry: unknown): LatLon[][] => {
  if (!isObject(geometry)) return [];
  const lines =
    geometry.type === "LineString"
      ? [geometry.coordinates]
      : geometry.type === "MultiLineString" &&
          Array.isArray(geometry.coordinates)
        ? (geometry.coordinates as unknown[])
        : [];
  return lines
    .map((line) => toPoints(line, false))
    .filter((line) => line.length >= 2);
};

const hasGeometry = (feature: WfsFeature): boolean =>
  isObject(feature.geometry) && Array.isArray(feature.geometry.coordinates);

// --- Couloir ---

const cellKey = (i: number, j: number): string => `${i},${j}`;

/** Mailles touchées par le couloir : un point d'axe tous les 25 m suffit, la marge couvre l'écart. */
const corridorCells = (axis: PlanePoint[]): Set<string> => {
  const cells = new Set<string>();
  const stride = 12;
  const reach = DECOR_HALF_WIDTH + stride * 2;
  for (let k = 0; k < axis.length; k += stride) {
    const { x, z } = axis[k];
    const i0 = Math.floor((x - reach) / DECOR_CELL_SIZE);
    const i1 = Math.floor((x + reach) / DECOR_CELL_SIZE);
    const j0 = Math.floor((z - reach) / DECOR_CELL_SIZE);
    const j1 = Math.floor((z + reach) / DECOR_CELL_SIZE);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) cells.add(cellKey(i, j));
  }
  const { x, z } = axis[axis.length - 1];
  cells.add(
    cellKey(Math.floor(x / DECOR_CELL_SIZE), Math.floor(z / DECOR_CELL_SIZE)),
  );
  return cells;
};

/** Vrai si l'emprise de l'objet touche une maille du couloir : une grande forêt sans sommet proche est gardée. */
const touchesCorridor = (
  points: LatLon[],
  origin: LatLon,
  cells: Set<string>,
): boolean => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    const { x, z } = project(point, origin);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const i0 = Math.floor(minX / DECOR_CELL_SIZE);
  const i1 = Math.floor(maxX / DECOR_CELL_SIZE);
  const j0 = Math.floor(minZ / DECOR_CELL_SIZE);
  const j1 = Math.floor(maxZ / DECOR_CELL_SIZE);
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) if (cells.has(cellKey(i, j))) return true;
  return false;
};

/**
 * Une boîte `ouest,sud,est,nord` par tronçon de `DECOR_CHUNK_LENGTH` m d'axe, élargie du couloir.
 * Ordre longitude, latitude, vérifié le 15/11. Les boîtes se recouvrent un peu : le dédoublonnage s'en charge.
 */
const chunkBoxes = (axis: PlanePoint[], origin: LatLon): string[] => {
  const boxes: string[] = [];
  let start = 0;
  let length = 0;
  for (let i = 1; i < axis.length; i++) {
    length += Math.hypot(axis[i].x - axis[i - 1].x, axis[i].z - axis[i - 1].z);
    if (length < DECOR_CHUNK_LENGTH && i < axis.length - 1) continue;
    const chunk = axis.slice(start, i + 1);
    const xs = chunk.map((p) => p.x);
    const zs = chunk.map((p) => p.z);
    // z vers le sud : le plus grand z donne le sud.
    const southWest = unproject(
      {
        x: Math.min(...xs) - DECOR_HALF_WIDTH,
        z: Math.max(...zs) + DECOR_HALF_WIDTH,
      },
      origin,
    );
    const northEast = unproject(
      {
        x: Math.max(...xs) + DECOR_HALF_WIDTH,
        z: Math.min(...zs) - DECOR_HALF_WIDTH,
      },
      origin,
    );
    boxes.push(
      [southWest.lon, southWest.lat, northEast.lon, northEast.lat]
        .map((v) => v.toFixed(6))
        .join(","),
    );
    start = i;
    length = 0;
  }
  return boxes;
};

// --- Conversion par couche ---

const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const textOrEmpty = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";

/** Texte non vide, sinon `null` ; un code numérique (« 1 » rendu en nombre) redevient texte. */
const textOrNull = (value: unknown): string | null => {
  const text = textOrEmpty(value).trim();
  return text === "" ? null : text;
};

const toBuilding = (feature: WfsFeature): RawBuilding | null => {
  const polygons = toPolygons(feature.geometry);
  if (polygons.length === 0) return null;
  const p = feature.properties;
  const height = finiteOrNull(p.hauteur);
  const floors = finiteOrNull(p.nombre_d_etages);
  const dwellings = finiteOrNull(p.nombre_de_logements);
  return {
    id: feature.id,
    polygons,
    height: height !== null && height > 0 ? height : null,
    floors: floors !== null && floors >= 0 ? floors : null,
    usage: typeof p.usage_1 === "string" && p.usage_1 !== "" ? p.usage_1 : null,
    light: p.construction_legere === true,
    nature: textOrNull(p.nature),
    usage2: textOrNull(p.usage_2),
    dwellings: dwellings !== null && dwellings >= 0 ? dwellings : null,
    roofMin: finiteOrNull(p.altitude_minimale_toit),
    roofMax: finiteOrNull(p.altitude_maximale_toit),
    roofMaterial: textOrNull(p.materiaux_de_la_toiture),
    wallMaterial: textOrNull(p.materiaux_des_murs),
  };
};

/** `nature` pour la BD TOPO, `code_group` pour une parcelle ; absent : texte vide, l'objet reste une surface. */
const toArea = (feature: WfsFeature, field: string): RawArea | null => {
  const polygons = toPolygons(feature.geometry);
  if (polygons.length === 0) return null;
  return {
    id: feature.id,
    polygons,
    nature: textOrEmpty(feature.properties[field]),
  };
};

/** Une haie en plusieurs morceaux garde un identifiant stable par morceau. */
const toHedges = (feature: WfsFeature): RawLine[] =>
  toLines(feature.geometry).map((line, k) => ({
    id: k === 0 ? feature.id : `${feature.id}#${k}`,
    line,
  }));

const outerPoints = (polygons: Rings[]): LatLon[] =>
  polygons.flatMap((rings) => rings[0]);

/** Tri par identifiant, en comparant les codes : le même ordre sur toutes les machines, quelle que soit la langue. */
const byId = <T extends { id: string }>(items: Map<string, T>): T[] =>
  [...items.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// --- Réseau ---

const pause = (milliseconds: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new StageError("aborted", "Génération annulée."));
      },
      { once: true },
    );
  });

const SERVICE = "Le service de décor de l'IGN";

const wfsUrl = (
  layer: Layer,
  bbox: string,
  startIndex: number,
  withProperties: boolean,
): string => {
  const params = new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: WFS_LAYERS[layer],
    SRSNAME: "EPSG:4326",
    OUTPUTFORMAT: "application/json",
    BBOX: `${bbox},EPSG:4326`,
    COUNT: String(WFS_PAGE_SIZE),
    STARTINDEX: String(startIndex),
  });
  if (withProperties) params.set("PROPERTYNAME", WFS_PROPERTIES[layer]);
  return `${WFS_URL}?${params.toString()}`;
};

/**
 * Données du décor autour du tracé.
 * `null` si la Géoplateforme ne répond pas : la génération continue avec le décor procédural. Seule une annulation remonte.
 * Les parcelles (RPG, lentes) peuvent manquer seules : le reste est gardé avec `fields: []`.
 */
export const fetchDecor = async (
  trace: TracePoints,
  options: HttpOptions,
): Promise<DecorInputs | null> => {
  const { signal } = options;
  const sleep = options.sleep ?? pause;
  const axis = uniqueAxis(trace);
  if (axis.length < 2) return null;
  const boxes = chunkBoxes(axis, trace.origin);
  const cells = corridorCells(axis);
  const startedAt = Date.now();
  let lastRequest = -Infinity;
  /** Dernier code HTTP en erreur de la requête en cours, 0 sans réponse */
  let lastStatus = 0;
  /** Couches dont le service a refusé la liste de champs : elles sont demandées en entier */
  const fullLayers = new Set<Layer>();

  /** Une page, à son tour dans la file d'une requête par seconde. */
  const requestPage = async (
    url: string,
    timeout: number,
  ): Promise<WfsPage> => {
    throwIfAborted(signal);
    if (Date.now() - startedAt > DECOR_TIME_BUDGET)
      throw new StageError("service", `${SERVICE} répond trop lentement.`);
    const wait = lastRequest + WFS_MIN_INTERVAL - Date.now();
    if (wait > 0) await sleep(wait, signal);
    lastRequest = Date.now();
    lastStatus = 0;
    const policy: RetryPolicy = {
      service: SERVICE,
      retries: WFS_MAX_RETRIES,
      // Au moins 2 s : les reprises internes respectent aussi la seconde du service.
      delay: (attempt) => WFS_RETRY_DELAY * (attempt + 1),
      timeout,
      shouldRetry: (status) => {
        lastStatus = status;
        return status === 429 || status >= 500;
      },
    };
    const page = parseWfs(await requestText(url, {}, policy, options));
    if (!page)
      throw new StageError(
        "service",
        `${SERVICE} a renvoyé une réponse illisible.`,
      );
    return page;
  };

  /**
   * Une page avec la seule liste de champs utiles, sinon en entier : une liste mal nommée fait soit refuser la requête
   * (4xx), soit perdre la géométrie sans erreur.
   */
  const fetchPage = async (
    layer: Layer,
    bbox: string,
    startIndex: number,
  ): Promise<WfsPage> => {
    const timeout = layer === "fields" ? WFS_FIELDS_TIMEOUT : WFS_TIMEOUT;
    if (!fullLayers.has(layer)) {
      try {
        const page = await requestPage(
          wfsUrl(layer, bbox, startIndex, true),
          timeout,
        );
        if (page.features.length === 0 || page.features.some(hasGeometry))
          return page;
      } catch (error) {
        const refused =
          error instanceof StageError &&
          error.code === "service" &&
          lastStatus >= 400 &&
          lastStatus < 500 &&
          lastStatus !== 429;
        if (!refused) throw error;
      }
      fullLayers.add(layer);
    }
    return requestPage(wfsUrl(layer, bbox, startIndex, false), timeout);
  };

  /**
   * Département de l'origine, pour les toitures régionales. Une requête, champ seul, jamais redemandée en entier :
   * sans réponse, `null`, et les bâtiments prennent la tuile plate par défaut. Seule une annulation remonte.
   */
  const fetchDepartment = async (): Promise<string | null> => {
    const { lat, lon } = trace.origin;
    const d = WFS_DEPARTMENT_BOX;
    const bbox = [lon - d, lat - d, lon + d, lat + d]
      .map((v) => v.toFixed(6))
      .join(",");
    const params = new URLSearchParams({
      SERVICE: "WFS",
      VERSION: "2.0.0",
      REQUEST: "GetFeature",
      TYPENAMES: WFS_DEPARTMENT_LAYER,
      SRSNAME: "EPSG:4326",
      OUTPUTFORMAT: "application/json",
      BBOX: `${bbox},EPSG:4326`,
      COUNT: "1",
      PROPERTYNAME: WFS_DEPARTMENT_PROPERTY,
    });
    try {
      const page = await requestPage(
        `${WFS_URL}?${params.toString()}`,
        WFS_TIMEOUT,
      );
      const code = textOrNull(
        page.features[0]?.properties[WFS_DEPARTMENT_PROPERTY],
      );
      // Un code rendu en nombre perd son zéro : 1 redevient « 01 ».
      return code !== null && /^\d$/.test(code) ? `0${code}` : code;
    } catch (error) {
      if (!(error instanceof StageError) || error.code === "aborted")
        throw error;
      return null;
    }
  };

  /** Une couche entière, toutes boîtes et toutes pages. Lève une `StageError` si une page manque. */
  const fetchLayer = async (layer: Layer): Promise<WfsFeature[]> => {
    const features: WfsFeature[] = [];
    for (const bbox of boxes) {
      let startIndex = 0;
      for (let pageIndex = 0; pageIndex < WFS_MAX_PAGES; pageIndex++) {
        const page = await fetchPage(layer, bbox, startIndex);
        features.push(...page.features);
        startIndex += page.returned;
        // `numberMatched` d'abord : un plafond du serveur sous `COUNT` ne fait pas croire à la dernière page.
        const done =
          page.returned === 0 ||
          (page.matched !== null
            ? startIndex >= page.matched
            : page.returned < WFS_PAGE_SIZE);
        if (done) break;
      }
    }
    return features;
  };

  const keep = (points: LatLon[]): boolean =>
    touchesCorridor(points, trace.origin, cells);

  const collectAreas = (features: WfsFeature[], field: string): RawArea[] => {
    const areas = new Map<string, RawArea>();
    for (const feature of features) {
      if (areas.has(feature.id)) continue;
      const area = toArea(feature, field);
      if (area && keep(outerPoints(area.polygons))) areas.set(area.id, area);
    }
    return byId(areas);
  };

  try {
    const buildings = new Map<string, RawBuilding>();
    for (const feature of await fetchLayer("buildings")) {
      if (buildings.has(feature.id)) continue;
      const building = toBuilding(feature);
      if (building && keep(outerPoints(building.polygons)))
        buildings.set(building.id, building);
    }
    const department = await fetchDepartment();
    const vegetation = collectAreas(await fetchLayer("vegetation"), "nature");
    const hedges = new Map<string, RawLine>();
    for (const feature of await fetchLayer("hedges"))
      for (const hedge of toHedges(feature))
        if (!hedges.has(hedge.id) && keep(hedge.line))
          hedges.set(hedge.id, hedge);
    const water = collectAreas(await fetchLayer("water"), "nature");

    // En dernier : un RPG lent ou en panne ne coûte que les parcelles.
    let fields: RawArea[] = [];
    try {
      fields = collectAreas(await fetchLayer("fields"), "code_group");
    } catch (error) {
      if (!(error instanceof StageError) || error.code === "aborted")
        throw error;
    }

    return {
      buildings: byId(buildings),
      vegetation,
      hedges: byId(hedges),
      water,
      fields,
      department,
    };
  } catch (error) {
    if (!(error instanceof StageError) || error.code === "aborted") throw error;
    return null;
  }
};
