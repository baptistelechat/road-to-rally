import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Pas d'appel réseau en course : la simulation ne connaît que `StageData`, jamais le pipeline.
  {
    files: ["src/sim/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/geo", "@/geo/*", "**/geo", "**/geo/*"],
              message:
                "src/sim n'importe jamais src/geo : le pipeline réseau reste hors de la simulation.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Généré par mapcn et gardé tel quel : ses écarts aux règles React ne sont pas les nôtres.
    "src/components/ui/map.tsx",
  ]),
]);

export default eslintConfig;
