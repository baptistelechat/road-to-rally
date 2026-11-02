"use client";

import { useEffect } from "react";
import type { AnalyzedAxis } from "@/geo/analyzeTrace";
import { runAnalyzeWorker, runProfileWorker } from "@/geo/analyzeWorkerClient";
import { STEP } from "@/geo/config";
import { StageError } from "@/geo/errors";
import { computeTraceStats } from "@/geo/traceStats";
import {
  editorStore,
  OUT_OF_FRANCE_CODE,
  stageGpx,
  type EditorIssue,
} from "../store";
import type { ReturnRoute, Segment } from "../types";

const messageOf = (error: unknown, fallback: string): string =>
  error instanceof StageError ? error.message : fallback;

const loadProfile = async (
  axis: AnalyzedAxis,
  signal: AbortSignal,
): Promise<void> => {
  editorStore.setState({ profileStatus: "loading", profileMessage: null });
  try {
    const result = await runProfileWorker(
      axis.points,
      axis.origin,
      axis.runoffPoints,
      signal,
    );
    if (signal.aborted) return;
    if (!("kind" in result)) {
      editorStore.setState({ profile: result, profileStatus: "idle" });
      return;
    }
    const issue: EditorIssue = {
      code: OUT_OF_FRANCE_CODE,
      message: result.message,
      s: (result.pointIndex - axis.runoffPoints) * STEP,
      position: axis.latLon[result.pointIndex],
      blocking: true,
    };
    editorStore.setState((state) => ({
      profile: null,
      profileStatus: "outOfFrance",
      profileMessage: result.message,
      issues: [...state.issues, issue],
    }));
  } catch (error) {
    if (signal.aborted) return;
    // L'IGN en panne ne condamne pas le tracé : seul le graphique manque, et le pipeline refera le contrôle.
    editorStore.setState({
      profile: null,
      profileStatus: "failed",
      profileMessage: messageOf(
        error,
        "Le profil d'altitude n'a pas pu être calculé.",
      ),
    });
  }
};

const analyze = async (
  segments: Segment[],
  returnRoute: ReturnRoute | null,
  signal: AbortSignal,
): Promise<void> => {
  try {
    const { analysis, chicanes } = await runAnalyzeWorker(
      stageGpx({ segments, returnRoute }),
      { widthsByHighway: segments, realReturn: returnRoute?.realReturn },
      signal,
    );
    if (signal.aborted) return;
    const { axis } = analysis;
    editorStore.setState({
      analysis,
      analyzing: false,
      analysisError: null,
      issues: analysis.issues,
      stats: axis ? computeTraceStats(axis.points, axis.runoffPoints) : null,
      autoChicanes: chicanes,
      ...(axis ? {} : { profile: null, profileStatus: "idle" as const }),
    });
    if (axis) await loadProfile(axis, signal);
  } catch (error) {
    if (signal.aborted) return;
    editorStore.setState({
      analysis: null,
      analyzing: false,
      analysisError: messageOf(error, "L'analyse du tracé a échoué."),
      issues: [],
      stats: null,
      autoChicanes: null,
    });
  }
};

/**
 * À chaque tracé validé, jamais pendant un glissement. Le tracé suivant annule le calcul en cours.
 * Sur la route seule : déplacer une chicane ne redemande ni l'analyse ni les altitudes.
 */
export const useTraceAnalysis = (
  segments: Segment[],
  returnRoute: ReturnRoute | null,
): void => {
  useEffect(() => {
    if (segments.length === 0) {
      editorStore.setState({
        analysis: null,
        analyzing: false,
        analysisError: null,
        issues: [],
        stats: null,
        autoChicanes: null,
        profile: null,
        profileStatus: "idle",
        profileMessage: null,
        hoverS: null,
      });
      return;
    }
    const controller = new AbortController();
    editorStore.setState({ analyzing: true });
    void analyze(segments, returnRoute, controller.signal);
    return () => controller.abort();
  }, [segments, returnRoute]);
};
