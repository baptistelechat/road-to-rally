import { ProbeLoader } from "./ProbeLoader";

// Compare l'empreinte de simulation du navigateur à celle de Node (`pnpm check:determinism`).
export default function ProbePage() {
  return <ProbeLoader />;
}
