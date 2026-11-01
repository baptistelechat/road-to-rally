"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { StageInputs } from "@/geo/pipeline";

const FIXTURE_URL = "/stages/mountain.json";

interface MeshFingerprint {
  /** Empreinte cuite dans Node, committée */
  node: string;
  /** Recalculée ici sur le JSON de la fixture */
  browser: string;
  /** `buildStage` et `stageHash` dans le Worker, depuis les entrées de la fixture */
  worker: string;
}

/** Tout ce qui diffère de Node se voit ici : `Math.sin` et consorts ne sont pas garantis entre moteurs. */
const fingerprintFixture = async (
  signal: AbortSignal,
): Promise<MeshFingerprint> => {
  const [{ parseStage }, { stageHash }, { runStageWorker }, fixture] =
    await Promise.all([
      import("@/sim/track/stageCodec"),
      import("@/geo/stageHash"),
      import("@/geo/stageWorkerClient"),
      import("../../../fixtures/stages/mountain.inputs.json"),
    ]);
  const response = await fetch(FIXTURE_URL, { signal });
  if (!response.ok) throw new Error(`${FIXTURE_URL} : HTTP ${response.status}`);
  const baked = parseStage(await response.json());
  const { stage } = await runStageWorker(
    {
      kind: "rebuild",
      inputs: fixture.default as unknown as StageInputs,
      name: baked.name,
    },
    { signal },
  );
  return {
    node: baked.hash,
    browser: stageHash(baked),
    worker: stage.hash,
  };
};

const Probe = () => {
  const [hash, setHash] = useState("calcul…");
  const [mesh, setMesh] = useState<MeshFingerprint | null>(null);
  const [meshError, setMeshError] = useState<string | null>(null);

  useEffect(() => {
    void import("@/sim/determinismProbe")
      .then((mod) => mod.runDeterminismProbe())
      .then(setHash);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fingerprintFixture(controller.signal)
      .then(setMesh)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setMeshError(String(error));
      });
    return () => controller.abort();
  }, []);

  const same =
    mesh && mesh.node === mesh.browser && mesh.node === mesh.worker
      ? "identiques"
      : "DIFFÉRENTES";

  return (
    <pre className="p-8 font-mono text-lg" data-probe={hash}>
      {`${hash}\n\n`}
      {meshError ??
        (mesh
          ? `maillage node    ${mesh.node}\nmaillage page    ${mesh.browser}\nmaillage worker  ${mesh.worker}\n${same}`
          : "maillage : calcul…")}
      <span
        hidden
        data-probe-mesh={mesh?.browser}
        data-probe-worker={mesh?.worker}
      />
    </pre>
  );
};

export const ProbeLoader = dynamic(() => Promise.resolve(Probe), {
  ssr: false,
});
