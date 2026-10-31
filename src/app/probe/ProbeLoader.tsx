"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Probe = () => {
  const [hash, setHash] = useState("calcul…");
  useEffect(() => {
    void import("@/sim/determinismProbe")
      .then((mod) => mod.runDeterminismProbe())
      .then(setHash);
  }, []);
  return (
    <pre className="p-8 font-mono text-lg" data-probe={hash}>
      {hash}
    </pre>
  );
};

export const ProbeLoader = dynamic(() => Promise.resolve(Probe), {
  ssr: false,
});
