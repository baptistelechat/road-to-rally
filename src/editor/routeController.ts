// Orchestration des gestes, sans React : le tracé validé n'est remplacé qu'une fois toutes ses routes reçues.
import { RouteRefused, type FetchRoute } from "@/geo/brouter";
import { StageError } from "@/geo/errors";
import type { LatLon } from "@/geo/gpx";
import { fetchReturnRoute, RETURN_LOST, RETURN_REFUSED } from "./roundTrip";
import { fetchRunoff } from "./runoff";
import {
  addAnchor,
  applyRoutes,
  assembleRoad,
  insertAnchor,
  moveAnchor,
  removeAnchor,
  reverseTrace,
  runoffsToFetch,
  type TraceEdit,
} from "./trace";
import type { EditorTrace } from "./types";

export interface RouteStatus {
  /** Une requête est en cours : le tracé affiché reste le dernier valide */
  pending: boolean;
  /** Message prêt à afficher */
  error: string | null;
  /** Une panne : `retry()` a un sens. Pas un point refusé, qui resterait refusé. */
  canRetry: boolean;
  /** La route au-delà des lignes est en cours de recherche, de quel côté */
  runoffs?: { before: boolean; after: boolean };
}

export interface RouteControllerOptions {
  /** `fetchRoute` de `src/geo/brouter.ts`, remplaçable sans réseau */
  fetchRoute: FetchRoute;
  /** La route au-delà des lignes. Absent : la ligne droite, sans réseau. */
  fetchRunoffRoute?: FetchRoute;
  getTrace: () => EditorTrace;
  /** Nouveau tracé valide : à pousser dans l'historique et le brouillon. `notice` : ce que le geste a changé d'autre. */
  commit: (trace: EditorTrace, notice?: string) => void;
  onStatus: (status: RouteStatus) => void;
}

export interface RouteController {
  addPoint: (position: LatLon) => Promise<void>;
  insertPoint: (segmentIndex: number, position: LatLon) => Promise<void>;
  movePoint: (anchorId: string, position: LatLon) => Promise<void>;
  removePoint: (anchorId: string) => Promise<void>;
  reverse: () => Promise<void>;
  /** Revenir par la même route depuis le dernier point : refusé sans rien changer s'il n'y a pas de quoi faire demi-tour */
  returnByRoad: () => Promise<void>;
  cancelReturn: () => Promise<void>;
  retry: () => Promise<void>;
  /** Un tracé déjà calculé, une variante par exemple : seuls ses prolongements restent à demander */
  adopt: (trace: EditorTrace) => Promise<void>;
  /** Annule la requête en cours et efface le message : à appeler avant `undo`, `redo` ou « tout vider » */
  cancel: () => void;
}

const IDLE: RouteStatus = { pending: false, error: null, canRetry: false };

interface Gesture {
  build: () => TraceEdit;
  /** Le joueur demande le retour : un refus ne change rien. Sinon, un retour devenu impossible est retiré, en le disant. */
  asksReturn?: boolean;
}

