// État de l'éditeur, sans React ni MapLibre : l'historique du tracé, le statut du routage et ce que l'analyse en a tiré.
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { TraceAnalysis, TraceIssue } from "@/geo/analyzeTrace";
import { runAnalyzeWorker } from "@/geo/analyzeWorkerClient";
import { fetchRoute, type FetchRoute } from "@/geo/brouter";
import { STEP } from "@/geo/config";
import type { LatLon } from "@/geo/gpx";
import type { PreviewProfile } from "@/geo/previewProfile";
import type { TraceStats } from "@/geo/traceStats";
import {
  addChicane,
  flipChicane,
  lostChicanesNotice,
  moveChicane,
  nudgeChicane,
  removeChicane,
  resetChicanes,
  settleChicanes,
  type ChicaneContext,
} from "./chicanes";
import { clearDraft, readDraft, writeDraft } from "./draft";
import { traceToGpx } from "./gpxExport";
import {
  createHistory,
  pushHistory,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from "./history";
import { createRouteController, type RouteStatus } from "./routeController";
import type { ApplyResult } from "./trace";
import { EMPTY_TRACE, type AutoChicanes, type EditorTrace } from "./types";
import { findVariants, type AnalyzeFn, type RouteVariant } from "./variants";

export const OUT_OF_FRANCE_CODE = "outOfFrance";

/** Un problème du tracé : ceux de l'analyse, plus le contrôle hors de France, qui attend les altitudes. */
export type EditorIssue = Omit<TraceIssue, "code"> & {
  code: TraceIssue["code"] | typeof OUT_OF_FRANCE_CODE;
};

export type ProfileStatus = "idle" | "loading" | "failed" | "outOfFrance";

/** La recherche d'autres routes pour un segment. `null` : aucune, ou elle ne vaut plus pour le tracé actuel. */
export type VariantState =
  | { kind: "searching"; segmentIndex: number }
  | {
      kind: "done";
      segmentIndex: number;
      variants: RouteVariant[];
      rejected: number;
      failure: string | null;
    };

export interface EditorState {
  history: History<EditorTrace>;
  /** Hors de l'historique : annuler un geste ne doit pas renommer la spéciale */
  name: string;
  status: RouteStatus;
  /** Geste refusé pendant un calcul, ou ce qu'un geste a changé d'autre : le dire vaut mieux que le taire */
  notice: string | null;
  /** Le stockage a refusé le dernier brouillon : le tracé est perdu si on quitte la page */
  draftSaved: boolean;
  /** Un point ou la poignée d'insertion est en cours de glissement */
  dragging: boolean;

  analyzing: boolean;
  analysis: TraceAnalysis | null;
  analysisError: string | null;
  issues: EditorIssue[];
  stats: TraceStats | null;
  autoChicanes: AutoChicanes | null;
  profile: PreviewProfile | null;
  profileStatus: ProfileStatus;
  profileMessage: string | null;

  variants: VariantState | null;

  /** Abscisse survolée sur l'axe entier, partagée par la carte et le graphique */
  hoverS: number | null;
  highlightStraight: boolean;
  /** Dernier endroit demandé depuis le panneau : un objet neuf par demande */
  focus: { position: LatLon } | null;

  addPoint: (position: LatLon) => Promise<void>;
  insertPoint: (segmentIndex: number, position: LatLon) => Promise<void>;
  movePoint: (anchorId: string, position: LatLon) => Promise<void>;
  removePoint: (anchorId: string) => Promise<void>;
  reverse: () => Promise<void>;
  returnByRoad: () => Promise<void>;
  cancelReturn: () => Promise<void>;
  retry: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setName: (name: string) => void;

  addChicaneAt: (position?: LatLon) => void;
  moveChicaneTo: (id: string, position: LatLon) => void;
  nudgeChicaneBy: (id: string, direction: 1 | -1) => void;
  flipChicaneSide: (id: string) => void;
  removeChicaneById: (id: string) => void;
  resetAutoChicanes: () => void;
  setChicanesEnabled: (enabled: boolean) => void;

  searchVariants: (segmentIndex: number) => Promise<void>;
  chooseVariant: (variant: RouteVariant) => void;
  dismissVariants: () => void;
}

const IDLE: RouteStatus = { pending: false, error: null, canRetry: false };

const BUSY_NOTICE =
  "La route précédente est encore en calcul : attends un instant avant le geste suivant.";

const VARIANT_ROUND_TRIP_NOTICE =
  "Retire d'abord le retour pour chercher une autre route : il dépend de ce tracé.";

/**
 * Le GPX envoyé au pipeline, sans le nom : renommer la spéciale ne doit pas relancer deux minutes de génération,
 * car la clé du cache dépend de ce texte. Le nom suit à côté, dans la demande au Worker.
 */
export const stageGpx = (
  trace: Pick<EditorTrace, "segments" | "returnRoute">,
): string => traceToGpx({ ...trace, name: "" });

const analyzeInWorker: AnalyzeFn = (gpx, options, signal) =>
  runAnalyzeWorker(gpx, options, signal).then(({ analysis }) => analysis);

export const createEditorStore = (
  routeFetcher: FetchRoute,
  initial: EditorTrace = readDraft(),
  analyze: AnalyzeFn = analyzeInWorker,
) =>
  createStore<EditorState>()((set, get) => {
    const persist = (trace: EditorTrace): void =>
      set({ draftSaved: writeDraft({ ...trace, name: get().name }) });

    let variantSearch: AbortController | null = null;

    const closeVariants = (): void => {
      variantSearch?.abort();
      variantSearch = null;
      set({ variants: null });
    };

    /** Un tracé validé : les variantes en cours ne valent plus, et la prochaine action repart de lui. */
    const record = (trace: EditorTrace, notice: string | null): void => {
      closeVariants();
      set({ history: pushHistory(get().history, trace), notice });
      persist(trace);
    };

    const commitRoute = (trace: EditorTrace, notice?: string): void => {
      const settled = settleChicanes(trace);
      const messages = [notice, lostChicanesNotice(settled.lost)].filter(
        (message) => message,
      );
      record(settled.trace, messages.length > 0 ? messages.join(" ") : null);
    };

    const controller = createRouteController({
      fetchRoute: routeFetcher,
      getTrace: () => get().history.present,
      commit: commitRoute,
      onStatus: (status) => set({ status, notice: null }),
    });

    /** Le contrôleur annule la requête en cours à chaque geste : un second clic rapide ferait perdre le premier point. */
    const gesture =
      <A extends unknown[]>(run: (...args: A) => Promise<void>) =>
      (...args: A): Promise<void> => {
        if (get().status.pending) {
          set({ notice: BUSY_NOTICE });
          return Promise.resolve();
        }
        return run(...args);
      };

    const chicaneContext = (): ChicaneContext => {
      const state = get();
      return {
        trace: state.history.present,
        auto: state.autoChicanes?.chicanes ?? [],
        axis: state.analysis?.axis ?? null,
      };
    };

    /** Comme un geste sur le tracé : refusé pendant un calcul, dont le résultat repartirait du tracé d'avant. */
    const editChicanes = (
      run: (context: ChicaneContext) => ApplyResult,
    ): void => {
      if (get().status.pending) {
        set({ notice: BUSY_NOTICE });
        return;
      }
      const result = run(chicaneContext());
      if (result.refusal !== undefined) set({ notice: result.refusal });
      else if (result.trace !== get().history.present)
        record(result.trace, null);
    };

    const travel = (
      move: (history: History<EditorTrace>) => History<EditorTrace>,
    ): void => {
      controller.cancel();
      closeVariants();
      const history = move(get().history);
      set({ history });
      persist(history.present);
    };

    return {
      history: createHistory(initial),
      name: initial.name,
      status: IDLE,
      notice: null,
      draftSaved: true,
      dragging: false,
      analyzing: false,
      analysis: null,
      analysisError: null,
      issues: [],
      stats: null,
      autoChicanes: null,
      profile: null,
      profileStatus: "idle",
      profileMessage: null,
      variants: null,
      hoverS: null,
      highlightStraight: false,
      focus: null,

      addPoint: gesture(controller.addPoint),
      insertPoint: gesture(controller.insertPoint),
      movePoint: gesture(controller.movePoint),
      removePoint: gesture(controller.removePoint),
      reverse: gesture(controller.reverse),
      returnByRoad: gesture(controller.returnByRoad),
      cancelReturn: gesture(controller.cancelReturn),
      retry: gesture(controller.retry),
      undo: () => travel(undoHistory),
      redo: () => travel(redoHistory),
      clear: () => {
        controller.cancel();
        closeVariants();
        // Annulable comme un autre geste : l'historique garde le tracé vidé, seul le brouillon disparaît.
        set({
          history: pushHistory(get().history, { ...EMPTY_TRACE }),
          name: "",
          draftSaved: true,
        });
        clearDraft();
      },
      setName: (name) => {
        set({ name });
        persist(get().history.present);
      },

      addChicaneAt: (position) =>
        editChicanes((context) => addChicane(context, position)),
      moveChicaneTo: (id, position) =>
        editChicanes((context) => moveChicane(context, id, position)),
      nudgeChicaneBy: (id, direction) =>
        editChicanes((context) => nudgeChicane(context, id, direction)),
      flipChicaneSide: (id) =>
        editChicanes((context) => flipChicane(context, id)),
      removeChicaneById: (id) =>
        editChicanes((context) => removeChicane(context, id)),
      resetAutoChicanes: () =>
        editChicanes(({ trace }) => ({ trace: resetChicanes(trace) })),
      setChicanesEnabled: (chicanesEnabled) =>
        editChicanes(({ trace }) => ({
          trace: { ...trace, chicanesEnabled },
        })),

      searchVariants: async (segmentIndex) => {
        const trace = get().history.present;
        if (trace.returnRoute) {
          set({ notice: VARIANT_ROUND_TRIP_NOTICE });
          return;
        }
        if (!trace.segments[segmentIndex]) return;
        closeVariants();
        const search = new AbortController();
        variantSearch = search;
        set({ variants: { kind: "searching", segmentIndex } });
        try {
          const found = await findVariants(
            trace,
            segmentIndex,
            routeFetcher,
            analyze,
            search.signal,
          );
          if (!search.signal.aborted)
            set({ variants: { kind: "done", segmentIndex, ...found } });
        } catch {
          // Annulée seulement : `findVariants` garde les autres pannes dans son résultat.
          if (!search.signal.aborted)
            set({
              variants: {
                kind: "done",
                segmentIndex,
                variants: [],
                rejected: 0,
                failure:
                  "La recherche d'autres routes a échoué. Réessaie dans un moment.",
              },
            });
        }
      },
      chooseVariant: (variant) => commitRoute(variant.trace),
      dismissVariants: closeVariants,
    };
  });

export const editorStore = createEditorStore(fetchRoute);

export const useEditor = <T>(selector: (state: EditorState) => T): T =>
  useStore(editorStore, selector);

/** Le problème qui empêche de rouler, ou la raison pour laquelle on ne le sait pas encore. */
export const rollBlocker = (state: EditorState): string | null => {
  if (state.history.present.segments.length === 0)
    return "Pose au moins deux points pour tracer une route.";
  if (state.status.pending) return "La route est en cours de calcul.";
  if (state.analyzing) return "Vérification du tracé en cours.";
  const blocking = state.issues.find((issue) => issue.blocking);
  if (blocking) return blocking.message;
  if (state.analysis) return null;
  return state.analysisError ?? "Vérification du tracé en cours.";
};

/** L'indice sur l'axe d'une abscisse, borné à ses points. */
export const axisIndex = (s: number, pointCount: number): number =>
  Math.max(0, Math.min(pointCount - 1, Math.round(s / STEP)));