export const createRouteController = ({
  fetchRoute,
  fetchRunoffRoute,
  getTrace,
  commit,
  onStatus,
}: RouteControllerOptions): RouteController => {
  let current: AbortController | null = null;
  let failed: Gesture | null = null;

  const needsRunoffs = (trace: EditorTrace): boolean => {
    if (!fetchRunoffRoute) return false;
    const { runIn, runOut } = runoffsToFetch(trace);
    return runIn || runOut;
  };

  /** Seuls les bouts qui ont bougé partent au réseau : ajouter un point ne redemande pas le départ. */
  const withRunoffs = async (
    trace: EditorTrace,
    signal: AbortSignal,
  ): Promise<EditorTrace> => {
    if (!fetchRunoffRoute) return trace;
    const stale = runoffsToFetch(trace);
    if (stale.runIn || stale.runOut)
      onStatus({
        pending: true,
        error: null,
        canRetry: false,
        runoffs: { before: stale.runIn, after: stale.runOut },
      });
    const road = assembleRoad(trace.segments);
    const [runIn, runOut] = await Promise.all([
      stale.runIn
        ? fetchRunoff(road, true, fetchRunoffRoute, signal)
        : trace.runIn,
      stale.runOut
        ? fetchRunoff([...road].reverse(), false, fetchRunoffRoute, signal)
        : trace.runOut,
    ]);
    return { ...trace, runIn, runOut };
  };

  const run = async (request: Gesture): Promise<void> => {
    current?.abort();
    const gesture = new AbortController();
    current = gesture;
    failed = null;

    const edit = request.build();
    // Toute modification d'un aller-retour recalcule le retour : le plus simple pour rester cohérent, et une seule requête.
    const withReturn =
      request.asksReturn === true ||
      (edit.trace.returnRoute !== null && edit.trace !== getTrace());
    if (edit.pairs.length === 0 && !withReturn && !needsRunoffs(edit.trace)) {
      onStatus(IDLE);
      if (edit.trace !== getTrace()) commit(edit.trace);
      return;
    }

    onStatus({ pending: true, error: null, canRetry: false });
    try {
      const routes = await Promise.all(
        edit.pairs.map(({ from, to }) =>
          fetchRoute(from, to, { signal: gesture.signal }),
        ),
      );
      // Une réponse périmée peut arriver malgré l'annulation : elle n'écrase jamais le tracé.
      if (gesture.signal.aborted) return;
      const result = applyRoutes(edit, routes);
      if (result.refusal !== undefined) {
        onStatus({ pending: false, error: result.refusal, canRetry: false });
        return;
      }
      const settled = await withRunoffs(result.trace, gesture.signal);
      if (gesture.signal.aborted) return;
      if (!withReturn) {
        onStatus(IDLE);
        commit(settled);
        return;
      }
      const returnRoute = await fetchReturnRoute(
        settled,
        fetchRoute,
        gesture.signal,
      );
      if (gesture.signal.aborted) return;
      if (!returnRoute && request.asksReturn) {
        onStatus({ pending: false, error: RETURN_REFUSED, canRetry: false });
        return;
      }
      onStatus(IDLE);
      commit(
        {
          ...settled,
          returnRoute,
          returnFromAnchorIndex: returnRoute
            ? settled.anchors.length - 1
            : null,
        },
        returnRoute ? undefined : RETURN_LOST,
      );
    } catch (error) {
      if (gesture.signal.aborted) return;
      // La route voisine du même geste ne sert plus à rien.
      gesture.abort();
      const canRetry = !(error instanceof RouteRefused);
      if (canRetry) failed = request;
      onStatus({
        pending: false,
        error:
          error instanceof StageError
            ? error.message
            : "Le tracé n'a pas pu être calculé. Réessaie dans un moment.",
        canRetry,
      });
    }
  };

  const runEdit = (build: () => TraceEdit): Promise<void> => run({ build });

  return {
    addPoint: (position) => runEdit(() => addAnchor(getTrace(), position)),
    insertPoint: (segmentIndex, position) =>
      runEdit(() => insertAnchor(getTrace(), segmentIndex, position)),
    movePoint: (anchorId, position) =>
      runEdit(() => moveAnchor(getTrace(), anchorId, position)),
    removePoint: (anchorId) =>
      runEdit(() => removeAnchor(getTrace(), anchorId)),
    reverse: () =>
      runEdit(() => ({ trace: reverseTrace(getTrace()), pairs: [] })),
    returnByRoad: () =>
      run({
        build: () => ({ trace: getTrace(), pairs: [] }),
        asksReturn: true,
      }),
    cancelReturn: () =>
      runEdit(() => ({
        trace: {
          ...getTrace(),
          returnRoute: null,
          returnFromAnchorIndex: null,
        },
        pairs: [],
      })),
    retry: () => (failed ? run(failed) : Promise.resolve()),
    adopt: (trace) => runEdit(() => ({ trace, pairs: [] })),
    cancel: () => {
      current?.abort();
      failed = null;
      onStatus(IDLE);
    },
  };
};
